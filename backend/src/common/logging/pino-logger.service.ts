import { Injectable, type LoggerService } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import pino, { type Logger } from 'pino';

import type { AppEnvironment } from '../../config/env.validation';
import { redactUnknown } from './redaction';

@Injectable()
export class PinoLoggerService implements LoggerService {
  private readonly logger: Logger;

  constructor(config: ConfigService<AppEnvironment, true>) {
    this.logger = pino({
      base: { service: 'startflow-backend' },
      level: config.get('LOG_LEVEL', { infer: true }),
      redact: {
        paths: [
          'authorization',
          'cookie',
          '*.authorization',
          '*.cookie',
          '*.password',
          '*.token',
          '*.secret',
          '*.apiKey',
        ],
        censor: '[REDACTED]',
      },
    });
  }

  log(message: unknown, ...optionalParams: unknown[]): void {
    this.logger.info({ context: redactUnknown(optionalParams) }, String(message));
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    this.logger.error({ context: redactUnknown(optionalParams) }, String(message));
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.logger.warn({ context: redactUnknown(optionalParams) }, String(message));
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    this.logger.debug({ context: redactUnknown(optionalParams) }, String(message));
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.logger.trace({ context: redactUnknown(optionalParams) }, String(message));
  }
}
