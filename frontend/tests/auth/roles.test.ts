import { describe, expect, it } from 'vitest';
import { resolveRoles } from '@/src/auth/roles';

describe('resolveRoles', () => {
  it('merges valid realm and client roles without leaking unrelated roles', () => {
    expect(
      resolveRoles(
        {
          realm_access: { roles: ['analyst', 'offline_access'] },
          resource_access: {
            'startflow-web': { roles: ['approver', 'analyst'] },
            other: { roles: ['admin'] },
          },
        },
        'startflow-web',
      ),
    ).toEqual(['analyst', 'approver']);
  });

  it('returns no roles for an absent token', () => {
    expect(resolveRoles(undefined, 'startflow-web')).toEqual([]);
  });
});
