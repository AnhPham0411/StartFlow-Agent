import { Module } from '@nestjs/common';

import { AiClientModule } from '../ai-client/ai-client.module';
import { AuditModule } from '../audit/audit.module';
import { KnowledgeController } from './knowledge.controller';
import { KnowledgeService } from './knowledge.service';

@Module({
  imports: [AiClientModule, AuditModule],
  controllers: [KnowledgeController],
  providers: [KnowledgeService],
})
export class KnowledgeModule {}
