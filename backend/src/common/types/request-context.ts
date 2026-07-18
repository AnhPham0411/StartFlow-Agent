import type { Request } from 'express';

export interface AuthenticatedUser {
  id?: number;
  roles: string[];
  sub: string;
  username?: string;
  branch?: string;
}

export interface RequestContext extends Request {
  correlationId: string;
  user?: AuthenticatedUser;
}
