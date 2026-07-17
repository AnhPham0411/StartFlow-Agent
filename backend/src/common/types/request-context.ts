import type { Request } from 'express';

export interface AuthenticatedUser {
  roles: string[];
  sub: string;
  username?: string;
}

export interface RequestContext extends Request {
  correlationId: string;
  user?: AuthenticatedUser;
}
