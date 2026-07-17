import { Body, Controller, HttpCode, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import type { AuthenticatedUser, RequestContext } from '../../common/types/request-context';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { ApprovalsService } from './approvals.service';
import { CreateApprovalDto } from './dto/create-approval.dto';

@ApiTags('approvals')
@ApiBearerAuth()
@Controller('api/runs')
@Roles('approver')
export class ApprovalsController {
  constructor(private readonly approvals: ApprovalsService) {}

  @Post(':runId/approvals')
  @HttpCode(200)
  @ApiOperation({ summary: 'Approve or reject a proposed action with optimistic concurrency' })
  decide(
    @Param('runId', ParseUUIDPipe) runId: string,
    @Body() input: CreateApprovalDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: RequestContext,
  ) {
    return this.approvals.decide(runId, input, user.sub, request.correlationId);
  }
}
