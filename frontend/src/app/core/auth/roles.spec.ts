import { resolveRoles } from './roles';

describe('resolveRoles', () => {
  it('normalizes rollout aliases into the three canonical roles', () => {
    expect(
      resolveRoles(
        {
          realm_access: { roles: ['analyst', 'offline_access'] },
          resource_access: {
            'startflow-web': { roles: ['approver', 'sale', 'analyst'] },
            anotherClient: { roles: ['admin'] },
          },
        },
        'startflow-web',
      ),
    ).toEqual(['employee', 'manager']);
  });

  it('keeps canonical roles and ignores malformed or unrelated claims', () => {
    expect(resolveRoles(undefined, 'startflow-web')).toEqual([]);
    expect(
      resolveRoles(
        { realm_access: { roles: ['employee', 'manager', 'admin', 'offline_access', 42] } },
        'startflow-web',
      ),
    ).toEqual(['employee', 'manager', 'admin']);
  });

  it('maps the Keycloak realm administrator to the application admin role', () => {
    expect(
      resolveRoles(
        {
          resource_access: {
            'realm-management': { roles: ['realm-admin'] },
          },
        },
        'portal-ops',
      ),
    ).toEqual(['admin']);
  });
});
