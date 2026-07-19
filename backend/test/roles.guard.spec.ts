import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { RolesGuard } from '../src/modules/auth/roles.guard';
import { normalizeApplicationRole } from '../src/modules/auth/roles.decorator';

function contextWithRoles(roles: string[]): ExecutionContext {
  return {
    getClass: () => class TestController {},
    getHandler: () => function handler() {},
    switchToHttp: () => ({ getRequest: () => ({ user: { roles, sub: 'demo-user' } }) }),
  } as unknown as ExecutionContext;
}

describe('realm role authorization', () => {
  it.each([
    ['sale', 'employee'],
    ['analyst', 'employee'],
    ['approver', 'manager'],
    ['manager', 'manager'],
    ['admin', 'admin'],
  ] as const)('normalizes rollout role %s to %s', (input, expected) => {
    expect(normalizeApplicationRole(input)).toBe(expected);
  });

  it('allows managers and admins to use employee operations', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValueOnce(false).mockReturnValueOnce(['employee']),
    };
    expect(
      new RolesGuard(reflector as unknown as Reflector).canActivate(contextWithRoles(['manager'])),
    ).toBe(true);
  });

  it('allows an approver to use analyst operations', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValueOnce(false).mockReturnValueOnce(['analyst']),
    };
    const guard = new RolesGuard(reflector as unknown as Reflector);

    expect(guard.canActivate(contextWithRoles(['approver']))).toBe(true);
  });

  it('denies an analyst access to approver operations', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValueOnce(false).mockReturnValueOnce(['approver']),
    };
    const guard = new RolesGuard(reflector as unknown as Reflector);

    expect(() => guard.canActivate(contextWithRoles(['analyst']))).toThrow(ForbiddenException);
  });

  it('maps existing Keycloak analyst and approver roles onto NBA permissions', () => {
    const saleReflector = {
      getAllAndOverride: jest.fn().mockReturnValueOnce(false).mockReturnValueOnce(['sale']),
    };
    const managerReflector = {
      getAllAndOverride: jest.fn().mockReturnValueOnce(false).mockReturnValueOnce(['manager']),
    };

    expect(
      new RolesGuard(saleReflector as unknown as Reflector).canActivate(
        contextWithRoles(['analyst']),
      ),
    ).toBe(true);
    expect(
      new RolesGuard(managerReflector as unknown as Reflector).canActivate(
        contextWithRoles(['approver']),
      ),
    ).toBe(true);
  });
});
