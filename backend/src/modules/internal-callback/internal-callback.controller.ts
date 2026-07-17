import { Body, ConflictException, Controller, Headers, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';

import { InternalServiceGuard } from '../auth/internal-service.guard';
import { Public } from '../auth/public.decorator';
import { RecordEventDto } from '../events/dto/record-event.dto';
import { EventsService } from '../events/events.service';

@ApiTags('internal')
@Controller('internal/ai')
@Public()
@UseGuards(InternalServiceGuard)
@ApiSecurity('internal-service-token')
export class InternalCallbackController {
  constructor(private readonly events: EventsService) {}

  @Post('events')
  @ApiOperation({ summary: 'Persist one filtered, monotonic AI workflow event' })
  record(
    @Body() input: RecordEventDto,
    @Headers('x-run-id') headerRunId?: string,
    @Headers('idempotency-key') headerIdempotencyKey?: string,
  ) {
    if (headerRunId && headerRunId !== input.runId) {
      throw new ConflictException('Run ID header and body do not match');
    }
    if (headerIdempotencyKey && headerIdempotencyKey !== input.idempotencyKey) {
      throw new ConflictException('Idempotency key header and body do not match');
    }
    return this.events.record(input);
  }
}
