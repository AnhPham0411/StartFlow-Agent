/**
 * NbaService — query NBA tables (raw SQL) qua Prisma.$queryRawUnsafe.
 * Không dùng ORM model vì schema Prisma là StartFlow (khác domain).
 * Staleness check §4 B4: so 3 chỉ số neo trong snapshot vs "core" mock hiện tại.
 */
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';

/** Staleness threshold theo BUILD_SPEC B4 */
const STALE_CASA_PCT = 0.2;
const STALE_DEBT_PCT = 0.15;

export interface CallListEntry {
  customer_id: number;
  name: string;
  cif_code: string;
  phone: string;
  assigned_sale_id: string | null;
  product_rank1: string | null;
  product_rank2: string | null;
  rec_id: string | null;
  rec_version: number | null;
}

export interface CustomerDetail {
  customer_id: number;
  full_name: string;
  cif_code: string;
  recommendation: Record<string, unknown> | null;
  versions: Array<{ version: number; created_at: string; source: string }>;
  staleness: { flag: boolean; fields: string[] };
}

@Injectable()
export class NbaService {
  constructor(private readonly prisma: PrismaService) {}

  /** GET /api/nba/calllist?date= */
  async getCallList(dateStr: string): Promise<CallListEntry[]> {
    const rows = await this.prisma.$queryRawUnsafe<CallListEntry[]>(
      `SELECT cl.customer_id::int AS customer_id,
              c.full_name AS name,
              c.cif_code AS cif_code,
              '090-mock'::text AS phone,
              cl.assigned_sale_id::text AS assigned_sale_id,
              r.product_rank1,
              r.product_rank2,
              r.id::text AS rec_id,
              r.version::int AS rec_version
       FROM call_lists cl
       JOIN customers c ON c.id = cl.customer_id
       LEFT JOIN LATERAL (
         SELECT id, product_rank1, product_rank2, version
         FROM recommendations
         WHERE customer_id = cl.customer_id
         ORDER BY version DESC
         LIMIT 1
       ) r ON true
       WHERE cl.list_date = $1::date
       ORDER BY c.full_name`,
      dateStr,
    );
    return rows;
  }

  /** GET /api/nba/customer/:id — đề xuất mới nhất + staleness + versions[] */
  async getCustomer(customerId: number): Promise<CustomerDetail> {
    // Lấy thông tin khách hàng
    const [cust] = await this.prisma.$queryRawUnsafe<Array<{ full_name: string; cif_code: string }>>(
      `SELECT full_name, cif_code FROM customers WHERE id = $1`,
      customerId,
    );

    // Lấy đề xuất mới nhất
    const [rec] = await this.prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT id::text, version, source, created_at, product_rank1, hook1, explain1,
              product_rank2, hook2, explain2, rules_applied, weights_versions,
              input_snapshot, input_snapshot_hash
       FROM recommendations
       WHERE customer_id = $1
       ORDER BY version DESC LIMIT 1`,
      customerId,
    );

    // Tất cả version (để FE hiển thị history)
    const versions = await this.prisma.$queryRawUnsafe<
      Array<{ version: number; created_at: string; source: string }>
    >(
      `SELECT version, created_at, source FROM recommendations
       WHERE customer_id = $1 ORDER BY version DESC`,
      customerId,
    );

    const staleness = rec ? await this._staleness(customerId, rec) : { flag: false, fields: [] };

    return {
      customer_id: customerId,
      full_name: cust?.full_name ?? `KH-${customerId}`,
      cif_code: cust?.cif_code ?? '',
      recommendation: rec ?? null,
      versions,
      staleness,
    };
  }

  /** Staleness check B4: so 3 chỉ số neo snapshot vs live */
  private async _staleness(
    customerId: number,
    rec: Record<string, unknown>,
  ): Promise<{ flag: boolean; fields: string[] }> {
    const snapshot = (rec.input_snapshot ?? {}) as Record<string, number>;
    const snapCasa: number = snapshot['casa_avg'] ?? -1;
    const snapDebt: number = snapshot['total_debt'] ?? -1;
    const snapFlags: string = JSON.stringify(snapshot['product_flags'] ?? []);

    const [live] = await this.prisma.$queryRawUnsafe<
      Array<{ casa_avg: number; total_debt: number; product_flags: string }>
    >(
      `SELECT
         COALESCE(AVG(a.balance),0) AS casa_avg,
         COALESCE(SUM(l.outstanding),0) AS total_debt,
         COALESCE(jsonb_agg(DISTINCT cp.product),'[]'::jsonb)::text AS product_flags
       FROM customers c
       LEFT JOIN accounts a ON a.customer_id=c.id AND a.acct_type='casa'::account_type
       LEFT JOIN loans l ON l.customer_id=c.id
       LEFT JOIN customer_products cp ON cp.customer_id=c.id AND cp.status='active'
       WHERE c.id=$1
       GROUP BY c.id`,
      customerId,
    );

    const fields: string[] = [];
    if (live && snapCasa >= 0 && Math.abs(live.casa_avg - snapCasa) / (snapCasa || 1) > STALE_CASA_PCT)
      fields.push('casa_avg');
    if (live && snapDebt >= 0 && Math.abs(live.total_debt - snapDebt) / (snapDebt || 1) > STALE_DEBT_PCT)
      fields.push('total_debt');
    if (live && live.product_flags !== snapFlags) fields.push('product_flags');

    return { flag: fields.length > 0, fields };
  }

  /** POST /api/feedback */
  async submitFeedback(body: {
    rec_id: string;
    sale_id: string;
    status: string;
    reject_reason?: string;
    note?: string;
  }): Promise<{ ok: boolean; suppressed: boolean }> {
    await this.prisma.$queryRawUnsafe(
      `INSERT INTO feedback(rec_id, sale_id, status, reject_reason, note, source)
       VALUES($1::uuid,$2,$3,$4,$5,'checkbox')`,
      body.rec_id,
      body.sale_id,
      body.status,
      body.reject_reason ?? null,
      body.note ?? null,
    );

    // R5: rejected → suppression 90 ngày
    let suppressed = false;
    if (body.status === 'rejected' && body.reject_reason) {
      // lấy product từ rec
      const [r] = await this.prisma.$queryRawUnsafe<Array<{ product_rank1: string; customer_id: number }>>(
        `SELECT product_rank1, customer_id FROM recommendations WHERE id=$1::uuid`,
        body.rec_id,
      );
      if (r) {
        await this.prisma.$queryRawUnsafe(
          `INSERT INTO suppressions(customer_id, product, until_date, reason)
           VALUES($1,$2,(CURRENT_DATE+'90 days'::interval)::date,$3)
           ON CONFLICT (customer_id, product) DO UPDATE SET until_date=EXCLUDED.until_date, reason=EXCLUDED.reason`,
          r.customer_id,
          r.product_rank1,
          body.reject_reason,
        );
        suppressed = true;
      }
    }
    return { ok: true, suppressed };
  }

  /** POST /api/admin/calllist — assign khách cho sale */
  async assignCallList(
    date: string,
    assignments: Array<{ customer_id: number; sale_id: string }>,
  ): Promise<{ inserted: number }> {
    let inserted = 0;
    for (const a of assignments) {
      await this.prisma.$queryRawUnsafe(
        `INSERT INTO call_lists(list_date, customer_id, assigned_sale_id, created_by)
         VALUES($1::date,$2::bigint,$3::bigint,$4::bigint)
         ON CONFLICT (list_date, customer_id) DO UPDATE SET assigned_sale_id=EXCLUDED.assigned_sale_id`,
        date,
        a.customer_id,
        a.sale_id,
        a.sale_id,
      );
      inserted++;
    }
    return { inserted };
  }

  /** PUT /api/admin/kpi — set hệ số KPI */
  async setKpi(month: string, product: string, multiplier: number): Promise<{ ok: boolean }> {
    await this.prisma.$queryRawUnsafe(
      `INSERT INTO kpi_weights(month, product, multiplier) VALUES($1,$2::product_enum,$3)
       ON CONFLICT (month, product) DO UPDATE SET multiplier=EXCLUDED.multiplier`,
      month,
      product,
      multiplier,
    );
    return { ok: true };
  }

  /** GET /api/audit/recommendation/:id — trace đầy đủ */
  async auditRecommendation(recId: string): Promise<Record<string, unknown>> {
    const [rec] = await this.prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT id::text, customer_id::int AS customer_id, version, source, created_at,
              product_rank1, product_rank2, rules_applied, weights_versions,
              input_snapshot_hash, input_snapshot
       FROM recommendations WHERE id=$1::uuid`,
      recId,
    );
    if (!rec) throw new Error(`recommendation ${recId} không tồn tại`);

    const feedback = await this.prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT id::text, sale_id, status, reject_reason, created_at FROM feedback WHERE rec_id=$1::uuid ORDER BY created_at`,
      recId,
    );

    return { ...rec, feedback };
  }
}
