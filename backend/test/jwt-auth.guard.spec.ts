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
  const originalFetch = global.fetch;
  const fetchMock = jest.fn();
  const config = {
    get: jest.fn((key: keyof AppEnvironment) => {
      if (key === 'KEYCLOAK_ISSUER') return 'https://auth.example.test/realms/startflow';
      if (key === 'KEYCLOAK_SECRET') return 'fixture-client-secret';
      return undefined;
    }),
  } as unknown as ConfigService<AppEnvironment, true>;
  const reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) } as unknown as Reflector;
  const prisma = { $queryRaw: jest.fn().mockResolvedValue([]) } as unknown as PrismaService;

  beforeAll(() => {
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    fetchMock.mockResolvedValue({
      json: async () => ({ active: true }),
      ok: true,
    } as Response);
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('introspects with the confidential client before verifying issuer, audience and RS256', async () => {
    jest.mocked(jwtVerify).mockResolvedValue({
      payload: {
        aud: 'INTEGRATION_API',
        azp: 'portal-ops',
        iss: 'https://auth.example.test/realms/startflow',
        realm_access: { roles: ['analyst'] },
        sub: 'demo-user',
      },
      protectedHeader: { alg: 'RS256' },
    } as never);
    const { context, request } = executionContext('Bearer signed-token');
    const guard = new JwtAuthGuard(config, reflector, prisma);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://auth.example.test/realms/startflow/protocol/openid-connect/token/introspect',
      expect.objectContaining({
        body: expect.any(URLSearchParams),
        method: 'POST',
      }),
    );
    const body = fetchMock.mock.calls[0]?.[1]?.body as URLSearchParams;
    expect(body.get('client_id')).toBe('INTEGRATION_API');
    expect(body.get('client_secret')).toBe('fixture-client-secret');
    expect(jwtVerify).toHaveBeenCalledWith(
      'signed-token',
      'mock-jwks',
      expect.objectContaining({
        algorithms: ['RS256'],
        audience: 'INTEGRATION_API',
        issuer: 'https://auth.example.test/realms/startflow',
      }),
    );
    expect(request.user).toEqual({ roles: ['analyst'], sub: 'demo-user' });
  });

  it('returns unauthorized when a bearer token is missing', async () => {
    const guard = new JwtAuthGuard(config, reflector, prisma);
    const { context } = executionContext();

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(jwtVerify).not.toHaveBeenCalled();
  });

  it('rejects a token that the confidential client reports as inactive', async () => {
    fetchMock.mockResolvedValueOnce({
      json: async () => ({ active: false }),
      ok: true,
    } as Response);
    const guard = new JwtAuthGuard(config, reflector, prisma);
    const { context } = executionContext('Bearer inactive-token');

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(jwtVerify).not.toHaveBeenCalled();
  });

  it('accepts roles issued for the configured Keycloak client', async () => {
    jest.mocked(jwtVerify).mockResolvedValue({
      payload: {
        aud: 'INTEGRATION_API',
        azp: 'portal-ops',
        realm_access: { roles: ['offline_access'] },
        resource_access: { 'portal-ops': { roles: ['sale'] } },
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
    fetchMock.mockResolvedValueOnce({
      json: async () => ({ active: true, sub: 'keycloak-subject' }),
      ok: true,
    } as Response);
    jest.mocked(jwtVerify).mockResolvedValue({
      payload: {
        aud: 'INTEGRATION_API',
        azp: 'portal-ops',
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

  it('maps a Keycloak realm administrator to application admin without a database profile', async () => {
    fetchMock.mockResolvedValueOnce({
      json: async () => ({ active: true, sub: 'realm-admin-subject' }),
      ok: true,
    } as Response);
    jest.mocked(jwtVerify).mockResolvedValue({
      payload: {
        aud: 'INTEGRATION_API',
        azp: 'portal-ops',
        resource_access: { 'realm-management': { roles: ['realm-admin'] } },
        sub: 'realm-admin-subject',
      },
      protectedHeader: { alg: 'RS256' },
    } as never);
    const { context, request } = executionContext('Bearer admin-token');

    await expect(new JwtAuthGuard(config, reflector, prisma).canActivate(context)).resolves.toBe(
      true,
    );
    expect(request.user).toEqual({
      roles: ['realm-admin', 'admin'],
      sub: 'realm-admin-subject',
    });
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });
});
