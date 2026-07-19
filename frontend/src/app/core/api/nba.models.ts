export type NbaProduct = 'the' | 'vay' | 'dautu' | 'baohiem' | 'taikhoan';

export type NbaFeedbackStatus = 'success' | 'rejected' | 'no_contact' | 'callback';

export interface NbaCallListEntry {
  customer_id: number;
  name: string;
  cif_code: string;
  phone?: string;
  assigned_sale_id?: string | null;
  product_rank1?: NbaProduct | null;
  product_rank2?: NbaProduct | null;
  score_rank1?: number | null;
  score_rank2?: number | null;
  rec_id?: string | null;
  rec_version?: number | null;
}

export interface NbaRecommendation {
  id: string;
  version: number;
  source: string;
  created_at: string;
  product_rank1: NbaProduct | null;
  hook1: string | null;
  explain1: string | null;
  product_rank2: NbaProduct | null;
  hook2: string | null;
  explain2: string | null;
  rules_applied: unknown;
  weights_versions: unknown;
  input_snapshot: unknown;
  input_snapshot_hash: string | null;
}

export interface NbaRecommendationVersion {
  version: number;
  created_at: string;
  source: string;
}

export interface NbaCustomerDetail {
  customer_id: number;
  full_name: string;
  cif_code: string;
  recommendation: NbaRecommendation | null;
  versions: NbaRecommendationVersion[];
  staleness: { flag: boolean; fields: string[] };
}

export interface NbaWindowSummary {
  months: 3 | 6;
  from_date: string;
  to_date: string;
  total_in: number;
  total_out: number;
  net_flow: number;
  txn_count: number;
  txn_per_month: number;
  max_txn_amount: number | null;
  active_months: number;
  spend_tags: Array<{ tag: string; txn_count: number }>;
  loans_opened: number;
  products_opened: number;
}

export interface NbaCurrentPosition {
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

export interface NbaCriterionResult {
  code: string;
  label: string;
  passed: boolean;
  actual: string;
  required: string;
  source: 'catalog' | 'rule';
  blocking: boolean;
}

export interface NbaPackageAssessment {
  product: NbaProduct;
  package: string;
  tier: string | null;
  eligible: boolean;
  criteria: NbaCriterionResult[];
  multiplier: number;
  blocked_by: string[];
}

export interface NbaAssessmentResult {
  customer_id: number;
  as_of: string;
  current: NbaCurrentPosition;
  window_3m: NbaWindowSummary;
  window_6m: NbaWindowSummary;
  trend: {
    net_flow_pct: number | null;
    txn_count_pct: number | null;
    total_in_pct: number | null;
    direction: 'up' | 'down' | 'flat';
  };
  relationship: {
    held_products: Array<{ product: NbaProduct; tier: string | null; since: string | null }>;
    suppressed: Array<{ product: NbaProduct; until_date: string; reason: string }>;
    last_contact_days: number | null;
    last_feedback: { status: string; product: NbaProduct; created_at: string } | null;
    note_count: number;
  };
  customer_blocks: NbaCriterionResult[];
  packages: NbaPackageAssessment[];
  drift: Array<{
    product: NbaProduct;
    package: string;
    code: string;
    label: string;
    was: boolean;
    now: boolean;
  }>;
  explanation: {
    mode: 'rules' | 'llm' | 'model';
    evidence: string[];
    narrative: string | null;
    degraded_reason: string | null;
  };
}

export interface NbaFeedbackInput {
  rec_id: string;
  status: NbaFeedbackStatus;
  product?: NbaProduct;
  reject_reason?: string;
  note?: string;
}

export interface NbaCallNote {
  id: number;
  customer_id: number;
  sale_id: number;
  note_text: string;
  created_at: string;
  sale_name: string | null;
}

export interface NbaRecommendationAudit extends Record<string, unknown> {
  id: string;
  customer_id: number;
  version: number;
  source: string;
  created_at: string;
  feedback: Array<Record<string, unknown>>;
}
