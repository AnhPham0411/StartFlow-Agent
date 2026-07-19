import {
  agentPlanTaskSchema,
  agentResultSchema,
  comparisonMetricSchema,
  decisionStatusSchema,
  finalDecisionSchema,
  runEventSchema,
  runStatusSchema,
  type ApprovalRequest,
  type CaseInput,
} from '@startflow/contracts';
import type { CaseDetail, CaseSummary, KnowledgeDocument, RunDetail } from './models';

type AccessTokenProvider = () => Promise<string>;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function unwrap<T>(payload: T | { data: T }): T {
  return typeof payload === 'object' && payload !== null && 'data' in payload
    ? payload.data
    : payload;
}

function collection<T>(payload: T[] | { items: T[] } | { data: T[] | { items: T[] } }): T[] {
  const unwrapped = unwrap(payload);
  return Array.isArray(unwrapped) ? unwrapped : unwrapped.items;
}

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown, fallback = 0) {
  return typeof value === 'number' ? value : fallback;
}

function normalizeRunSummary(value: unknown, caseId: string) {
  const raw = isRecord(value) ? value : {};
  const status = runStatusSchema.safeParse(raw.status);
  const finalDecisionStatus = decisionStatusSchema.safeParse(raw.finalDecisionStatus);
  return {
    id: asString(raw.id),
    caseId,
    status: status.success ? status.data : ('PENDING' as const),
    createdAt: asString(raw.createdAt),
    completedAt: typeof raw.completedAt === 'string' ? raw.completedAt : null,
    finalDecisionStatus: finalDecisionStatus.success ? finalDecisionStatus.data : null,
  };
}

function normalizeCaseSummary(value: unknown): CaseSummary {
  const raw = isRecord(value) ? value : {};
  const summary = {
    id: asString(raw.id),
    companyName: asString(raw.companyName, 'Doanh nghiệp demo'),
    registrationNumber: asString(raw.registrationNumber),
    requestedAmount: asNumber(raw.requestedAmount),
    purpose: asString(raw.purpose),
    createdAt: asString(raw.createdAt),
  };
  return {
    ...summary,
    latestRun: raw.latestRun ? normalizeRunSummary(raw.latestRun, summary.id) : null,
    runCount: asNumber(raw.runCount),
  };
}

function normalizeCaseDetail(value: unknown): CaseDetail {
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
    runCount: runs.length,
    latestRun: runs[0] ?? null,
  };
}

function normalizeRun(value: unknown): RunDetail {
  const raw = isRecord(value) ? value : {};
  const parsedStatus = runStatusSchema.safeParse(raw.status);
  const events = (Array.isArray(raw.events) ? raw.events : []).flatMap((event) => {
    const parsed = runEventSchema.safeParse(event);
    return parsed.success ? [parsed.data] : [];
  });
  const rawPlan = isRecord(raw.plan) && Array.isArray(raw.plan.tasks) ? raw.plan.tasks : [];
  const storedTasks = Array.isArray(raw.tasks) ? raw.tasks : [];
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
  const results = eventResults.length ? eventResults : storedResults;
  const decision = finalDecisionSchema.safeParse(raw.decision);
  const snapshotEnvelope = isRecord(raw.snapshot) ? raw.snapshot : {};
  const snapshot = isRecord(snapshotEnvelope.snapshot) ? snapshotEnvelope.snapshot : {};
  const approvalRaw = isRecord(raw.approval) ? raw.approval : null;
  const ticketRaw = isRecord(raw.actionTicket) ? raw.actionTicket : null;
  return {
    id: asString(raw.id),
    caseId: asString(raw.caseId),
    status: parsedStatus.success ? parsedStatus.data : 'PENDING',
    createdAt: asString(raw.createdAt),
    completedAt: typeof raw.completedAt === 'string' ? raw.completedAt : null,
    version: asNumber(raw.version),
    plan,
    agentResults: results,
    finalDecision: decision.success ? decision.data : null,
    events,
    approval: approvalRaw
      ? {
          id: asString(approvalRaw.id),
          decision: approvalRaw.decision === 'REJECT' ? 'REJECT' : 'APPROVE',
          reason: asString(approvalRaw.reason),
          createdAt: asString(approvalRaw.createdAt),
          createdBy: asString(approvalRaw.actorSubject),
        }
      : null,
    actionTicket: ticketRaw
      ? {
          id: asString(ticketRaw.id),
          title: asString(ticketRaw.title),
          createdAt: asString(ticketRaw.createdAt),
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

export function getApiBaseUrl() {
  return (process.env.NEXT_PUBLIC_API_URL ?? '/api').replace(/\/$/, '');
}

export class StartFlowApi {
  constructor(private readonly getAccessToken: AccessTokenProvider) {}

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = await this.getAccessToken();
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      ...init,
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as {
        message?: string;
        code?: string;
      };
      throw new ApiError(
        payload.message ?? `Yêu cầu thất bại (${response.status})`,
        response.status,
        payload.code,
      );
    }

    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }

  async listCases() {
    const payload = await this.request<
      unknown[] | { items: unknown[] } | { data: unknown[] | { items: unknown[] } }
    >('/cases');
    return collection<unknown>(payload).map(normalizeCaseSummary);
  }

  async createCase(input: CaseInput) {
    return normalizeCaseDetail(
      unwrap(
        await this.request<unknown | { data: unknown }>('/cases', {
          method: 'POST',
          body: JSON.stringify(input),
        }),
      ),
    );
  }

  async getCase(caseId: string) {
    return normalizeCaseDetail(
      unwrap(
        await this.request<unknown | { data: unknown }>(`/cases/${encodeURIComponent(caseId)}`),
      ),
    );
  }

  async createRun(caseId: string) {
    return unwrap(
      await this.request<
        { runId: string; status: string } | { data: { runId: string; status: string } }
      >(`/cases/${encodeURIComponent(caseId)}/runs`, { method: 'POST' }),
    );
  }

  async getRun(runId: string) {
    return normalizeRun(
      unwrap(await this.request<unknown | { data: unknown }>(`/runs/${encodeURIComponent(runId)}`)),
    );
  }

  async submitApproval(runId: string, input: ApprovalRequest) {
    await this.request<unknown>(`/runs/${encodeURIComponent(runId)}/approvals`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return this.getRun(runId);
  }

  async createComparison(caseId: string) {
    const response = unwrap(
      await this.request<unknown | { data: unknown }>(
        `/cases/${encodeURIComponent(caseId)}/comparisons`,
        { method: 'POST' },
      ),
    );
    const raw = isRecord(response) ? response : {};
    const metrics = (Array.isArray(raw.metrics) ? raw.metrics : []).flatMap((metric) => {
      const parsed = comparisonMetricSchema.safeParse(metric);
      return parsed.success ? [parsed.data] : [];
    });
    return {
      id: asString(raw.id ?? raw.comparisonId),
      caseId,
      metrics,
      singleAgentRunId: asString(raw.singleAgentRunId) || undefined,
      multiAgentRunId: asString(raw.multiAgentRunId) || undefined,
    };
  }

  async listKnowledge() {
    return collection<KnowledgeDocument>(
      await this.request<
        | KnowledgeDocument[]
        | { items: KnowledgeDocument[] }
        | { data: KnowledgeDocument[] | { items: KnowledgeDocument[] } }
      >('/knowledge'),
    );
  }

  async ingestKnowledge(input: { title: string; domain: string; content: string; demoData: true }) {
    return unwrap(
      await this.request<KnowledgeDocument | { data: KnowledgeDocument }>('/knowledge', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    );
  }
}
