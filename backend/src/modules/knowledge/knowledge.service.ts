import { Injectable } from '@nestjs/common';

import { AiClientService } from '../ai-client/ai-client.service';
import { AuditService } from '../audit/audit.service';
import type { IngestKnowledgeDto } from './dto/ingest-knowledge.dto';

@Injectable()
export class KnowledgeService {
  constructor(
    private readonly aiClient: AiClientService,
    private readonly audit: AuditService,
  ) {}

  list(correlationId: string) {
    return this.aiClient.knowledge('/knowledge', {
      headers: { 'x-correlation-id': correlationId },
    });
  }

  async ingest(input: IngestKnowledgeDto, actorSubject: string, correlationId: string) {
    const result = await this.aiClient.knowledge('/knowledge', {
      method: 'POST',
      headers: { 'x-actor-subject': actorSubject, 'x-correlation-id': correlationId },
      body: JSON.stringify({ ...input, demoData: true }),
    });
    const documentId =
      result && typeof result === 'object' && 'id' in result && typeof result.id === 'string'
        ? result.id
        : correlationId;
    await this.audit.append({
      action: 'knowledge.ingested',
      actorSubject,
      correlationId,
      entityId: documentId,
      entityType: 'knowledge',
      payload: { demoData: true, domain: input.domain, title: input.title },
    });
    return result;
  }
}
