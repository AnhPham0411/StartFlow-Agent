import type { Request } from 'express';

export interface AuthenticatedUser {
  active?: boolean;
  branchId?: number;
  id?: number;
  roles: string[];
  effectiveRole?: 'employee' | 'manager' | 'admin';
  sub: string;
  username?: string;
  branch?: string;
}

export interface RequestContext extends Request {
  correlationId: string;
  user?: AuthenticatedUser;
}
