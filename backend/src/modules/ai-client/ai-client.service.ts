import { BadGatewayException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppEnvironment } from '../../config/env.validation';

@Injectable()
export class AiClientService {
  private readonly baseUrl: string;
  private readonly serviceToken: string;

  constructor(config: ConfigService<AppEnvironment, true>) {
    this.baseUrl = config.get('AI_SERVICE_URL', { infer: true });
    this.serviceToken = config.get('INTERNAL_SERVICE_TOKEN', { infer: true });
  }

  async startRun(input: {
    caseSnapshot: Record<string, unknown>;
    correlationId: string;
    mode: 'SINGLE' | 'MULTI';
    runId: string;
  }): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/runs`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-correlation-id': input.correlationId,
          'x-internal-service-token': this.serviceToken,
        },
        body: JSON.stringify({
          caseSnapshot: input.caseSnapshot,
          mode: input.mode,
          runId: input.runId,
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error(`AI service returned ${response.status}`);
    } catch {
      throw new BadGatewayException('AI workflow could not be started');
    }
  }

  async knowledge(path: string, init?: RequestInit): Promise<unknown> {
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          'x-internal-service-token': this.serviceToken,
          ...init?.headers,
        },
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error(`AI service returned ${response.status}`);
      return await response.json();
    } catch {
      throw new BadGatewayException('AI knowledge service is unavailable');
    }
  }
}
