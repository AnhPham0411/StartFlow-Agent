import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppEnvironment } from '../../config/env.validation';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class HealthService {
  constructor(
    private readonly config: ConfigService<AppEnvironment, true>,
    private readonly prisma: PrismaService,
  ) {}

  health() {
    return {
      service: 'startflow-backend',
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  async readiness() {
    const [database, identity] = await Promise.allSettled([
      this.prisma.$queryRaw`SELECT 1`,
      this.checkIdentityProvider(),
    ]);
    const dependencies = {
      database: database.status === 'fulfilled' ? 'ok' : 'unavailable',
      identity: identity.status === 'fulfilled' ? 'ok' : 'unavailable',
    };

    if (database.status === 'rejected' || identity.status === 'rejected') {
      throw new ServiceUnavailableException({ dependencies, status: 'not_ready' });
    }
    return { dependencies, status: 'ready' };
  }

  private async checkIdentityProvider(): Promise<void> {
    const authMode = this.config.get('AUTH_MODE', { infer: true });
    if (authMode === 'mock') {
      return;
    }
    const issuer = this.config.get('KEYCLOAK_ISSUER', { infer: true });
    const response = await fetch(`${issuer}/.well-known/openid-configuration`, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(3_000),
    });
    if (!response.ok) throw new Error('Identity provider is unavailable');
    const metadata = (await response.json()) as { issuer?: unknown; jwks_uri?: unknown };
    if (metadata.issuer !== issuer || typeof metadata.jwks_uri !== 'string') {
      throw new Error('Identity provider metadata is invalid');
    }
  }
}
