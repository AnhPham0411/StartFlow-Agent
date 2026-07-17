import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { EventStreamService } from './event-stream.service';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';

@Module({
  imports: [AuditModule],
  controllers: [EventsController],
  providers: [EventStreamService, EventsService],
  exports: [EventStreamService, EventsService],
})
export class EventsModule {}
