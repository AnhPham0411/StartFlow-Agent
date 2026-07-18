import { resolveRoles } from './roles';

describe('resolveRoles', () => {
  it('merges realm and selected-client roles, removes duplicates and rejects unknown roles', () => {
    expect(
      resolveRoles(
        {
          realm_access: { roles: ['analyst', 'offline_access'] },
          resource_access: {
            'startflow-web': { roles: ['approver', 'analyst'] },
            anotherClient: { roles: ['admin'] },
          },
        },
        'startflow-web',
      ),
    ).toEqual(['analyst', 'approver', 'sale', 'manager']);
  });

  it('returns no roles for an absent or malformed token', () => {
    expect(resolveRoles(undefined, 'startflow-web')).toEqual([]);
    expect(resolveRoles({ realm_access: { roles: ['admin', 42] } }, 'startflow-web')).toEqual([
      'admin',
    ]);
  });

  it('maps the Keycloak realm administrator without requiring an application profile', () => {
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
