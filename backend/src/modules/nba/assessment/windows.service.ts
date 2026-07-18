/**
 * Tổng hợp dữ liệu khách theo cửa sổ 3 và 6 tháng.
 *
 * Ranh giới PII (BUILD_SPEC L3): module này CHỈ đọc `ts`, `amount`, `direction` của giao dịch.
 * Tuyệt đối không đọc `transactions.content` — nội dung chuyển khoản chỉ thuộc về `extraction/`.
 * Nhóm chi tiêu lấy từ `customer_tags` (tag đã qua duyệt), không suy từ nội dung thô.
 */
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../database/prisma.service';
import type {
  CurrentPosition,
  RelationshipSummary,
  Trend,
  WindowSummary,
} from './assessment.types';

interface FlowRow {
  total_in: number;
  total_out: number;
  txn_count: number;
  max_txn_amount: number | null;
  active_months: number;
}

@Injectable()
export class WindowsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Chỉ số dạng tồn: số dư, dư nợ, DTI, CIC, tuổi — đều là giá trị hiện tại. */
  async currentPosition(customerId: number): Promise<CurrentPosition> {
    const [row] = await this.prisma.$queryRawUnsafe<
      Array<{
        casa_avg: number | null;
        casa_accounts: number;
        total_debt: number;
        monthly_payment: number;
        monthly_income: number | null;
        has_overdue: boolean;
        cic_group: number | null;
        age: number | null;
      }>
    >(
      `SELECT
         (SELECT AVG(a.balance)::float FROM accounts a
           WHERE a.customer_id=c.id AND a.acct_type='casa'::account_type) AS casa_avg,
         (SELECT count(*)::int FROM accounts a
           WHERE a.customer_id=c.id AND a.acct_type='casa'::account_type) AS casa_accounts,
         COALESCE((SELECT SUM(l.outstanding)::float FROM loans l WHERE l.customer_id=c.id),0) AS total_debt,
         COALESCE((SELECT SUM(l.monthly_payment)::float FROM loans l WHERE l.customer_id=c.id),0) AS monthly_payment,
         c.monthly_income::float AS monthly_income,
         COALESCE((SELECT bool_or(l.is_overdue) FROM loans l WHERE l.customer_id=c.id),false) AS has_overdue,
         (SELECT cb.cic_group::int FROM credit_bureau cb WHERE cb.customer_id=c.id) AS cic_group,
         CASE WHEN c.dob IS NULL THEN NULL
              ELSE date_part('year', age(CURRENT_DATE, c.dob))::int END AS age
       FROM customers c WHERE c.id=$1::bigint`,
      customerId,
    );

    const income = row?.monthly_income ?? null;
    const payment = row?.monthly_payment ?? 0;
    return {
      casa_avg: row?.casa_avg ?? null,
      casa_accounts: row?.casa_accounts ?? 0,
      total_debt: row?.total_debt ?? 0,
      monthly_payment: payment,
      monthly_income: income,
      // NULL ≠ 0: không có thu nhập thì DTI là "không xác định", không phải 0.
      dti: income && income > 0 ? Number((payment / income).toFixed(4)) : null,
      has_overdue: row?.has_overdue ?? false,
      cic_group: row?.cic_group ?? null,
      age: row?.age ?? null,
    };
  }

  /** Dòng tiền + hành vi giao dịch trong `months` tháng gần nhất tính từ `asOf`. */
  async window(customerId: number, months: 3 | 6, asOf: string): Promise<WindowSummary> {
    const flow = await this.flows(customerId, asOf, months, 0);

    const spendTags = await this.prisma.$queryRawUnsafe<
      Array<{ tag: string; txn_count: number }>
    >(
      `SELECT tag, txn_count::int AS txn_count
       FROM customer_tags
       WHERE customer_id=$1::bigint AND last_seen >= ($2::date - ($3 || ' months')::interval)
       ORDER BY txn_count DESC LIMIT 8`,
      customerId,
      asOf,
      String(months),
    );

    const [opened] = await this.prisma.$queryRawUnsafe<
      Array<{ loans_opened: number; products_opened: number }>
    >(
      `SELECT
         (SELECT count(*)::int FROM loans l
           WHERE l.customer_id=$1::bigint
             AND l.opened_at >= ($2::date - ($3 || ' months')::interval)) AS loans_opened,
         (SELECT count(*)::int FROM customer_products cp
           WHERE cp.customer_id=$1::bigint
             AND cp.opened_at >= ($2::date - ($3 || ' months')::interval)) AS products_opened`,
      customerId,
      asOf,
      String(months),
    );

    const to = new Date(asOf);
    const from = new Date(to);
    from.setMonth(from.getMonth() - months);

    return {
      months,
      from_date: from.toISOString().slice(0, 10),
      to_date: asOf,
      total_in: flow.total_in,
      total_out: flow.total_out,
      net_flow: Number((flow.total_in - flow.total_out).toFixed(2)),
      txn_count: flow.txn_count,
      txn_per_month: Number((flow.txn_count / months).toFixed(2)),
      max_txn_amount: flow.max_txn_amount,
      active_months: flow.active_months,
      spend_tags: spendTags,
      loans_opened: opened?.loans_opened ?? 0,
      products_opened: opened?.products_opened ?? 0,
    };
  }

  /**
   * Xu hướng: 3 tháng gần nhất so với 3 tháng liền trước.
   * `offsetMonths=3` lùi cửa sổ về sau để lấy đúng đoạn tháng 4-6.
   */
  async trend(customerId: number, asOf: string): Promise<Trend> {
    const recent = await this.flows(customerId, asOf, 3, 0);
    const previous = await this.flows(customerId, asOf, 3, 3);

    const pct = (now: number, before: number): number | null => {
      if (before === 0) return now === 0 ? 0 : null; // không có mốc so sánh
      return Number((((now - before) / Math.abs(before)) * 100).toFixed(1));
    };

    const netNow = recent.total_in - recent.total_out;
    const netBefore = previous.total_in - previous.total_out;
    const netPct = pct(netNow, netBefore);

    let direction: Trend['direction'] = 'flat';
    if (netPct !== null && netPct > 10) direction = 'up';
    else if (netPct !== null && netPct < -10) direction = 'down';

    return {
      net_flow_pct: netPct,
      txn_count_pct: pct(recent.txn_count, previous.txn_count),
      total_in_pct: pct(recent.total_in, previous.total_in),
      direction,
    };
  }

  /** Nhóm 4 — sản phẩm đang giữ, lịch sử bị từ chối, lần tiếp cận gần nhất. */
  async relationship(customerId: number): Promise<RelationshipSummary> {
    const held = await this.prisma.$queryRawUnsafe<
      Array<{ product: string; tier: string | null; since: string | null }>
    >(
      `SELECT product::text AS product, tier, opened_at::text AS since
       FROM customer_products
       WHERE customer_id=$1::bigint AND status='active'
       ORDER BY opened_at DESC NULLS LAST`,
      customerId,
    );

    const suppressed = await this.prisma.$queryRawUnsafe<
      Array<{ product: string; until_date: string; reason: string }>
    >(
      `SELECT product::text AS product, until_date::text AS until_date, reason
       FROM suppressions
       WHERE customer_id=$1::bigint AND until_date >= CURRENT_DATE
       ORDER BY until_date DESC`,
      customerId,
    );

    const [contact] = await this.prisma.$queryRawUnsafe<
      Array<{
        last_contact_days: number | null;
        status: string | null;
        product: string | null;
        created_at: string | null;
        note_count: number;
      }>
    >(
      `WITH last_fb AS (
         SELECT f.status::text AS status, f.product::text AS product, f.created_at
         FROM feedback f JOIN recommendations r ON r.id = f.rec_id
         WHERE r.customer_id = $1::bigint
         ORDER BY f.created_at DESC LIMIT 1
       )
       SELECT
         (SELECT date_part('day', now() - created_at)::int FROM last_fb) AS last_contact_days,
         (SELECT status FROM last_fb) AS status,
         (SELECT product FROM last_fb) AS product,
         (SELECT created_at::text FROM last_fb) AS created_at,
         (SELECT count(*)::int FROM call_notes WHERE customer_id=$1::bigint) AS note_count`,
      customerId,
    );

    return {
      held_products: held,
      suppressed,
      last_contact_days: contact?.last_contact_days ?? null,
      last_feedback:
        contact?.status && contact.product && contact.created_at
          ? { status: contact.status, product: contact.product, created_at: contact.created_at }
          : null,
      note_count: contact?.note_count ?? 0,
    };
  }

  /**
   * Cộng dồn giao dịch trong một cửa sổ.
   * Cửa sổ = [asOf - (offset+months) tháng, asOf - offset tháng).
   */
  private async flows(
    customerId: number,
    asOf: string,
    months: number,
    offsetMonths: number,
  ): Promise<FlowRow> {
    const [row] = await this.prisma.$queryRawUnsafe<FlowRow[]>(
      `SELECT
         COALESCE(SUM(amount) FILTER (WHERE direction='in'::txn_direction),0)::float  AS total_in,
         COALESCE(SUM(amount) FILTER (WHERE direction='out'::txn_direction),0)::float AS total_out,
         count(*)::int AS txn_count,
         MAX(amount)::float AS max_txn_amount,
         count(DISTINCT date_trunc('month', ts))::int AS active_months
       FROM transactions
       WHERE customer_id = $1::bigint
         AND ts >= ($2::date - ($3 || ' months')::interval)
         AND ts <  ($2::date - ($4 || ' months')::interval)`,
      customerId,
      asOf,
      String(offsetMonths + months),
      String(offsetMonths),
    );
    return (
      row ?? { total_in: 0, total_out: 0, txn_count: 0, max_txn_amount: null, active_months: 0 }
    );
  }
}
