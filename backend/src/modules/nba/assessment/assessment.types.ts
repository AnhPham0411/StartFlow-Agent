/**
 * Kiểu dữ liệu cho chức năng "Đánh giá khách 3/6 tháng + vì sao phù hợp sản phẩm".
 *
 * Nguyên tắc: bảng tiêu chí đạt/không đạt LUÔN do code tính (xác định, tái lập được).
 * LLM — nếu bật — chỉ diễn đạt lại bảng đó thành câu cho sale đọc, không được đổi kết luận.
 */

/**
 * Một cửa sổ thời gian (3 hoặc 6 tháng) — CHỈ chứa thứ thật sự cắt được theo thời gian.
 *
 * Lưu ý dữ liệu: `accounts.balance` là số dư tại thời điểm hiện tại (chỉ có `updated_at`),
 * không có bảng lịch sử số dư, nên KHÔNG thể tính "số dư trung bình 3 tháng". Những chỉ số
 * dạng tồn (số dư, dư nợ, DTI, CIC) nằm ở `CurrentPosition` và được ghi rõ là "hiện tại".
 */
export interface WindowSummary {
  months: 3 | 6;
  from_date: string;
  to_date: string;

  /** Nhóm 1 — dòng tiền (cộng dồn giao dịch trong cửa sổ) */
  total_in: number;
  total_out: number;
  net_flow: number;

  /** Nhóm 2 — hành vi giao dịch */
  txn_count: number;
  txn_per_month: number;
  max_txn_amount: number | null;
  active_months: number;
  spend_tags: Array<{ tag: string; txn_count: number }>;

  /** Nhóm 3 — biến động tín dụng phát sinh trong cửa sổ */
  loans_opened: number;
  products_opened: number;
}

/**
 * Chỉ số dạng tồn — luôn là giá trị HIỆN TẠI, không cắt theo cửa sổ được.
 * Tách riêng để UI không hiển thị nhầm thành "trung bình 3 tháng".
 */
export interface CurrentPosition {
  casa_avg: number | null;
  casa_accounts: number;
  total_debt: number;
  monthly_payment: number;
  monthly_income: number | null;
  dti: number | null;
  has_overdue: boolean;
  cic_group: number | null;
  age: number | null;
}

/**
 * Xu hướng = 3 tháng gần nhất so với 3 tháng liền trước đó (tháng 4-6 tính ngược).
 * Đây là lý do phải lấy cả 6 tháng: 3 tháng sau làm mốc so sánh cho 3 tháng đầu.
 */
export interface Trend {
  net_flow_pct: number | null;
  txn_count_pct: number | null;
  total_in_pct: number | null;
  direction: 'up' | 'down' | 'flat';
}

/** Nhóm 4 — sản phẩm đang giữ + lịch sử tiếp cận. */
export interface RelationshipSummary {
  held_products: Array<{ product: string; tier: string | null; since: string | null }>;
  suppressed: Array<{ product: string; until_date: string; reason: string }>;
  last_contact_days: number | null;
  last_feedback: { status: string; product: string; created_at: string } | null;
  note_count: number;
}

/** Một tiêu chí đã chấm — đây chính là "lý do" hiển thị cho sale. */
export interface CriterionResult {
  code: string;
  label: string;
  passed: boolean;
  /** Giá trị thật của khách (đã tính từ 3/6 tháng). */
  actual: string;
  /** Ngưỡng mà policy/rule yêu cầu. */
  required: string;
  /** `catalog` = policy trong product_catalog, `rule` = R1..R12. */
  source: 'catalog' | 'rule';
  /** true khi tiêu chí này chặn cứng (không chỉ trừ điểm). */
  blocking: boolean;
}

/** Kết quả chấm cho 1 gói cụ thể (policy nằm ở cấp gói, không phải cấp sản phẩm). */
export interface PackageAssessment {
  product: string;
  package: string;
  tier: string | null;
  eligible: boolean;
  criteria: CriterionResult[];
  /** Hệ số nhân còn lại sau R11/R12 (1.0 = không đổi). */
  multiplier: number;
  blocked_by: string[];
}

/** Trạng thái tiêu chí đã đổi so với lúc batch ra đề xuất. */
export interface DriftItem {
  product: string;
  package: string;
  code: string;
  label: string;
  was: boolean;
  now: boolean;
}

export interface AssessmentResult {
  customer_id: number;
  as_of: string;
  current: CurrentPosition;
  window_3m: WindowSummary;
  window_6m: WindowSummary;
  trend: Trend;
  relationship: RelationshipSummary;
  /** Chấm theo từng gói, đã sắp: đủ điều kiện trước, trong đó nhiều tiêu chí đạt nhất lên đầu. */
  /**
   * Rule chặn ở CẤP KHÁCH (rules.py trả product=None): R6 giãn cách tiếp cận, R7 đang bị lock.
   * Tách khỏi `packages` vì nếu tính vào từng gói thì một lần chặn sẽ làm rỗng cả 16 gói,
   * sale mất luôn thông tin gói nào vốn phù hợp.
   */
  customer_blocks: CriterionResult[];
  packages: PackageAssessment[];
  /** Tiêu chí đổi trạng thái so với đề xuất batch — staleness ở mức chi tiết. */
  drift: DriftItem[];
  /** Lời giải thích cho sale đọc. `narrative` chỉ có khi EXPLAINER_MODE != rules. */
  explanation: {
    mode: 'rules' | 'llm' | 'model';
    evidence: string[];
    narrative: string | null;
    /** Có lỗi khi gọi LLM/model thì ghi ở đây, UI vẫn hiển thị được phần evidence. */
    degraded_reason: string | null;
  };
}
