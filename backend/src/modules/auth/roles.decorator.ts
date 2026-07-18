import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'startflow:roles';
export type ApplicationRole = 'analyst' | 'approver' | 'admin' | 'sale' | 'manager';
export const Roles = (...roles: ApplicationRole[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);
