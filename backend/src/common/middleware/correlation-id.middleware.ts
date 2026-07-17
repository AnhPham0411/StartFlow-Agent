import { randomUUID } from 'node:crypto';

import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Response } from 'express';

import type { RequestContext } from '../types/request-context';
import { PinoLoggerService } from '../logging/pino-logger.service';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  constructor(private readonly logger: PinoLoggerService) {}

  use(request: RequestContext, response: Response, next: NextFunction): void {
    const supplied = request.header('x-correlation-id');
    const correlationId = supplied && uuidPattern.test(supplied) ? supplied : randomUUID();
    const startedAt = Date.now();

    request.correlationId = correlationId;
    response.setHeader('x-correlation-id', correlationId);
    response.on('finish', () => {
      this.logger.log('request.completed', {
        correlationId,
        durationMs: Date.now() - startedAt,
        method: request.method,
        path: request.originalUrl.split('?')[0],
        statusCode: response.statusCode,
      });
    });
    next();
  }
}
