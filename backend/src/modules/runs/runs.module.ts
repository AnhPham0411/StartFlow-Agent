import { Module } from '@nestjs/common';

import { AiClientModule } from '../ai-client/ai-client.module';
import { AuditModule } from '../audit/audit.module';
import { CasesModule } from '../cases/cases.module';
import { EventsModule } from '../events/events.module';
import { RunsController } from './runs.controller';
import { RunsService } from './runs.service';

@Module({
  imports: [AiClientModule, AuditModule, CasesModule, EventsModule],
  controllers: [RunsController],
  providers: [RunsService],
  exports: [RunsService],
})
export class RunsModule {}
