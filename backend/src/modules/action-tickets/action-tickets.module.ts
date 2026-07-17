import { Module } from '@nestjs/common';

import { ActionTicketsService } from './action-tickets.service';

@Module({
  providers: [ActionTicketsService],
  exports: [ActionTicketsService],
})
export class ActionTicketsModule {}
