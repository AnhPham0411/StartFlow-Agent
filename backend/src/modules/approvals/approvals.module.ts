import { Module } from '@nestjs/common';

import { ActionTicketsModule } from '../action-tickets/action-tickets.module';
import { AuditModule } from '../audit/audit.module';
import { ApprovalsController } from './approvals.controller';
import { ApprovalsService } from './approvals.service';

@Module({
  imports: [ActionTicketsModule, AuditModule],
  controllers: [ApprovalsController],
  providers: [ApprovalsService],
})
export class ApprovalsModule {}
