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
import type { AppEnvironment } from '../../config/env.validation';
import { PrismaService } from '../../database/prisma.service';
import { IS_PUBLIC_KEY } from './public.decorator';
import { normalizeApplicationRole, type ApplicationRole } from './roles.decorator';

interface RealmAccess {
  roles?: unknown;
}

type ResourceAccess = Record<string, RealmAccess | undefined>;

// Deployment contract: the API always authenticates to Keycloak with this confidential client.
const INTEGRATION_API_CLIENT_ID = 'INTEGRATION_API';

interface TokenIntrospection {
  active?: unknown;
  sub?: unknown;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly clientSecret: string;
  private readonly introspectionUrl: string;
  private readonly issuer: string;
  private readonly identityEnforcement: 'compat' | 'strict';
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;

  constructor(
    config: ConfigService<AppEnvironment, true>,
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {
    this.clientSecret = config.get('KEYCLOAK_SECRET', { infer: true });
    this.issuer = config.get('KEYCLOAK_ISSUER', { infer: true });
    this.introspectionUrl = `${this.issuer}/protocol/openid-connect/token/introspect`;
    this.identityEnforcement = config.get('IDENTITY_ENFORCEMENT_MODE', { infer: true }) ?? 'compat';
    this.jwks = createRemoteJWKSet(new URL(`${this.issuer}/protocol/openid-connect/certs`));
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
    const token = this.extractBearerToken(request.header('authorization'));
    if (!token) {
      throw new UnauthorizedException('Bearer access token is required');
    }

    try {
      const introspection = await this.introspect(token);
      const { payload } = await jwtVerify(token, this.jwks, {
        algorithms: ['RS256'],
        audience: INTEGRATION_API_CLIENT_ID,
        issuer: this.issuer,
      });
      if (typeof introspection.sub === 'string' && introspection.sub !== payload.sub) {
        throw new Error('Introspection subject does not match the signed token');
      }
      request.user = await this.toUser(payload);
      return true;
    } catch {
      throw new UnauthorizedException('Access token is invalid or expired');
    }
  }

  private extractBearerToken(header: string | undefined): string | undefined {
    if (!header) return undefined;
    const [scheme, token, extra] = header.split(' ');
    return scheme?.toLowerCase() === 'bearer' && token && !extra ? token : undefined;
  }

  private async introspect(token: string): Promise<TokenIntrospection> {
    const body = new URLSearchParams({
      client_id: INTEGRATION_API_CLIENT_ID,
      client_secret: this.clientSecret,
      token,
      token_type_hint: 'access_token',
    });
    const response = await fetch(this.introspectionUrl, {
      body,
      cache: 'no-store',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      method: 'POST',
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) throw new Error('Keycloak introspection request failed');

    const result = (await response.json()) as TokenIntrospection;
    if (result.active !== true) throw new Error('Keycloak token is inactive');
    return result;
  }

  private async toUser(payload: JWTPayload) {
    if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
      throw new Error('Token subject is missing');
    }
    const realmAccess = payload.realm_access as RealmAccess | undefined;
    const realmRoles = Array.isArray(realmAccess?.roles)
      ? realmAccess.roles.filter((role): role is string => typeof role === 'string')
      : [];
    const resourceAccess = payload.resource_access as ResourceAccess | undefined;
    const authorizedParty = typeof payload.azp === 'string' ? payload.azp : undefined;
    const clientIds = [...new Set([INTEGRATION_API_CLIENT_ID, authorizedParty])].filter(
      (clientId): clientId is string => Boolean(clientId),
    );
    const clientRoles = clientIds.flatMap((clientId) => {
      const access = resourceAccess?.[clientId];
      return Array.isArray(access?.roles)
        ? access.roles.filter((role): role is string => typeof role === 'string')
        : [];
    });
    const realmManagementAccess = resourceAccess?.['realm-management'];
    const realmManagementRoles = Array.isArray(realmManagementAccess?.roles)
      ? realmManagementAccess.roles.filter((role): role is string => typeof role === 'string')
      : [];
    const tokenRoles = [...new Set([...realmRoles, ...clientRoles, ...realmManagementRoles])];
    const normalizedTokenRoles = tokenRoles
      .map(normalizeApplicationRole)
      .filter((role): role is ApplicationRole => role !== undefined);
    const username =
      typeof payload.preferred_username === 'string' ? payload.preferred_username : undefined;

    let profile:
      | {
          active: boolean;
          branch: string | null;
          branch_id: bigint | number | null;
          id: bigint | number;
          role: string;
        }
      | undefined;
    try {
      const users = await this.prisma.$queryRaw<
        Array<{
          active: boolean;
          branch: string | null;
          branch_id: bigint | number | null;
          id: bigint | number;
          role: string;
        }>
      >`SELECT u.id, u.role::text AS role, u.active, u.branch_id, b.name AS branch
         FROM users u LEFT JOIN branches b ON b.id=u.branch_id
         WHERE u.keycloak_user_id=${payload.sub} OR (${username ?? ''} <> '' AND u.username=${username ?? ''})
         ORDER BY (u.keycloak_user_id=${payload.sub}) DESC LIMIT 1`;
      profile = users[0];
      if (profile && (typeof profile.active !== 'boolean' || typeof profile.role !== 'string')) {
        profile = {
          active: true,
          branch: profile.branch,
          branch_id: null,
          id: profile.id,
          role: normalizedTokenRoles[0] ?? 'employee',
        };
      }
    } catch (error) {
      if (this.identityEnforcement === 'strict') throw error;
      if (username) {
        const users = await this.prisma.$queryRaw<
          Array<{ id: bigint | number; branch: string | null }>
        >`SELECT id, branch FROM users WHERE username = ${username} LIMIT 1`;
        const legacy = users[0];
        if (legacy) {
          profile = {
            active: true,
            branch: legacy.branch,
            branch_id: null,
            id: legacy.id,
            role: normalizedTokenRoles[0] ?? 'employee',
          };
        }
      }
    }

    if (profile && !profile.active) throw new Error('Local account is disabled');
    if (!profile && this.identityEnforcement === 'strict')
      throw new Error('Local account is missing');
    const effectiveRole = profile
      ? normalizeApplicationRole(profile.role)
      : normalizedTokenRoles.includes('admin')
        ? 'admin'
        : normalizedTokenRoles.includes('manager')
          ? 'manager'
          : normalizedTokenRoles.includes('employee')
            ? 'employee'
            : undefined;
    if (!effectiveRole) throw new Error('Application role is missing');

    return {
      active: profile?.active ?? true,
      roles: [effectiveRole],
      effectiveRole,
      sub: payload.sub,
      ...(username ? { username } : {}),
      ...(profile ? { id: Number(profile.id) } : {}),
      ...(profile?.branch ? { branch: profile.branch } : {}),
      ...(profile?.branch_id ? { branchId: Number(profile.branch_id) } : {}),
    };
  }
}
