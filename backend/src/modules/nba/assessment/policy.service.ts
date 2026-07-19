/**
 * Chấm từng GÓI sản phẩm theo policy + rule, xuất bảng đạt/không đạt làm "lý do" cho sale.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Bộ rule R1..R12 và các ngưỡng được giữ tập trung trong service này để backend
 * có thể chạy độc lập ở chế độ rules.
 * Ngưỡng gom hết vào RULE_PARAMS bên dưới để chỗ cần đồng bộ là duy nhất.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Policy nằm ở CẤP GÓI (product_catalog: 16 gói), không phải cấp sản phẩm — cùng một
 * sản phẩm `vay` có gói age_min=18 và gói age_min=20. Vì vậy chấm theo gói rồi mới cuộn lên.
 */
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../database/prisma.service';
import type {
  CriterionResult,
  CurrentPosition,
  PackageAssessment,
  RelationshipSummary,
} from './assessment.types';

/** Các ngưỡng nghiệp vụ dùng chung cho toàn bộ policy rules. */
export const RULE_PARAMS = {
  /** R1 — CIC từ nhóm này trở lên là chặn. */
  cicBlockFrom: 2,
  /** R3 — DTI vượt ngưỡng là chặn. */
  dtiMax: 0.6,
  /** R6 — tiếp cận trong vòng bấy nhiêu ngày thì hoãn toàn bộ khách. */
  contactCooldownDays: 14,
  /** R11 — đã đóng phí bảo hiểm nơi khác thì nhân hệ số này. */
  insuranceElsewhereMultiplier: 0.5,
} as const;

/** R1/R3 chỉ chặn nhóm sản phẩm tín dụng; R2 chặn đầu tư. */
const R1_PRODUCTS = ['vay', 'the'];
const R2_PRODUCTS = ['dautu'];
const R3_PRODUCTS = ['vay', 'the'];

interface CatalogRow {
  product: string;
  package: string;
  tier: string | null;
  min_balance: number | null;
  age_min: number | null;
  age_max: number | null;
  limit_min: number | null;
  limit_max: number | null;
}

const VND = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });
const money = (v: number | null): string =>
  v === null ? 'không có dữ liệu' : `${VND.format(v)} đ`;

@Injectable()
export class PolicyService {
  constructor(private readonly prisma: PrismaService) {}

  async evaluate(
    customerId: number,
    current: CurrentPosition,
    relationship: RelationshipSummary,
    tags: Set<string>,
    month: string,
  ): Promise<PackageAssessment[]> {
    const catalog = await this.prisma.$queryRawUnsafe<CatalogRow[]>(
      `SELECT product::text AS product, package, tier,
              min_balance::float AS min_balance, age_min::int AS age_min, age_max::int AS age_max,
              limit_min::float AS limit_min, limit_max::float AS limit_max
       FROM product_catalog WHERE active ORDER BY product, package`,
    );

    const kpi = await this.prisma.$queryRawUnsafe<Array<{ product: string; multiplier: number }>>(
      `SELECT product::text AS product, multiplier::float AS multiplier
       FROM kpi_weights WHERE month=$1`,
      month,
    );
    const kpiByProduct = new Map(kpi.map((k) => [k.product, k.multiplier]));

    const heldProducts = new Set(relationship.held_products.map((h) => h.product));
    const heldPairs = new Set(
      relationship.held_products.map((h) => `${h.product}::${h.tier ?? ''}`),
    );
    const suppressedProducts = new Set(relationship.suppressed.map((s) => s.product));

    return catalog
      .map((row) =>
        this.evaluatePackage(
          row,
          current,
          relationship,
          heldProducts,
          heldPairs,
          suppressedProducts,
          tags,
          kpiByProduct,
        ),
      )
      .sort((a, b) => {
        if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
        return this.passCount(b) - this.passCount(a);
      });
  }

  /**
   * Rule chặn ở cấp khách hàng — trong rules.py là những RuleHit có `product=None`.
   * Kích một cái là hoãn tiếp cận toàn bộ khách, nhưng KHÔNG có nghĩa các gói tự nhiên
   * mất phù hợp — nên tách ra để sale vẫn thấy được gói nào vốn đạt tiêu chí.
   */
  customerBlocks(relationship: RelationshipSummary): CriterionResult[] {
    const days = relationship.last_contact_days;
    const inCooldown = days !== null && days < RULE_PARAMS.contactCooldownDays;

    return [
      {
        code: 'R6',
        label: 'Giãn cách từ lần tiếp cận trước',
        passed: !inCooldown,
        actual: days === null ? 'chưa từng tiếp cận' : `tiếp cận ${days} ngày trước`,
        required: `cách tối thiểu ${RULE_PARAMS.contactCooldownDays} ngày`,
        source: 'rule',
        blocking: true,
      },
    ];
  }

  private passCount(p: PackageAssessment): number {
    return p.criteria.filter((c) => c.passed).length;
  }

  private evaluatePackage(
    row: CatalogRow,
    current: CurrentPosition,
    relationship: RelationshipSummary,
    heldProducts: Set<string>,
    heldPairs: Set<string>,
    suppressedProducts: Set<string>,
    tags: Set<string>,
    kpiByProduct: Map<string, number>,
  ): PackageAssessment {
    const criteria: CriterionResult[] = [];
    const add = (c: CriterionResult) => criteria.push(c);

    // ── Policy cấp gói (product_catalog) ────────────────────────────────────
    // R10 — dải tuổi
    if (row.age_min !== null || row.age_max !== null) {
      const lo = row.age_min ?? 0;
      const hi = row.age_max ?? 200;
      const age = current.age;
      add({
        code: 'R10',
        label: 'Độ tuổi trong dải sản phẩm',
        // Thiếu ngày sinh thì KHÔNG kết luận đạt — coi như chưa đủ căn cứ.
        passed: age !== null && age >= lo && age <= hi,
        actual: age === null ? 'chưa có ngày sinh' : `${age} tuổi`,
        required: `${lo}–${hi} tuổi`,
        source: 'catalog',
        blocking: true,
      });
    }

    // R9 — số dư tối thiểu
    if (row.min_balance !== null) {
      add({
        code: 'R9',
        label: 'Số dư tối thiểu',
        passed: current.casa_avg !== null && current.casa_avg >= row.min_balance,
        actual: `số dư hiện tại ${money(current.casa_avg)}`,
        required: `từ ${money(row.min_balance)}`,
        source: 'catalog',
        blocking: true,
      });
    }

    // ── Rule R1..R8, R11, R12 ───────────────────────────────────────────────
    if (R1_PRODUCTS.includes(row.product)) {
      add({
        code: 'R1',
        label: 'Nhóm nợ CIC',
        passed: current.cic_group !== null && current.cic_group < RULE_PARAMS.cicBlockFrom,
        actual: current.cic_group === null ? 'chưa có dữ liệu CIC' : `nhóm ${current.cic_group}`,
        required: `dưới nhóm ${RULE_PARAMS.cicBlockFrom}`,
        source: 'rule',
        blocking: true,
      });
    }

    if (R2_PRODUCTS.includes(row.product)) {
      add({
        code: 'R2',
        label: 'Không có nợ thẻ quá hạn',
        passed: !current.has_overdue,
        actual: current.has_overdue ? 'đang có khoản quá hạn' : 'không có khoản quá hạn',
        required: 'không quá hạn',
        source: 'rule',
        blocking: true,
      });
    }

    if (R3_PRODUCTS.includes(row.product)) {
      add({
        code: 'R3',
        label: 'Tỷ lệ nợ trên thu nhập (DTI)',
        passed: current.dti !== null && current.dti <= RULE_PARAMS.dtiMax,
        actual:
          current.dti === null ? 'chưa có thu nhập để tính' : `${(current.dti * 100).toFixed(1)}%`,
        required: `tối đa ${RULE_PARAMS.dtiMax * 100}%`,
        source: 'rule',
        blocking: true,
      });
    }

    // R4 — đã giữ sản phẩm cùng hạng
    const sameTierHeld = heldPairs.has(`${row.product}::${row.tier ?? ''}`);
    add({
      code: 'R4',
      label: 'Chưa giữ sản phẩm cùng hạng',
      passed: !sameTierHeld,
      actual: sameTierHeld
        ? `đã có ${row.product} hạng ${row.tier ?? '—'}`
        : heldProducts.has(row.product)
          ? `có ${row.product} nhưng khác hạng`
          : 'chưa có sản phẩm này',
      required: 'chưa có cùng hạng',
      source: 'rule',
      blocking: true,
    });

    // R5 — đã từ chối gần đây
    const isSuppressed = suppressedProducts.has(row.product);
    add({
      code: 'R5',
      label: 'Không nằm trong thời gian tạm hoãn',
      passed: !isSuppressed,
      actual: isSuppressed
        ? `đã từ chối, hoãn tới ${relationship.suppressed.find((s) => s.product === row.product)?.until_date ?? '—'}`
        : 'không bị hoãn',
      required: 'ngoài thời gian hoãn',
      source: 'rule',
      blocking: true,
    });

    // R6/R7 chặn ở cấp khách — xem customerBlocks(), không tính vào từng gói.

    // ── Hệ số nhân (không chặn) ─────────────────────────────────────────────
    let multiplier = 1.0;
    if (row.product === 'baohiem' && tags.has('tag_dong_phi_bh')) {
      multiplier *= RULE_PARAMS.insuranceElsewhereMultiplier;
      add({
        code: 'R11',
        label: 'Đã đóng phí bảo hiểm nơi khác',
        passed: false,
        actual: `có dấu hiệu đóng phí nơi khác → hệ số ×${RULE_PARAMS.insuranceElsewhereMultiplier}`,
        required: 'không đóng phí nơi khác',
        source: 'rule',
        blocking: false,
      });
    }
    const kpiMult = kpiByProduct.get(row.product);
    if (kpiMult !== undefined && kpiMult !== 1.0) {
      multiplier *= kpiMult;
      add({
        code: 'R12',
        label: 'Hệ số KPI tháng',
        passed: kpiMult > 1.0,
        actual: `×${kpiMult}`,
        required: 'do quản lý đặt',
        source: 'rule',
        blocking: false,
      });
    }

    const blockedBy = criteria.filter((c) => c.blocking && !c.passed).map((c) => c.code);

    return {
      product: row.product,
      package: row.package,
      tier: row.tier,
      eligible: blockedBy.length === 0,
      criteria,
      multiplier: Number(multiplier.toFixed(3)),
      blocked_by: blockedBy,
    };
  }
}
