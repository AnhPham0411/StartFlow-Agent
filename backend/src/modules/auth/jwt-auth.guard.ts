import {
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

import type { RequestContext } from '../../common/types/request-context';
import type { AppEnvironment, AuthMode } from '../../config/env.validation';
import { IS_PUBLIC_KEY } from './public.decorator';

interface RealmAccess {
  roles?: unknown;
}

// Dev-login: mọi role hợp lệ để xem đủ luồng; có thể thu hẹp bằng header x-dev-roles.
const DEV_ROLES = ['analyst', 'approver', 'admin'];
const DEV_SUBJECT = 'demo-reviewer';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly authMode: AuthMode;
  private readonly audience: string;
  private readonly issuer: string;
  private readonly jwks?: ReturnType<typeof createRemoteJWKSet>;

  constructor(
    config: ConfigService<AppEnvironment, true>,
    private readonly reflector: Reflector,
  ) {
    this.authMode = config.get('AUTH_MODE', { infer: true });
    this.audience = config.get('KEYCLOAK_AUDIENCE', { infer: true });
    this.issuer = config.get('KEYCLOAK_ISSUER', { infer: true });
    // Chỉ dựng JWKS khi thực sự dùng Keycloak — chế độ mock không có issuer.
    if (this.authMode === 'keycloak') {
      this.jwks = createRemoteJWKSet(new URL(`${this.issuer}/protocol/openid-connect/certs`));
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestContext>();

    // Dev-login: bỏ qua Keycloak, gán user demo. KHÔNG bao giờ bật ở production (chặn ở env.validation).
    if (this.authMode === 'mock') {
      request.user = this.toDevUser(request.header('x-dev-roles'));
      return true;
    }

    const token = this.extractBearerToken(request.header('authorization'));
    const jwks = this.jwks;
    if (!token || !jwks) {
      throw new UnauthorizedException('Bearer access token is required');
    }

    try {
      const { payload } = await jwtVerify(token, jwks, {
        algorithms: ['RS256'],
        audience: this.audience,
        issuer: this.issuer,
      });
      request.user = this.toUser(payload);
      return true;
    } catch {
      throw new UnauthorizedException('Access token is invalid or expired');
    }
  }

  private toDevUser(rolesHeader: string | undefined) {
    const requested = (rolesHeader ?? '')
      .split(',')
      .map((role) => role.trim())
      .filter((role) => DEV_ROLES.includes(role));
    const roles = requested.length > 0 ? requested : DEV_ROLES;
    return { roles, sub: DEV_SUBJECT, username: DEV_SUBJECT };
  }

  private extractBearerToken(header: string | undefined): string | undefined {
    if (!header) return undefined;
    const [scheme, token, extra] = header.split(' ');
    return scheme?.toLowerCase() === 'bearer' && token && !extra ? token : undefined;
  }

  private toUser(payload: JWTPayload) {
    if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
      throw new Error('Token subject is missing');
    }
    const realmAccess = payload.realm_access as RealmAccess | undefined;
    const roles = Array.isArray(realmAccess?.roles)
      ? realmAccess.roles.filter((role): role is string => typeof role === 'string')
      : [];
    const username =
      typeof payload.preferred_username === 'string' ? payload.preferred_username : undefined;

    return { roles, sub: payload.sub, ...(username ? { username } : {}) };
  }
}
