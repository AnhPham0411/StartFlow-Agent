import { Controller, Headers, Param, ParseUUIDPipe, Sse } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { Roles } from '../auth/roles.decorator';
import { EventStreamService } from './event-stream.service';
import { EventsService } from './events.service';

@ApiTags('runs')
@ApiBearerAuth()
@Controller('api/runs')
@Roles('analyst')
export class EventsController {
  constructor(
    private readonly eventStream: EventStreamService,
    private readonly events: EventsService,
  ) {}

  @Sse(':runId/events')
  @ApiOperation({ summary: 'Replay and stream filtered run events' })
  async stream(
    @Param('runId', ParseUUIDPipe) runId: string,
    @Headers('last-event-id') lastEventId?: string,
  ) {
    await this.events.assertRun(runId);
    const parsed = Number(lastEventId ?? 0);
    const afterSequence = Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
    return this.eventStream.stream(runId, afterSequence);
  }
}
