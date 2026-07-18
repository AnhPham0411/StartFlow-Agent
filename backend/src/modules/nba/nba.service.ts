/**
 * NbaService — query NBA tables (raw SQL) qua Prisma.$queryRawUnsafe.
 * Không dùng ORM model vì schema Prisma là StartFlow (khác domain).
 *
 * Kiểu dữ liệu thật trên DB (đã đối chiếu information_schema):
 *   recommendations.id, feedback.rec_id, feedback.sale_id, call_lists.* : BIGINT (KHÔNG phải uuid)
 *   feedback.product / status / source : enum NOT NULL
 * Suppression do trigger `auto_suppression` trên bảng feedback tự sinh — service KHÔNG insert lại.
 */
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';

import { PrismaService } from '../../database/prisma.service';
import type { AuthenticatedUser } from '../../common/types/request-context';

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
  score_rank1?: number | null;
  score_rank2?: number | null;
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

  /**
   * Chặn truy cập ngang + ghi audit cho endpoint đánh giá.
   * Controller gọi hàm này trước khi để AssessmentService tính, để logic phân quyền
   * chỉ tồn tại ở một chỗ duy nhất.
   */
  async authorizeAssessment(customerId: number, user: AuthenticatedUser): Promise<void> {
    await this._assertCanAccessCustomer(customerId, user);
    await this._audit(user, 'view', 'assessment', customerId, { customer_id: customerId });
  }

  /** Ghi vết audit_log (§E4: audit mọi view/ghi). Không được làm hỏng request chính. */
  private async _audit(
    user: AuthenticatedUser,
    action: string,
    entity: string,
    entityId: string | number,
    payload: unknown,
  ): Promise<void> {
    const hash = createHash('sha256').update(JSON.stringify(payload ?? {})).digest('hex');
    try {
      await this.prisma.$queryRawUnsafe(
        `INSERT INTO audit_log(actor, action, entity, entity_id, payload_hash)
         VALUES($1,$2,$3,$4,$5)`,
        user.username ?? user.sub,
        action,
        entity,
        String(entityId),
        hash,
      );
    } catch {
      // audit không được chặn nghiệp vụ
    }
  }

  /**
   * Chặn truy cập ngang: sale chỉ xem khách được giao, manager chỉ xem trong chi nhánh.
   * Trước đây getCustomer không kiểm tra gì — bất kỳ sale nào cũng đọc được mọi khách theo ID.
   */
  private async _assertCanAccessCustomer(
    customerId: number,
    user: AuthenticatedUser,
  ): Promise<void> {
    if (user.roles.includes('admin') || user.roles.includes('manager')) {
      if (user.roles.includes('admin')) return;
      const rows = await this.prisma.$queryRawUnsafe<Array<{ n: number }>>(
        `SELECT count(*)::int AS n
         FROM call_lists cl JOIN users u ON u.id = cl.assigned_sale_id
         WHERE cl.customer_id = $1::bigint AND u.branch = $2`,
        customerId,
        user.branch ?? '',
      );
      if ((rows[0]?.n ?? 0) > 0) return;
      throw new ForbiddenException('Khách hàng không thuộc chi nhánh của bạn');
    }

    const rows = await this.prisma.$queryRawUnsafe<Array<{ n: number }>>(
      `SELECT count(*)::int AS n FROM call_lists
       WHERE customer_id = $1::bigint AND assigned_sale_id = $2::bigint`,
      customerId,
      user.id ?? 0,
    );
    if ((rows[0]?.n ?? 0) === 0) {
      throw new ForbiddenException('Khách hàng không được giao cho bạn');
    }
  }

  /** GET /api/nba/calllist?date= */
  async getCallList(dateStr: string, user?: AuthenticatedUser): Promise<CallListEntry[]> {
    let query = `
       SELECT cl.customer_id::int AS customer_id,
              c.full_name AS name,
              c.cif_code AS cif_code,
              -- schema_v1_1 chưa có cột phone trên customers; để trống cho tới khi bổ sung.
              ''::text AS phone,
              cl.assigned_sale_id::text AS assigned_sale_id,
              r.product_rank1,
              r.product_rank2,
              r.score_rank1,
              r.score_rank2,
              r.id::text AS rec_id,
              r.version::int AS rec_version
       FROM call_lists cl
       JOIN customers c ON c.id = cl.customer_id
       LEFT JOIN LATERAL (
         SELECT id, product_rank1, product_rank2, score_rank1::float AS score_rank1, score_rank2::float AS score_rank2, version
         FROM recommendations
         WHERE customer_id = cl.customer_id
         ORDER BY version DESC
         LIMIT 1
       ) r ON true
       WHERE cl.list_date = $1::date
    `;

    const params: unknown[] = [dateStr];

    if (user) {
      if (user.roles.includes('admin')) {
        // Không lọc
      } else if (user.roles.includes('manager')) {
        query += ` AND cl.assigned_sale_id IN (SELECT id FROM users WHERE branch = $2) `;
        params.push(user.branch ?? '');
      } else if (user.roles.includes('sale')) {
        query += ` AND cl.assigned_sale_id = $2::bigint `;
        params.push(user.id ?? 0);
      }
    }

    query += ` ORDER BY c.full_name`;

    const rows = await this.prisma.$queryRawUnsafe<CallListEntry[]>(query, ...params);
    if (user) await this._audit(user, 'view', 'call_list', dateStr, { count: rows.length });
    return rows;
  }

  /**
   * GET /api/nba/customers — danh sách khách sale được phép xem (mọi ngày, không chỉ hôm nay).
   * Khác `getCallList` ở chỗ không giới hạn theo `list_date`, dùng cho trang tra cứu.
   */
  async listCustomers(
    user: AuthenticatedUser,
    search?: string,
    limit = 200,
  ): Promise<
    Array<{
      customer_id: number;
      full_name: string;
      cif_code: string;
      product_rank1: string | null;
      last_list_date: string | null;
    }>
  > {
    const params: unknown[] = [];
    let scope = '';

    if (user.roles.includes('admin')) {
      // Không giới hạn phạm vi.
    } else if (user.roles.includes('manager')) {
      params.push(user.branch ?? '');
      scope = `WHERE c.id IN (
                 SELECT cl.customer_id FROM call_lists cl
                 JOIN users u ON u.id = cl.assigned_sale_id
                 WHERE u.branch = $${params.length})`;
    } else {
      params.push(user.id ?? 0);
      scope = `WHERE c.id IN (
                 SELECT cl.customer_id FROM call_lists cl
                 WHERE cl.assigned_sale_id = $${params.length}::bigint)`;
    }

    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      const clause = `(c.full_name ILIKE $${params.length} OR c.cif_code ILIKE $${params.length})`;
      scope = scope ? `${scope} AND ${clause}` : `WHERE ${clause}`;
    }

    params.push(Math.min(limit, 500));

    return this.prisma.$queryRawUnsafe(
      `SELECT c.id::int AS customer_id, c.full_name, c.cif_code,
              r.product_rank1::text AS product_rank1,
              (SELECT MAX(cl.list_date)::text FROM call_lists cl WHERE cl.customer_id = c.id) AS last_list_date
       FROM customers c
       LEFT JOIN LATERAL (
         SELECT product_rank1 FROM recommendations
         WHERE customer_id = c.id ORDER BY version DESC LIMIT 1
       ) r ON true
       ${scope}
       ORDER BY c.full_name
       LIMIT $${params.length}`,
      ...params,
    );
  }

  /** GET /api/nba/customer/:id — đề xuất mới nhất + staleness + versions[] */
  async getCustomer(customerId: number, user: AuthenticatedUser): Promise<CustomerDetail> {
    await this._assertCanAccessCustomer(customerId, user);

    const [cust] = await this.prisma.$queryRawUnsafe<Array<{ full_name: string; cif_code: string }>>(
      `SELECT full_name, cif_code FROM customers WHERE id = $1::bigint`,
      customerId,
    );
    if (!cust) throw new NotFoundException(`Khách hàng ${customerId} không tồn tại`);

    const [rec] = await this.prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT id::text, version, source, created_at, product_rank1, hook1, explain1,
              product_rank2, hook2, explain2, rules_applied, weights_versions,
              input_snapshot, input_snapshot_hash
       FROM recommendations
       WHERE customer_id = $1::bigint
       ORDER BY version DESC LIMIT 1`,
      customerId,
    );

    const versions = await this.prisma.$queryRawUnsafe<
      Array<{ version: number; created_at: string; source: string }>
    >(
      `SELECT version, created_at, source FROM recommendations
       WHERE customer_id = $1::bigint ORDER BY version DESC`,
      customerId,
    );

    const staleness = rec ? await this._staleness(customerId, rec) : { flag: false, fields: [] };

    await this._audit(user, 'view', 'customer', customerId, { rec_id: rec?.id ?? null });

    return {
      customer_id: customerId,
      full_name: cust.full_name,
      cif_code: cust.cif_code ?? '',
      recommendation: rec ?? null,
      versions,
      staleness,
    };
  }

  /**
   * Staleness check B4: so 3 chỉ số neo trong snapshot vs live.
   * Pipeline ghi input_snapshot = { features: {...}, tags: [...] } nên phải bóc lớp `features`
   * (bản cũ đọc thẳng cấp 1 → luôn -1 → staleness không bao giờ kích hoạt).
   */
  private async _staleness(
    customerId: number,
    rec: Record<string, unknown>,
  ): Promise<{ flag: boolean; fields: string[] }> {
    const raw = (rec.input_snapshot ?? {}) as Record<string, unknown>;
    const snapshot = ((raw.features as Record<string, unknown>) ?? raw) ?? {};

    const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : -1);
    const snapCasa = num(snapshot['casa_avg']);
    const snapDebt = num(snapshot['total_debt']);
    const snapFlags = Array.isArray(snapshot['product_flags'])
      ? [...(snapshot['product_flags'] as string[])].map(String).sort()
      : null;

    const [live] = await this.prisma.$queryRawUnsafe<
      Array<{ casa_avg: number; total_debt: number; product_flags: string }>
    >(
      `SELECT
         COALESCE(AVG(a.balance),0)::float AS casa_avg,
         COALESCE(SUM(l.outstanding),0)::float AS total_debt,
         COALESCE(jsonb_agg(DISTINCT cp.product) FILTER (WHERE cp.product IS NOT NULL),'[]'::jsonb)::text AS product_flags
       FROM customers c
       LEFT JOIN accounts a ON a.customer_id=c.id AND a.acct_type='casa'::account_type
       LEFT JOIN loans l ON l.customer_id=c.id
       LEFT JOIN customer_products cp ON cp.customer_id=c.id AND cp.status='active'
       WHERE c.id=$1::bigint
       GROUP BY c.id`,
      customerId,
    );
    if (!live) return { flag: false, fields: [] };

    const fields: string[] = [];
    if (snapCasa >= 0 && Math.abs(live.casa_avg - snapCasa) / (snapCasa || 1) > STALE_CASA_PCT) {
      fields.push('casa_avg');
    }
    if (snapDebt >= 0 && Math.abs(live.total_debt - snapDebt) / (snapDebt || 1) > STALE_DEBT_PCT) {
      fields.push('total_debt');
    }
    if (snapFlags) {
      // So sánh theo tập hợp đã sắp xếp — jsonb_agg không đảm bảo thứ tự.
      let liveFlags: string[] = [];
      try {
        liveFlags = (JSON.parse(live.product_flags) as string[]).map(String).sort();
      } catch {
        liveFlags = [];
      }
      if (liveFlags.join('|') !== snapFlags.join('|')) fields.push('product_flags');
    }

    return { flag: fields.length > 0, fields };
  }

  /**
   * POST /api/feedback
   * - rec_id là BIGINT (không cast ::uuid như bản cũ).
   * - feedback.product NOT NULL: nếu client không gửi thì lấy product_rank1 của đề xuất.
   * - KHÔNG insert suppressions ở đây: trigger `auto_suppression` đã làm (kèm from_feedback_id).
   */
  async submitFeedback(body: {
    rec_id: string;
    sale_id: number;
    status: string;
    product?: string;
    reject_reason?: string;
    note?: string;
  }): Promise<{ ok: boolean; suppressed: boolean }> {
    const [rec] = await this.prisma.$queryRawUnsafe<
      Array<{ customer_id: number; product_rank1: string; product_rank2: string | null }>
    >(
      `SELECT customer_id::int AS customer_id, product_rank1::text, product_rank2::text
       FROM recommendations WHERE id = $1::bigint`,
      body.rec_id,
    );
    if (!rec) throw new NotFoundException(`Đề xuất ${body.rec_id} không tồn tại`);

    const product = body.product ?? rec.product_rank1;
    if (body.status === 'rejected' && !body.reject_reason) {
      // CHECK constraint feedback_check sẽ chặn — báo lỗi rõ ràng ở tầng API.
      throw new BadRequestException('reject_reason là bắt buộc khi status = rejected');
    }

    await this.prisma.$queryRawUnsafe(
      `INSERT INTO feedback(rec_id, sale_id, product, status, reject_reason, note, source)
       VALUES($1::bigint,$2::bigint,$3::product_enum,$4::feedback_status,$5,$6,'checkbox'::feedback_source)`,
      body.rec_id,
      body.sale_id,
      product,
      body.status,
      body.reject_reason ?? null,
      body.note ?? null,
    );

    // R5: trigger auto_suppression tự chèn suppression 90 ngày khi status='rejected'.
    return { ok: true, suppressed: body.status === 'rejected' };
  }

  /** POST /api/admin/calllist — assign khách cho sale. created_by = người thực hiện assign. */
  async assignCallList(
    date: string,
    assignments: Array<{ customer_id: number; sale_id: number }>,
    actorId: number,
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
        actorId,
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
  async auditRecommendation(
    recId: string,
    user: AuthenticatedUser,
  ): Promise<Record<string, unknown>> {
    const [rec] = await this.prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT id::text, customer_id::int AS customer_id, version, source, created_at,
              product_rank1, product_rank2, rules_applied, weights_versions,
              input_snapshot_hash, input_snapshot
       FROM recommendations WHERE id=$1::bigint`,
      recId,
    );
    if (!rec) throw new NotFoundException(`Đề xuất ${recId} không tồn tại`);

    await this._assertCanAccessCustomer(Number(rec.customer_id), user);

    const feedback = await this.prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT id::text, sale_id::text, product::text, status::text, reject_reason, created_at
       FROM feedback WHERE rec_id=$1::bigint ORDER BY created_at`,
      recId,
    );

    await this._audit(user, 'view', 'recommendation', recId, { customer_id: rec.customer_id });

    return { ...rec, feedback };
  }

  async saveCallNote(
    customerId: number,
    saleId: number,
    noteText: string,
    user: AuthenticatedUser,
  ): Promise<{ ok: boolean; noteId: number }> {
    await this._assertCanAccessCustomer(customerId, user);
    const [row] = await this.prisma.$queryRawUnsafe<Array<{ id: number }>>(
      `INSERT INTO call_notes(customer_id, sale_id, note_text)
       VALUES($1::bigint, $2::bigint, $3) RETURNING id::int AS id`,
      customerId,
      saleId,
      noteText,
    );
    await this._audit(user, 'create', 'call_note', row?.id ?? 0, { customer_id: customerId });
    return { ok: true, noteId: row?.id ?? 0 };
  }

  async getCallNotes(customerId: number, user: AuthenticatedUser) {
    await this._assertCanAccessCustomer(customerId, user);
    return this.prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT cn.id::int AS id, cn.customer_id::int AS customer_id, cn.sale_id::int AS sale_id,
              cn.note_text, cn.created_at, u.full_name AS sale_name
       FROM call_notes cn
       LEFT JOIN users u ON u.id = cn.sale_id
       WHERE cn.customer_id = $1::bigint
       ORDER BY cn.created_at DESC`,
      customerId,
    );
  }
}
