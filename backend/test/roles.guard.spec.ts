import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { RolesGuard } from '../src/modules/auth/roles.guard';

function contextWithRoles(roles: string[]): ExecutionContext {
  return {
    getClass: () => class TestController {},
    getHandler: () => function handler() {},
    switchToHttp: () => ({ getRequest: () => ({ user: { roles, sub: 'demo-user' } }) }),
  } as unknown as ExecutionContext;
}

describe('realm role authorization', () => {
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
});
