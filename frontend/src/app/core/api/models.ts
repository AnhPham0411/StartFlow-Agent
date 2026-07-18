import type {
  AgentPlanTask,
  AgentResult,
  ComparisonMetric,
  FinalDecision,
  RunEvent,
} from '@startflow/contracts';

export type RunStatus =
  'PENDING' | 'PLANNING' | 'RUNNING' | 'AWAITING_APPROVAL' | 'COMPLETED' | 'PARTIAL' | 'FAILED';

export interface RunSummary {
  id: string;
  caseId: string;
  status: RunStatus;
  createdAt: string;
  completedAt: string | null;
  finalDecisionStatus: FinalDecision['status'] | null;
}

export interface CaseSummary {
  id: string;
  companyName: string;
  registrationNumber: string;
  requestedAmount: number;
  purpose: string;
  createdAt: string;
  latestRun: RunSummary | null;
  runCount: number;
}

export interface FinancialSnapshot {
  revenue: number;
  ebitda: number;
  totalDebt: number;
  equity: number;
  currentAssets: number;
  currentLiabilities: number;
}

export interface CaseDetail extends CaseSummary {
  createdBy: string;
  demoData: true;
  financials: FinancialSnapshot;
  submittedDocuments: string[];
  runs: RunSummary[];
}

export interface ApprovalRecord {
  id: string;
  decision: 'APPROVE' | 'REJECT';
  reason: string;
  createdAt: string;
  createdBy: string;
}

export interface RunDetail extends RunSummary {
  version: number;
  plan: AgentPlanTask[];
  agentResults: AgentResult[];
  finalDecision: FinalDecision | null;
  events: RunEvent[];
  approval: ApprovalRecord | null;
  actionTicket: { id: string; title: string; createdAt: string } | null;
  caseSnapshot?: { companyName: string; requestedAmount: number; purpose: string };
}

export interface ComparisonResult {
  id: string;
  caseId: string;
  createdAt?: string;
  metrics: ComparisonMetric[];
  singleAgentRunId?: string;
  multiAgentRunId?: string;
}

export interface KnowledgeDocument {
  id: string;
  title: string;
  domain: 'credit' | 'compliance' | 'operations' | string;
  sectionCount?: number;
  chunkCount?: number;
  status?: 'READY' | 'PROCESSING' | 'FAILED';
  createdAt: string;
  demoData?: boolean;
}
