import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthContextValue } from '@/src/auth/auth-context';
import { RoleGate } from '@/src/auth/role-gate';

function authValue(roles: AuthContextValue['roles']): AuthContextValue {
  return {
    status: 'authenticated',
    user: { subject: 'demo', name: 'Demo' },
    roles,
    error: null,
    login: vi.fn(async () => undefined),
    logout: vi.fn(async () => undefined),
    getAccessToken: vi.fn(async () => 'token'),
    hasRole: (...required) => required.some((role) => roles.includes(role)),
  };
}

describe('RoleGate', () => {
  it('shows protected controls for a permitted role', () => {
    render(
      <AuthContext.Provider value={authValue(['approver'])}>
        <RoleGate allow={['approver']}>
          <button>Phê duyệt</button>
        </RoleGate>
      </AuthContext.Provider>,
    );
    expect(screen.getByRole('button', { name: 'Phê duyệt' })).toBeVisible();
  });

  it('explains missing access instead of exposing controls', () => {
    render(
      <AuthContext.Provider value={authValue(['analyst'])}>
        <RoleGate allow={['approver']} fallback={<p>Cần role approver</p>}>
          <button>Phê duyệt</button>
        </RoleGate>
      </AuthContext.Provider>,
    );
    expect(screen.queryByRole('button', { name: 'Phê duyệt' })).not.toBeInTheDocument();
    expect(screen.getByText('Cần role approver')).toBeVisible();
  });
});
