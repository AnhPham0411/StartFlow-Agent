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
  nbaOperationsView: 'STARTFLOW_NBA_OPERATIONS_VIEW',
  customerView: 'STARTFLOW_CUSTOMER_VIEW',
  branchView: 'STARTFLOW_BRANCH_VIEW',
  branchManage: 'STARTFLOW_BRANCH_MANAGE',
  accountView: 'STARTFLOW_ACCOUNT_VIEW',
  accountManage: 'STARTFLOW_ACCOUNT_MANAGE',
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
  STARTFLOW_PERMISSIONS.customerView,
];

const MANAGER_PERMISSIONS: readonly StartFlowPermission[] = [
  STARTFLOW_PERMISSIONS.runApprove,
  STARTFLOW_PERMISSIONS.nbaOperationsView,
  STARTFLOW_PERMISSIONS.branchView,
  STARTFLOW_PERMISSIONS.accountView,
];

export function permissionsForRoles(roles: readonly UserRole[]): StartFlowPermission[] {
  if (roles.length === 0) return [];

  const permissions = new Set<StartFlowPermission>(COMMON_PERMISSIONS);
  if (roles.includes('manager')) {
    for (const permission of MANAGER_PERMISSIONS) permissions.add(permission);
  }
  if (roles.includes('admin')) {
    for (const permission of Object.values(STARTFLOW_PERMISSIONS)) permissions.add(permission);
  }
  return [...permissions];
}
