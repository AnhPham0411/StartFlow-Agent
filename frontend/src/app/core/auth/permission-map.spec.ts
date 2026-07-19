import { STARTFLOW_PERMISSIONS, permissionsForRoles } from './permission-map';

describe('permissionsForRoles', () => {
  it('gives employees the customer and operator workspace', () => {
    const permissions = permissionsForRoles(['employee']);

    expect(permissions).toContain(STARTFLOW_PERMISSIONS.customerView);
    expect(permissions).toContain(STARTFLOW_PERMISSIONS.nbaView);
    expect(permissions).not.toContain(STARTFLOW_PERMISSIONS.nbaOperationsView);
    expect(permissions).not.toContain(STARTFLOW_PERMISSIONS.branchView);
    expect(permissions).not.toContain(STARTFLOW_PERMISSIONS.runApprove);
  });

  it('adds branch visibility and approval capabilities for managers', () => {
    const permissions = permissionsForRoles(['manager']);

    expect(permissions).toContain(STARTFLOW_PERMISSIONS.customerView);
    expect(permissions).toContain(STARTFLOW_PERMISSIONS.branchView);
    expect(permissions).toContain(STARTFLOW_PERMISSIONS.accountView);
    expect(permissions).toContain(STARTFLOW_PERMISSIONS.nbaOperationsView);
    expect(permissions).toContain(STARTFLOW_PERMISSIONS.runApprove);
    expect(permissions).not.toContain(STARTFLOW_PERMISSIONS.branchManage);
  });

  it('grants administrators all portal permissions including identity management', () => {
    const permissions = permissionsForRoles(['admin']);

    expect(new Set(permissions)).toEqual(new Set(Object.values(STARTFLOW_PERMISSIONS)));
  });

  it('merges permissions without duplicates and grants nothing without a role', () => {
    const permissions = permissionsForRoles(['employee', 'manager', 'admin']);

    expect(new Set(permissions).size).toBe(permissions.length);
    expect(permissionsForRoles([])).toEqual([]);
  });
});
