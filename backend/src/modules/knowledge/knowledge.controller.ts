import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import type { AuthenticatedUser, RequestContext } from '../../common/types/request-context';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { IngestKnowledgeDto } from './dto/ingest-knowledge.dto';
import { KnowledgeService } from './knowledge.service';

@ApiTags('knowledge')
@ApiBearerAuth()
@Controller('api/knowledge')
@Roles('admin')
export class KnowledgeController {
  constructor(private readonly knowledge: KnowledgeService) {}

  @Get()
  @ApiOperation({ summary: 'List demo knowledge documents through the AI boundary' })
  list(@Req() request: RequestContext) {
    return this.knowledge.list(request.correlationId);
  }

  @Post()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Ingest a demo knowledge document through the AI boundary' })
  ingest(
    @Body() input: IngestKnowledgeDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: RequestContext,
  ) {
    return this.knowledge.ingest(input, user.sub, request.correlationId);
  }
}
