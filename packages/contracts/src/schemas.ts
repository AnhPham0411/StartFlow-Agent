import { z } from 'zod';

export const userRoleSchema = z.enum(['analyst', 'approver', 'admin', 'sale', 'manager']);
export const runStatusSchema = z.enum([
  'PENDING',
  'PLANNING',
  'RUNNING',
  'AWAITING_APPROVAL',
  'COMPLETED',
  'PARTIAL',
  'FAILED',
]);
export const agentKindSchema = z.enum([
  'PLANNER',
  'CREDIT',
  'COMPLIANCE',
  'OPERATIONS',
  'SYNTHESIZER',
]);
export const agentTaskStatusSchema = z.enum([
  'PENDING',
  'RUNNING',
  'COMPLETED',
  'FAILED',
  'SKIPPED',
]);
export const decisionStatusSchema = z.enum(['RECOMMEND', 'NEEDS_REVIEW', 'BLOCKED']);
export const approvalDecisionSchema = z.enum(['APPROVE', 'REJECT']);

export const financialSnapshotSchema = z.object({
  revenue: z.number().nonnegative(),
  ebitda: z.number(),
  totalDebt: z.number().nonnegative(),
  equity: z.number().positive(),
  currentAssets: z.number().nonnegative(),
  currentLiabilities: z.number().positive(),
});

export const caseInputSchema = z.object({
  companyName: z.string().trim().min(2).max(160),
  registrationNumber: z.string().trim().min(4).max(32),
  requestedAmount: z.number().positive(),
  purpose: z.string().trim().min(10).max(1000),
  financials: financialSnapshotSchema,
  submittedDocuments: z.array(z.string().trim().min(2).max(120)).max(50),
  demoData: z.literal(true),
});

export const caseRecordSchema = caseInputSchema.extend({
  id: z.string().uuid(),
  createdAt: z.string().datetime(),
  createdBy: z.string().min(1),
});

export const agentPlanTaskSchema = z.object({
  id: z.string().min(1),
  agent: agentKindSchema.exclude(['PLANNER', 'SYNTHESIZER']),
  title: z.string().min(1),
  objective: z.string().min(1),
  dependencies: z.array(z.string()),
  successCriteria: z.array(z.string()).min(1),
  status: agentTaskStatusSchema,
});

export const citationSchema = z.object({
  id: z.string().min(1),
  documentId: z.string().min(1),
  documentTitle: z.string().min(1),
  section: z.string().min(1),
  chunkId: z.string().min(1),
  excerpt: z.string().min(1).max(600),
  relevanceScore: z.number().min(0).max(1),
});

export const toolEventDataSchema = z.object({
  toolName: z.enum([
    'financial_calculator',
    'mock_kyc_aml',
    'document_checklist',
    'knowledge_retrieval',
  ]),
  latencyMs: z.number().int().nonnegative(),
  inputSummary: z.record(z.string(), z.unknown()),
  outputSummary: z.record(z.string(), z.unknown()),
});

export const agentFindingSchema = z.object({
  code: z.string().min(1),
  severity: z.enum(['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  title: z.string().min(1),
  detail: z.string().min(1),
  citations: z.array(citationSchema),
});

export const agentResultSchema = z.object({
  agent: agentKindSchema.exclude(['PLANNER', 'SYNTHESIZER']),
  status: agentTaskStatusSchema,
  summary: z.string().min(1),
  confidence: z.number().min(0).max(1),
  findings: z.array(agentFindingSchema),
  toolNames: z.array(toolEventDataSchema.shape.toolName),
  errorCode: z.string().nullable().default(null),
});

export const finalDecisionSchema = z.object({
  status: decisionStatusSchema,
  summary: z.string().min(1),
  rationale: z.array(z.string()).min(1),
  conditions: z.array(z.string()),
  conflicts: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  requiresHumanApproval: z.boolean(),
  proposedAction: z
    .object({
      type: z.literal('CREATE_ACTION_TICKET'),
      title: z.string().min(1),
      description: z.string().min(1),
    })
    .nullable(),
});

export const publicRunEventTypeSchema = z.enum([
  'run.started',
  'plan.created',
  'agent.started',
  'tool.completed',
  'citation.added',
  'agent.completed',
  'synthesis.completed',
  'approval.required',
  'run.completed',
  'run.failed',
]);

export const runEventSchema = z.object({
  id: z.string().uuid(),
  runId: z.string().uuid(),
  sequence: z.number().int().positive(),
  type: publicRunEventTypeSchema,
  agent: agentKindSchema.nullable(),
  occurredAt: z.string().datetime(),
  correlationId: z.string().uuid(),
  idempotencyKey: z.string().min(8).max(200),
  payload: z.record(z.string(), z.unknown()),
});

export const createRunResponseSchema = z.object({
  runId: z.string().uuid(),
  status: runStatusSchema,
});

export const approvalRequestSchema = z.object({
  decision: approvalDecisionSchema,
  reason: z.string().trim().min(5).max(1000),
  expectedVersion: z.number().int().nonnegative(),
});

export const comparisonMetricSchema = z.object({
  name: z.enum([
    'completeness',
    'citationCoverage',
    'toolUse',
    'conflictDetection',
    'latency',
    'rubricScore',
  ]),
  singleAgent: z.number().nonnegative(),
  multiAgent: z.number().nonnegative(),
  unit: z.string().min(1),
});

export type UserRole = z.infer<typeof userRoleSchema>;
export type CaseInput = z.infer<typeof caseInputSchema>;
export type CaseRecord = z.infer<typeof caseRecordSchema>;
export type AgentPlanTask = z.infer<typeof agentPlanTaskSchema>;
export type AgentResult = z.infer<typeof agentResultSchema>;
export type FinalDecision = z.infer<typeof finalDecisionSchema>;
export type RunEvent = z.infer<typeof runEventSchema>;
export type ApprovalRequest = z.infer<typeof approvalRequestSchema>;
export type ComparisonMetric = z.infer<typeof comparisonMetricSchema>;
