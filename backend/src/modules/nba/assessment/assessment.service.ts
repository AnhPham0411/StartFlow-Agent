/**
 * Ghép tổng hợp 3/6 tháng + chấm policy thành kết quả đánh giá cho sale.
 *
 * Luồng: tổng hợp cửa sổ → chấm từng gói → dựng chuỗi bằng chứng (xác định)
 *        → so với snapshot batch để tìm tiêu chí đã đổi → (tuỳ mode) nhờ explainer viết câu.
 */
import { Inject, Injectable } from '@nestjs/common';

import { PrismaService } from '../../../database/prisma.service';
import type { AssessmentResult, DriftItem, PackageAssessment } from './assessment.types';
import { PolicyService } from './policy.service';
import { WindowsService } from './windows.service';
import {
  ASSESSMENT_EXPLAINER,
  type AssessmentExplainer,
  type ExplainInput,
} from './explainer/explainer.interface';

const VND = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });
const TOP_PACKAGES = 5;

@Injectable()
export class AssessmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly windows: WindowsService,
    private readonly policy: PolicyService,
    @Inject(ASSESSMENT_EXPLAINER) private readonly explainer: AssessmentExplainer,
  ) {}

  async assess(customerId: number, asOf?: string): Promise<AssessmentResult> {
    const asOfDate = asOf ?? new Date().toISOString().slice(0, 10);
    const month = asOfDate.slice(0, 7);

    const [current, window3m, window6m, trend, relationship] = await Promise.all([
      this.windows.currentPosition(customerId),
      this.windows.window(customerId, 3, asOfDate),
      this.windows.window(customerId, 6, asOfDate),
      this.windows.trend(customerId, asOfDate),
      this.windows.relationship(customerId),
    ]);

    const tags = await this.loadTags(customerId);
    const packages = await this.policy.evaluate(customerId, current, relationship, tags, month);
    const customerBlocks = this.policy.customerBlocks(relationship);
    const drift = await this.detectDrift(customerId, packages);

    const evidence = this.buildEvidence(current, window3m, window6m, trend, relationship, packages);

    const eligible = packages.filter((p) => p.eligible).slice(0, TOP_PACKAGES);
    const explainInput: ExplainInput = {
      customerId,
      ref: `KH-${String(customerId).padStart(6, '0')}`, // che PII: không gửi tên/CIF
      top: eligible,
      current,
      window3m,
      window6m,
      trend,
      evidence,
    };
    const { narrative, degradedReason } = await this.explainer.explain(explainInput);

    return {
      customer_id: customerId,
      as_of: asOfDate,
      current,
      window_3m: window3m,
      window_6m: window6m,
      trend,
      relationship,
      customer_blocks: customerBlocks,
      packages,
      drift,
      explanation: {
        mode: this.explainer.mode,
        evidence,
        narrative,
        degraded_reason: degradedReason,
      },
    };
  }

  private async loadTags(customerId: number): Promise<Set<string>> {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ tag: string }>>(
      `SELECT tag FROM customer_tags WHERE customer_id=$1::bigint`,
      customerId,
    );
    return new Set(rows.map((r) => r.tag));
  }

  /**
   * Chuỗi bằng chứng — nguồn số liệu DUY NHẤT cho lời giải thích.
   * Explainer không được dùng con số nào ngoài danh sách này (postCheck sẽ chặn).
   */
  private buildEvidence(
    current: AssessmentResult['current'],
    w3: AssessmentResult['window_3m'],
    w6: AssessmentResult['window_6m'],
    trend: AssessmentResult['trend'],
    rel: AssessmentResult['relationship'],
    packages: PackageAssessment[],
  ): string[] {
    const out: string[] = [];

    if (current.casa_avg !== null) {
      out.push(`Số dư tài khoản hiện tại: ${VND.format(Math.round(current.casa_avg))} đ`);
    }
    out.push(
      `Dòng tiền vào 3 tháng gần nhất: ${VND.format(Math.round(w3.total_in))} đ ` +
        `(${w3.txn_count} giao dịch, trung bình ${w3.txn_per_month} lần/tháng)`,
    );
    out.push(`Dòng tiền vào 6 tháng: ${VND.format(Math.round(w6.total_in))} đ`);

    if (trend.direction !== 'flat' && trend.net_flow_pct !== null) {
      const word = trend.direction === 'up' ? 'tăng' : 'giảm';
      out.push(`Dòng tiền ròng 3 tháng gần ${word} ${Math.abs(trend.net_flow_pct)}% so với 3 tháng trước`);
    }
    if (w3.active_months > 0) {
      out.push(`Có giao dịch ở ${w3.active_months} trên 3 tháng gần nhất`);
    }
    if (w6.max_txn_amount !== null) {
      out.push(`Giao dịch lớn nhất 6 tháng: ${VND.format(Math.round(w6.max_txn_amount))} đ`);
    }
    if (w3.spend_tags.length > 0) {
      out.push(`Nhóm chi tiêu nổi bật: ${w3.spend_tags.map((t) => t.tag).join(', ')}`);
    }

    if (current.dti !== null) {
      out.push(`Tỷ lệ nợ trên thu nhập: ${(current.dti * 100).toFixed(1)}%`);
    }
    if (current.total_debt > 0) {
      out.push(`Tổng dư nợ hiện tại: ${VND.format(Math.round(current.total_debt))} đ`);
    }
    if (current.cic_group !== null) {
      out.push(`Nhóm nợ CIC: nhóm ${current.cic_group}`);
    }

    if (rel.held_products.length > 0) {
      out.push(`Đang dùng: ${rel.held_products.map((h) => h.product).join(', ')}`);
    } else {
      out.push('Chưa dùng sản phẩm nào ngoài tài khoản cơ bản');
    }
    if (rel.last_contact_days !== null) {
      out.push(`Lần tiếp cận gần nhất: ${rel.last_contact_days} ngày trước`);
    }

    const top = packages.find((p) => p.eligible);
    if (top) {
      const passed = top.criteria.filter((c) => c.passed).length;
      out.push(`Gói "${top.package}" đạt ${passed} trên ${top.criteria.length} tiêu chí xét duyệt`);
    }

    return out;
  }

  /**
   * So kết quả chấm hiện tại với `rules_applied` của đề xuất batch gần nhất.
   * Mục đích: chỉ ra tiêu chí đã đổi trạng thái kể từ khi có đề xuất — staleness chi tiết.
   * KHÔNG ghi đè `recommendations` (bảng append-only).
   */
  private async detectDrift(
    customerId: number,
    packages: PackageAssessment[],
  ): Promise<DriftItem[]> {
    const [rec] = await this.prisma.$queryRawUnsafe<Array<{ rules_applied: string[] | null }>>(
      `SELECT rules_applied FROM recommendations
       WHERE customer_id=$1::bigint ORDER BY version DESC LIMIT 1`,
      customerId,
    );
    if (!rec?.rules_applied) return [];

    // rules_applied liệt kê rule ĐÃ KÍCH lúc batch (tức là lúc đó KHÔNG đạt).
    const firedAtBatch = new Set(rec.rules_applied);
    const drift: DriftItem[] = [];

    for (const pkg of packages) {
      for (const c of pkg.criteria) {
        if (!c.blocking) continue;
        const wasBlocked = firedAtBatch.has(c.code);
        const nowBlocked = !c.passed;
        if (wasBlocked !== nowBlocked) {
          drift.push({
            product: pkg.product,
            package: pkg.package,
            code: c.code,
            label: c.label,
            was: !wasBlocked,
            now: !nowBlocked,
          });
        }
      }
    }
    return drift;
  }
}
