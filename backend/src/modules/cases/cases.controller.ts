import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import type { AuthenticatedUser, RequestContext } from '../../common/types/request-context';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { CasesService } from './cases.service';
import { CreateCaseDto } from './dto/create-case.dto';

@ApiTags('cases')
@ApiBearerAuth()
@Controller('api/cases')
@Roles('analyst')
export class CasesController {
  constructor(private readonly casesService: CasesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a demo corporate-loan case' })
  @ApiCreatedResponse({ description: 'Case created' })
  create(
    @Body() input: CreateCaseDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: RequestContext,
  ) {
    return this.casesService.create(input, user.sub, request.correlationId);
  }

  @Get()
  @ApiOperation({ summary: 'List demo cases' })
  list() {
    return this.casesService.list();
  }

  @Get(':caseId')
  @ApiOperation({ summary: 'Get a case and its runs' })
  get(@Param('caseId', ParseUUIDPipe) caseId: string) {
    return this.casesService.get(caseId);
  }
}
