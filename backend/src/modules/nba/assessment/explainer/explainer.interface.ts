/**
 * Seam đổi "bộ não" viết lời giải thích mà không thay đổi policy xác định.
 *
 * Bất biến quan trọng: bảng tiêu chí đạt/không đạt do `PolicyService` tính bằng code,
 * KHÔNG bao giờ do LLM quyết. Explainer chỉ nhận bảng đã chấm rồi diễn đạt lại thành câu.
 * Nhờ vậy khi tắt LLM (mode `rules`) chức năng vẫn chạy đủ, chỉ mất phần câu chữ mượt.
 */
import type { AssessmentResult, PackageAssessment } from '../assessment.types';

export interface ExplainInput {
  customerId: number;
  /** Đã che PII: chỉ mã tham chiếu, không tên/CIF/số điện thoại. */
  ref: string;
  top: PackageAssessment[];
  current: AssessmentResult['current'];
  window3m: AssessmentResult['window_3m'];
  window6m: AssessmentResult['window_6m'];
  trend: AssessmentResult['trend'];
  /** Chuỗi bằng chứng đã suy diễn xác định — nguồn duy nhất cho phần số liệu. */
  evidence: string[];
}

export interface ExplainOutput {
  narrative: string | null;
  degradedReason: string | null;
}

export interface AssessmentExplainer {
  readonly mode: 'rules' | 'llm' | 'model';
  explain(input: ExplainInput): Promise<ExplainOutput>;
}

export const ASSESSMENT_EXPLAINER = Symbol('ASSESSMENT_EXPLAINER');
