import { STARTFLOW_PERMISSIONS, permissionsForRoles } from './permission-map';

describe('permissionsForRoles', () => {
  const commonPermissions = [
    STARTFLOW_PERMISSIONS.dashboardView,
    STARTFLOW_PERMISSIONS.caseView,
    STARTFLOW_PERMISSIONS.caseCreate,
    STARTFLOW_PERMISSIONS.runView,
    STARTFLOW_PERMISSIONS.runStart,
    STARTFLOW_PERMISSIONS.comparisonView,
    STARTFLOW_PERMISSIONS.nbaView,
  ];

  it('gives analysts only the common StartFlow workspace permissions', () => {
    expect(permissionsForRoles(['analyst'])).toEqual(commonPermissions);
  });

  it('adds approval only for approvers', () => {
    expect(permissionsForRoles(['approver'])).toEqual([
      ...commonPermissions,
      STARTFLOW_PERMISSIONS.runApprove,
    ]);
    expect(permissionsForRoles(['admin'])).not.toContain(STARTFLOW_PERMISSIONS.runApprove);
  });

  it('adds knowledge view and ingest only for administrators', () => {
    expect(permissionsForRoles(['admin'])).toEqual([
      ...commonPermissions,
      STARTFLOW_PERMISSIONS.knowledgeView,
      STARTFLOW_PERMISSIONS.knowledgeCreate,
    ]);
    expect(permissionsForRoles(['approver'])).not.toContain(STARTFLOW_PERMISSIONS.knowledgeView);
  });

  it('merges permissions without duplicates when a token has multiple roles', () => {
    const permissions = permissionsForRoles(['analyst', 'approver', 'admin']);

    expect(new Set(permissions).size).toBe(permissions.length);
    expect(permissions).toContain(STARTFLOW_PERMISSIONS.runApprove);
    expect(permissions).toContain(STARTFLOW_PERMISSIONS.knowledgeCreate);
  });

  it('grants nothing when no approved StartFlow role is present', () => {
    expect(permissionsForRoles([])).toEqual([]);
  });
});
