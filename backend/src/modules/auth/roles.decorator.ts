import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'startflow:roles';
export type ApplicationRole = 'employee' | 'manager' | 'admin';
export type RolloutRole = ApplicationRole | 'sale' | 'analyst' | 'approver';

export function normalizeApplicationRole(role: string): ApplicationRole | undefined {
  if (role === 'sale' || role === 'analyst' || role === 'employee') return 'employee';
  if (role === 'approver' || role === 'manager') return 'manager';
  if (role === 'admin' || role === 'realm-admin') return 'admin';
  return undefined;
}

export const Roles = (...roles: ApplicationRole[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);
