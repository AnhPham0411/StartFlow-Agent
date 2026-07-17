import { createHmac } from 'node:crypto';

import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';

import type { AppEnvironment } from '../src/config/env.validation';
import { InternalServiceGuard } from '../src/modules/auth/internal-service.guard';

const serviceToken = 'test-internal-service-token';
const body = Buffer.from('{"id":"event-1","sequence":1}');

function context(overrides: Record<string, string | undefined> = {}): ExecutionContext {
  const timestamp = overrides['x-callback-timestamp'] ?? String(Math.floor(Date.now() / 1000));
  const signature = createHmac('sha256', serviceToken)
    .update(timestamp)
    .update('.')
    .update(body)
    .digest('hex');
  const headers: Record<string, string | undefined> = {
    'x-callback-signature': `sha256=${signature}`,
    'x-callback-timestamp': timestamp,
    'x-internal-service-token': serviceToken,
    ...overrides,
  };
  const request = { header: (name: string) => headers[name], rawBody: body };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('internal callback authentication', () => {
  const config = {
    get: jest.fn(() => serviceToken),
  } as unknown as ConfigService<AppEnvironment, true>;

  it('accepts the shared token only when the raw callback body has a fresh valid signature', () => {
    const guard = new InternalServiceGuard(config);
    expect(guard.canActivate(context())).toBe(true);
  });

  it('rejects a callback whose body signature does not match', () => {
    const guard = new InternalServiceGuard(config);
    expect(() =>
      guard.canActivate(context({ 'x-callback-signature': `sha256=${'0'.repeat(64)}` })),
    ).toThrow(UnauthorizedException);
  });

  it('rejects an expired callback even when its token is valid', () => {
    const guard = new InternalServiceGuard(config);
    expect(() => guard.canActivate(context({ 'x-callback-timestamp': '1000000000' }))).toThrow(
      UnauthorizedException,
    );
  });
});
