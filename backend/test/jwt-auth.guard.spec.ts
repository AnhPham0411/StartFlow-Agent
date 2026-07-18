import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Reflector } from '@nestjs/core';
import { jwtVerify } from 'jose';

import type { AppEnvironment } from '../src/config/env.validation';
import type { PrismaService } from '../src/database/prisma.service';
import { JwtAuthGuard } from '../src/modules/auth/jwt-auth.guard';

jest.mock('jose', () => ({
  createRemoteJWKSet: jest.fn(() => 'mock-jwks'),
  jwtVerify: jest.fn(),
}));

function executionContext(authorization?: string): {
  context: ExecutionContext;
  request: Record<string, unknown>;
} {
  const request: Record<string, unknown> = {
    header: (name: string) => (name === 'authorization' ? authorization : undefined),
  };
  return {
    context: {
      getClass: () => class TestController {},
      getHandler: () => function handler() {},
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext,
    request,
  };
}

describe('Keycloak access-token verification', () => {
  const config = {
    get: jest.fn((key: keyof AppEnvironment) => {
      if (key === 'KEYCLOAK_AUDIENCE') return 'startflow-api';
      if (key === 'KEYCLOAK_ISSUER') return 'https://auth.example.test/realms/startflow';
      return undefined;
    }),
  } as unknown as ConfigService<AppEnvironment, true>;
  const reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) } as unknown as Reflector;
  const prisma = { $queryRaw: jest.fn().mockResolvedValue([]) } as unknown as PrismaService;

  beforeEach(() => jest.clearAllMocks());

  it('requires issuer, audience and RS256 before accepting realm roles', async () => {
    jest.mocked(jwtVerify).mockResolvedValue({
      payload: {
        aud: 'startflow-api',
        iss: 'https://auth.example.test/realms/startflow',
        realm_access: { roles: ['analyst'] },
        sub: 'demo-user',
      },
      protectedHeader: { alg: 'RS256' },
    } as never);
    const { context, request } = executionContext('Bearer signed-token');
    const guard = new JwtAuthGuard(config, reflector, prisma);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(jwtVerify).toHaveBeenCalledWith(
      'signed-token',
      'mock-jwks',
      expect.objectContaining({
        algorithms: ['RS256'],
        audience: 'startflow-api',
        issuer: 'https://auth.example.test/realms/startflow',
      }),
    );
    expect(request.user).toEqual({ roles: ['analyst'], sub: 'demo-user' });
  });

  it('returns unauthorized when a bearer token is missing', async () => {
    const guard = new JwtAuthGuard(config, reflector, prisma);
    const { context } = executionContext();

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(jwtVerify).not.toHaveBeenCalled();
  });

  it('accepts roles issued for the configured Keycloak client', async () => {
    jest.mocked(jwtVerify).mockResolvedValue({
      payload: {
        realm_access: { roles: ['offline_access'] },
        resource_access: { 'startflow-api': { roles: ['sale'] } },
        sub: 'client-role-user',
      },
      protectedHeader: { alg: 'RS256' },
    } as never);
    const { context, request } = executionContext('Bearer signed-token');

    await expect(new JwtAuthGuard(config, reflector, prisma).canActivate(context)).resolves.toBe(
      true,
    );
    expect(request.user).toEqual({
      roles: ['offline_access', 'sale'],
      sub: 'client-role-user',
    });
  });

  it('enriches profile metadata without replacing Keycloak realm roles', async () => {
    jest.mocked(jwtVerify).mockResolvedValue({
      payload: {
        realm_access: { roles: ['analyst'] },
        preferred_username: 'sale01',
        sub: 'keycloak-subject',
      },
      protectedHeader: { alg: 'RS256' },
    } as never);
    jest
      .mocked(prisma.$queryRaw)
      .mockResolvedValueOnce([{ id: 10n, branch: 'Demo Branch' }] as never);
    const { context, request } = executionContext('Bearer signed-token');

    await expect(new JwtAuthGuard(config, reflector, prisma).canActivate(context)).resolves.toBe(
      true,
    );
    expect(request.user).toEqual({
      id: 10,
      branch: 'Demo Branch',
      roles: ['analyst'],
      sub: 'keycloak-subject',
      username: 'sale01',
    });
  });
});
