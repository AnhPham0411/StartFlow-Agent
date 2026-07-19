import { Controller, Get, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import type { AuthenticatedUser, RequestContext } from '../../common/types/request-context';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RunsService } from './runs.service';

@ApiTags('runs')
@ApiBearerAuth()
@Controller('api')
@Roles('employee')
export class RunsController {
  constructor(private readonly runs: RunsService) {}

  @Post('cases/:caseId/runs')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Snapshot a case and start a multi-agent run' })
  create(
    @Param('caseId', ParseUUIDPipe) caseId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: RequestContext,
  ) {
    return this.runs.create(caseId, user.sub, request.correlationId);
  }

  @Post('cases/:caseId/comparisons')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Start single- and multi-agent runs on one immutable snapshot' })
  compare(
    @Param('caseId', ParseUUIDPipe) caseId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: RequestContext,
  ) {
    return this.runs.createComparison(caseId, user.sub, request.correlationId);
  }

  @Get('runs/:runId')
  @ApiOperation({ summary: 'Get persisted run state and timeline' })
  get(@Param('runId', ParseUUIDPipe) runId: string) {
    return this.runs.get(runId);
  }
}
