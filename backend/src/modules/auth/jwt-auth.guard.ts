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

interface RealmAccess {
  roles?: unknown;
}

type ResourceAccess = Record<string, RealmAccess | undefined>;

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly audience: string;
  private readonly issuer: string;
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;

  constructor(
    config: ConfigService<AppEnvironment, true>,
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {
    this.audience = config.get('KEYCLOAK_AUDIENCE', { infer: true });
    this.issuer = config.get('KEYCLOAK_ISSUER', { infer: true });
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
      const { payload } = await jwtVerify(token, this.jwks, {
        algorithms: ['RS256'],
        audience: this.audience,
        issuer: this.issuer,
      });
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

  private async toUser(payload: JWTPayload) {
    if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
      throw new Error('Token subject is missing');
    }
    const realmAccess = payload.realm_access as RealmAccess | undefined;
    const realmRoles = Array.isArray(realmAccess?.roles)
      ? realmAccess.roles.filter((role): role is string => typeof role === 'string')
      : [];
    const resourceAccess = payload.resource_access as ResourceAccess | undefined;
    const clientAccess = resourceAccess?.[this.audience];
    const clientRoles = Array.isArray(clientAccess?.roles)
      ? clientAccess.roles.filter((role): role is string => typeof role === 'string')
      : [];
    const roles = [...new Set([...realmRoles, ...clientRoles])];
    const username =
      typeof payload.preferred_username === 'string' ? payload.preferred_username : undefined;

    let id: number | undefined;
    let branch: string | undefined;
    if (username) {
      try {
        const users = await this.prisma.$queryRaw<
          Array<{ id: bigint | number; branch: string | null }>
        >`SELECT id, branch FROM users WHERE username = ${username} LIMIT 1`;
        if (users[0]) {
          id = Number(users[0].id);
          branch = users[0].branch ?? undefined;
        }
      } catch {
        // A valid Keycloak token remains authenticated when the optional NBA profile is unavailable.
      }
    }

    return {
      roles,
      sub: payload.sub,
      ...(username ? { username } : {}),
      ...(id === undefined ? {} : { id }),
      ...(branch ? { branch } : {}),
    };
  }
}
