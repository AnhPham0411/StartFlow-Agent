import { createHmac, timingSafeEqual } from 'node:crypto';

import {
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { RequestContext } from '../../common/types/request-context';
import type { AppEnvironment } from '../../config/env.validation';

/**
 * Authenticates AI callbacks with a shared service token plus a signed raw body.
 * The timestamp window limits replay attempts without persisting callback secrets.
 */
@Injectable()
export class InternalServiceGuard implements CanActivate {
  private static readonly callbackWindowSeconds = 300;
  private readonly expectedToken: Buffer;
  private readonly serviceToken: string;

  constructor(config: ConfigService<AppEnvironment, true>) {
    this.serviceToken = config.get('INTERNAL_SERVICE_TOKEN', { infer: true });
    this.expectedToken = Buffer.from(this.serviceToken);
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestContext>();
    const supplied = request.header('x-internal-service-token');
    const actualToken = Buffer.from(supplied ?? '');
    const matches =
      actualToken.length === this.expectedToken.length &&
      timingSafeEqual(actualToken, this.expectedToken);

    if (!matches) {
      throw new UnauthorizedException('Internal service authentication failed');
    }
    this.assertCallbackSignature(request);
    return true;
  }

  private assertCallbackSignature(request: RequestContext & { rawBody?: Buffer }): void {
    const timestamp = request.header('x-callback-timestamp');
    const suppliedSignature = request.header('x-callback-signature');
    if (!timestamp || !/^\d{10}$/.test(timestamp) || !suppliedSignature || !request.rawBody) {
      throw new UnauthorizedException('Internal callback signature is missing');
    }

    const timestampSeconds = Number(timestamp);
    const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - timestampSeconds);
    if (ageSeconds > InternalServiceGuard.callbackWindowSeconds) {
      throw new UnauthorizedException('Internal callback signature has expired');
    }

    const suppliedDigest = suppliedSignature.match(/^sha256=([a-f0-9]{64})$/i)?.[1];
    if (!suppliedDigest) {
      throw new UnauthorizedException('Internal callback signature is invalid');
    }
    const expectedDigest = createHmac('sha256', this.serviceToken)
      .update(timestamp)
      .update('.')
      .update(request.rawBody)
      .digest();
    const actualDigest = Buffer.from(suppliedDigest, 'hex');
    if (
      actualDigest.length !== expectedDigest.length ||
      !timingSafeEqual(actualDigest, expectedDigest)
    ) {
      throw new UnauthorizedException('Internal callback signature is invalid');
    }
  }
}
