/**
 * Kiểu cho kết quả đánh giá 3/6 tháng. Giữ khớp với
 * backend/src/modules/nba/assessment/assessment.types.ts
 */

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

export interface NbaTrend {
  net_flow_pct: number | null;
  txn_count_pct: number | null;
  total_in_pct: number | null;
  direction: 'up' | 'down' | 'flat';
}

export interface NbaRelationship {
  held_products: Array<{ product: string; tier: string | null; since: string | null }>;
  suppressed: Array<{ product: string; until_date: string; reason: string }>;
  last_contact_days: number | null;
  last_feedback: { status: string; product: string; created_at: string } | null;
  note_count: number;
}

export interface NbaCriterion {
  code: string;
  label: string;
  passed: boolean;
  actual: string;
  required: string;
  source: 'catalog' | 'rule';
  blocking: boolean;
}

export interface NbaPackageAssessment {
  product: string;
  package: string;
  tier: string | null;
  eligible: boolean;
  criteria: NbaCriterion[];
  multiplier: number;
  blocked_by: string[];
}

export interface NbaDriftItem {
  product: string;
  package: string;
  code: string;
  label: string;
  was: boolean;
  now: boolean;
}

export interface NbaAssessment {
  customer_id: number;
  as_of: string;
  current: NbaCurrentPosition;
  window_3m: NbaWindowSummary;
  window_6m: NbaWindowSummary;
  trend: NbaTrend;
  relationship: NbaRelationship;
  customer_blocks: NbaCriterion[];
  packages: NbaPackageAssessment[];
  drift: NbaDriftItem[];
  explanation: {
    mode: 'rules' | 'llm' | 'model';
    evidence: string[];
    narrative: string | null;
    degraded_reason: string | null;
  };
}
