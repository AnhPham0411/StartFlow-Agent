import {
  agentPlanTaskSchema,
  agentResultSchema,
  comparisonMetricSchema,
  finalDecisionSchema,
  runEventSchema,
  runStatusSchema,
} from '@startflow/contracts';
import type {
  CaseDetail,
  CaseSummary,
  ComparisonResult,
  KnowledgeDocument,
  RunDetail,
  RunSummary,
} from './models';

interface JsonRecord extends Record<string, unknown> {
  data?: unknown;
  items?: unknown;
  status?: unknown;
  finalDecision?: unknown;
  decision?: unknown;
  id?: unknown;
  caseId?: unknown;
  createdAt?: unknown;
  completedAt?: unknown;
  companyName?: unknown;
  registrationNumber?: unknown;
  requestedAmount?: unknown;
  purpose?: unknown;
  latestRun?: unknown;
  runCount?: unknown;
  financials?: unknown;
  runs?: unknown;
  createdBy?: unknown;
  revenue?: unknown;
  ebitda?: unknown;
  totalDebt?: unknown;
  equity?: unknown;
  currentAssets?: unknown;
  currentLiabilities?: unknown;
  submittedDocuments?: unknown;
  events?: unknown;
  tasks?: unknown;
  plan?: unknown;
  externalTaskId?: unknown;
  agent?: unknown;
  title?: unknown;
  objective?: unknown;
  dependencies?: unknown;
  successCriteria?: unknown;
  result?: unknown;
  snapshot?: unknown;
  approval?: unknown;
  actionTicket?: unknown;
  actorSubject?: unknown;
  reason?: unknown;
  version?: unknown;
  metrics?: unknown;
  comparisonId?: unknown;
  singleAgentRunId?: unknown;
  multiAgentRunId?: unknown;
  domain?: unknown;
  sectionCount?: unknown;
  chunkCount?: unknown;
  demoData?: unknown;
}

export function unwrapPayload<T>(payload: T | { data: T }): T {
  return isRecord(payload) && 'data' in payload ? (payload.data as T) : (payload as T);
}

export function normalizeCollection(payload: unknown): unknown[] {
  const unwrapped = unwrapPayload(payload);
  if (Array.isArray(unwrapped)) return unwrapped;
  if (isRecord(unwrapped) && Array.isArray(unwrapped.items)) return unwrapped.items;
  return [];
}

export function normalizeRunSummary(value: unknown, fallbackCaseId = ''): RunSummary {
  const raw = isRecord(value) ? value : {};
  const status = runStatusSchema.safeParse(raw.status);
  const decision = finalDecisionSchema.safeParse(raw.finalDecision ?? raw.decision);
  return {
    id: asString(raw.id),
    caseId: asString(raw.caseId, fallbackCaseId),
    status: status.success ? status.data : 'PENDING',
    createdAt: asString(raw.createdAt),
    completedAt: typeof raw.completedAt === 'string' ? raw.completedAt : null,
    finalDecisionStatus: decision.success ? decision.data.status : null,
  };
}

export function normalizeCaseSummary(value: unknown): CaseSummary {
  const raw = isRecord(value) ? value : {};
  const id = asString(raw.id);
  return {
    id,
    companyName: asString(raw.companyName, 'Doanh nghiệp demo'),
    registrationNumber: asString(raw.registrationNumber),
    requestedAmount: asNumber(raw.requestedAmount),
    purpose: asString(raw.purpose),
    createdAt: asString(raw.createdAt),
    latestRun: raw.latestRun ? normalizeRunSummary(raw.latestRun, id) : null,
    runCount: asNumber(raw.runCount),
  };
}

export function normalizeCaseDetail(value: unknown): CaseDetail {
  const raw = isRecord(value) ? value : {};
  const summary = normalizeCaseSummary(raw);
  const financials = isRecord(raw.financials) ? raw.financials : {};
  const runs = Array.isArray(raw.runs)
    ? raw.runs.map((run) => normalizeRunSummary(run, summary.id))
    : [];
  return {
    ...summary,
    createdBy: asString(raw.createdBy),
    demoData: true,
    financials: {
      revenue: asNumber(financials.revenue),
      ebitda: asNumber(financials.ebitda),
      totalDebt: asNumber(financials.totalDebt),
      equity: asNumber(financials.equity),
      currentAssets: asNumber(financials.currentAssets),
      currentLiabilities: asNumber(financials.currentLiabilities),
    },
    submittedDocuments: Array.isArray(raw.submittedDocuments)
      ? raw.submittedDocuments.filter((item): item is string => typeof item === 'string')
      : [],
    runs,
    runCount: runs.length || summary.runCount,
    latestRun: runs[0] ?? summary.latestRun,
  };
}

export function normalizeRunDetail(value: unknown): RunDetail {
  const raw = isRecord(value) ? value : {};
  const summary = normalizeRunSummary(raw);
  const events = (Array.isArray(raw.events) ? raw.events : []).flatMap((event) => {
    const parsed = runEventSchema.safeParse(event);
    return parsed.success ? [parsed.data] : [];
  });
  const storedTasks = Array.isArray(raw.tasks) ? raw.tasks : [];
  const rawPlan = isRecord(raw.plan) && Array.isArray(raw.plan.tasks) ? raw.plan.tasks : [];
  const planSource = rawPlan.length
    ? rawPlan
    : storedTasks.map((task) => {
        const item = isRecord(task) ? task : {};
        return {
          id: item.externalTaskId,
          agent: item.agent,
          title: item.title,
          objective: item.objective,
          dependencies: item.dependencies,
          successCriteria: item.successCriteria,
          status: item.status,
        };
      });
  const plan = planSource.flatMap((task) => {
    const parsed = agentPlanTaskSchema.safeParse(task);
    return parsed.success ? [parsed.data] : [];
  });
  const eventResults = events
    .filter((event) => event.type === 'agent.completed')
    .flatMap((event) => {
      const parsed = agentResultSchema.safeParse(event.payload);
      return parsed.success ? [parsed.data] : [];
    });
  const storedResults = storedTasks.flatMap((task) => {
    const parsed = agentResultSchema.safeParse(isRecord(task) ? task.result : undefined);
    return parsed.success ? [parsed.data] : [];
  });
  const decision = finalDecisionSchema.safeParse(raw.decision);
  const snapshotEnvelope = isRecord(raw.snapshot) ? raw.snapshot : {};
  const snapshot = isRecord(snapshotEnvelope.snapshot) ? snapshotEnvelope.snapshot : {};
  const approval = isRecord(raw.approval) ? raw.approval : null;
  const actionTicket = isRecord(raw.actionTicket) ? raw.actionTicket : null;

  return {
    ...summary,
    version: asNumber(raw.version),
    plan,
    agentResults: eventResults.length ? eventResults : storedResults,
    finalDecision: decision.success ? decision.data : null,
    events,
    approval: approval
      ? {
          id: asString(approval.id),
          decision: approval.decision === 'REJECT' ? 'REJECT' : 'APPROVE',
          reason: asString(approval.reason),
          createdAt: asString(approval.createdAt),
          createdBy: asString(approval.actorSubject ?? approval.createdBy),
        }
      : null,
    actionTicket: actionTicket
      ? {
          id: asString(actionTicket.id),
          title: asString(actionTicket.title),
          createdAt: asString(actionTicket.createdAt),
        }
      : null,
    caseSnapshot: snapshot.companyName
      ? {
          companyName: asString(snapshot.companyName),
          requestedAmount: asNumber(snapshot.requestedAmount),
          purpose: asString(snapshot.purpose),
        }
      : undefined,
  };
}

export function normalizeComparison(value: unknown, caseId: string): ComparisonResult {
  const raw = isRecord(value) ? value : {};
  const metrics = (Array.isArray(raw.metrics) ? raw.metrics : []).flatMap((metric) => {
    const parsed = comparisonMetricSchema.safeParse(metric);
    return parsed.success ? [parsed.data] : [];
  });
  return {
    id: asString(raw.id ?? raw.comparisonId),
    caseId,
    createdAt: asOptionalString(raw.createdAt),
    metrics,
    singleAgentRunId: asOptionalString(raw.singleAgentRunId),
    multiAgentRunId: asOptionalString(raw.multiAgentRunId),
  };
}

export function normalizeKnowledgeDocument(value: unknown): KnowledgeDocument | null {
  if (!isRecord(value)) return null;
  const id = asString(value.id);
  const title = asString(value.title);
  if (!id || !title) return null;
  const status =
    value.status === 'READY' || value.status === 'PROCESSING' || value.status === 'FAILED'
      ? value.status
      : undefined;
  return {
    id,
    title,
    domain: asString(value.domain),
    sectionCount: asOptionalNumber(value.sectionCount),
    chunkCount: asOptionalNumber(value.chunkCount),
    status,
    createdAt: asString(value.createdAt),
    demoData: typeof value.demoData === 'boolean' ? value.demoData : undefined,
  };
}

export function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value : undefined;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asOptionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
