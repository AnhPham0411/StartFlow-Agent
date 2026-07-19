import { z } from 'zod';
import { userRoleSchema } from './schemas.js';

export const nbaProductSchema = z.enum(['the', 'vay', 'dautu', 'baohiem', 'taikhoan']);

export const nbaRunKindSchema = z.enum(['nightly', 'mini']);
export const nbaBatchStatusSchema = z.enum(['pending', 'running', 'succeeded', 'failed']);
export const nbaStageStatusSchema = z.enum(['pending', 'running', 'succeeded', 'failed', 'skipped']);
export const nbaStageCodeSchema = z.enum([
  'M1', 'AG1', 'M2', 'M3', 'M4', 'M5', 'M6', 'AG2_AG6', 'M7', 'M8', 'M10', 'M11', 'M12', 'M13',
]);

export const nbaStageEventSchema = z.object({
  run_id: z.string().uuid(),
  stage: nbaStageCodeSchema,
  status: nbaStageStatusSchema,
  attempt: z.number().int().min(0).max(2),
  started_at: z.string().datetime().nullable(),
  completed_at: z.string().datetime().nullable(),
  duration_ms: z.number().int().nonnegative().nullable(),
  error_code: z.string().min(1).max(80).nullable(),
  message: z.string().max(500).nullable(),
});

export const nbaBatchRunSchema = z.object({
  run_id: z.string().uuid(),
  kind: nbaRunKindSchema,
  status: nbaBatchStatusSchema,
  business_date: z.string().date(),
  customer_id: z.number().int().positive().nullable(),
  created_at: z.string().datetime(),
  completed_at: z.string().datetime().nullable(),
  stages: z.array(nbaStageEventSchema),
});

export const nbaRunRequestSchema = z
  .object({
    kind: nbaRunKindSchema,
    business_date: z.string().date(),
    customer_id: z.number().int().positive().nullable().optional(),
    idempotency_key: z.string().trim().min(8).max(160),
  })
  .superRefine((value, context) => {
    const hasCustomer = value.customer_id !== undefined && value.customer_id !== null;
    if (value.kind === 'mini' && !hasCustomer) {
      context.addIssue({ code: 'custom', message: 'Mini run requires a customer', path: ['customer_id'] });
    }
    if (value.kind === 'nightly' && hasCustomer) {
      context.addIssue({ code: 'custom', message: 'Nightly run must not target one customer', path: ['customer_id'] });
    }
  });

export const nbaModelGateReportSchema = z.object({
  quality_passed: z.boolean(),
  stability_passed: z.boolean(),
  fairness_passed: z.boolean(),
  operations_passed: z.boolean(),
  improves_production: z.boolean(),
  promotable: z.boolean(),
});

export const nbaModelVersionSchema = z.object({
  id: z.string().min(1).max(80),
  version: z.string().min(1).max(80),
  status: z.enum(['candidate', 'production', 'retired']),
  created_at: z.string().datetime(),
  promoted_at: z.string().datetime().nullable(),
  gate_report: nbaModelGateReportSchema.nullable(),
});

export const branchReferenceSchema = z.object({
  id: z.number().int().positive(),
  code: z.string().trim().min(2).max(32),
  name: z.string().trim().min(2).max(160),
});

export const branchSchema = branchReferenceSchema.extend({
  active: z.boolean(),
  account_count: z.number().int().nonnegative(),
});

export const accountSchema = z.object({
  id: z.number().int().positive(),
  username: z.string().trim().min(3).max(80),
  full_name: z.string().trim().min(2).max(160),
  role: userRoleSchema,
  active: z.boolean(),
  branch: branchReferenceSchema.nullable(),
  identity_synced: z.boolean(),
});

export const currentIdentitySchema = accountSchema.extend({
  permissions: z.array(z.string().min(1)),
});

export const customerListItemSchema = z.object({
  customer_id: z.number().int().positive(),
  full_name: z.string().min(1),
  cif_code: z.string().min(1),
  product_rank1: nbaProductSchema.nullable(),
  last_list_date: z.string().date().nullable(),
});

export const createBranchInputSchema = z.object({
  code: z.string().trim().min(2).max(32).regex(/^[A-Z0-9-]+$/),
  name: z.string().trim().min(2).max(160),
});

export const updateBranchInputSchema = z.object({
  name: z.string().trim().min(2).max(160),
  active: z.boolean().optional(),
});

const accountAssignmentFields = {
  full_name: z.string().trim().min(2).max(160),
  role: userRoleSchema,
  branch_id: z.number().int().positive().nullable().optional(),
};

function validateAccountAssignment(
  value: { role: z.infer<typeof userRoleSchema>; branch_id?: number | null },
  context: z.RefinementCtx,
): void {
    const hasBranch = value.branch_id !== undefined && value.branch_id !== null;
    if (value.role === 'admin' && hasBranch) {
      context.addIssue({ code: 'custom', message: 'Admin must not belong to a branch', path: ['branch_id'] });
    }
    if (value.role !== 'admin' && !hasBranch) {
      context.addIssue({ code: 'custom', message: 'Manager and employee require a branch', path: ['branch_id'] });
    }
}

export const createAccountInputSchema = z
  .object({
    username: z.string().trim().min(3).max(80).regex(/^[a-zA-Z0-9._-]+$/),
    ...accountAssignmentFields,
  })
  .superRefine(validateAccountAssignment);

export const updateAccountInputSchema = z
  .object(accountAssignmentFields)
  .superRefine(validateAccountAssignment);

export type NbaProduct = z.infer<typeof nbaProductSchema>;
export type NbaRunKind = z.infer<typeof nbaRunKindSchema>;
export type NbaBatchStatus = z.infer<typeof nbaBatchStatusSchema>;
export type NbaStageStatus = z.infer<typeof nbaStageStatusSchema>;
export type NbaStageCode = z.infer<typeof nbaStageCodeSchema>;
export type NbaStageEvent = z.infer<typeof nbaStageEventSchema>;
export type NbaBatchRun = z.infer<typeof nbaBatchRunSchema>;
export type NbaRunRequest = z.infer<typeof nbaRunRequestSchema>;
export type NbaModelGateReport = z.infer<typeof nbaModelGateReportSchema>;
export type NbaModelVersion = z.infer<typeof nbaModelVersionSchema>;
export type BranchReference = z.infer<typeof branchReferenceSchema>;
export type Branch = z.infer<typeof branchSchema>;
export type Account = z.infer<typeof accountSchema>;
export type CurrentIdentity = z.infer<typeof currentIdentitySchema>;
export type CustomerListItem = z.infer<typeof customerListItemSchema>;
export type CreateBranchInput = z.infer<typeof createBranchInputSchema>;
export type UpdateBranchInput = z.infer<typeof updateBranchInputSchema>;
export type CreateAccountInput = z.infer<typeof createAccountInputSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountInputSchema>;
