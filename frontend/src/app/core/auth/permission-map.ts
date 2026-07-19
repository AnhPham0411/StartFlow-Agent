import type { UserRole } from '@startflow/contracts';

export const STARTFLOW_PERMISSIONS = {
  dashboardView: 'STARTFLOW_DASHBOARD_VIEW',
  caseView: 'STARTFLOW_CASE_VIEW',
  caseCreate: 'STARTFLOW_CASE_CREATE',
  runView: 'STARTFLOW_RUN_VIEW',
  runStart: 'STARTFLOW_RUN_START',
  runApprove: 'STARTFLOW_RUN_APPROVE',
  comparisonView: 'STARTFLOW_COMPARISON_VIEW',
  nbaView: 'STARTFLOW_NBA_VIEW',
  knowledgeView: 'STARTFLOW_KNOWLEDGE_VIEW',
  knowledgeCreate: 'STARTFLOW_KNOWLEDGE_CREATE',
} as const;

export type StartFlowPermission =
  (typeof STARTFLOW_PERMISSIONS)[keyof typeof STARTFLOW_PERMISSIONS];

const COMMON_PERMISSIONS: readonly StartFlowPermission[] = [
  STARTFLOW_PERMISSIONS.dashboardView,
  STARTFLOW_PERMISSIONS.caseView,
  STARTFLOW_PERMISSIONS.caseCreate,
  STARTFLOW_PERMISSIONS.runView,
  STARTFLOW_PERMISSIONS.runStart,
  STARTFLOW_PERMISSIONS.comparisonView,
  STARTFLOW_PERMISSIONS.nbaView,
];

export function permissionsForRoles(roles: readonly UserRole[]): StartFlowPermission[] {
  if (roles.length === 0) return [];

  const permissions = new Set<StartFlowPermission>(COMMON_PERMISSIONS);
  if (roles.includes('approver')) permissions.add(STARTFLOW_PERMISSIONS.runApprove);
  if (roles.includes('admin')) {
    permissions.add(STARTFLOW_PERMISSIONS.knowledgeView);
    permissions.add(STARTFLOW_PERMISSIONS.knowledgeCreate);
  }
  return [...permissions];
}
