import {
  ForbiddenException,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { RequestContext } from '../../common/types/request-context';
import { IS_PUBLIC_KEY } from './public.decorator';
import { ROLES_KEY, type ApplicationRole } from './roles.decorator';

const allowedByRequirement: Record<ApplicationRole, ApplicationRole[]> = {
  analyst: ['analyst', 'approver', 'admin'],
  approver: ['approver', 'admin'],
  admin: ['admin'],
  sale: ['sale', 'manager', 'admin', 'analyst', 'approver'],
  manager: ['manager', 'admin', 'approver'],
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const required = this.reflector.getAllAndOverride<ApplicationRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;

    const user = context.switchToHttp().getRequest<RequestContext>().user;
    const authorized = required.some((role) =>
      allowedByRequirement[role].some((acceptedRole) => user?.roles.includes(acceptedRole)),
    );
    if (!authorized) {
      throw new ForbiddenException('Required realm role is missing');
    }
    return true;
  }
}
