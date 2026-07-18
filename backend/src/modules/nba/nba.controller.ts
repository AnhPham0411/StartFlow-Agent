/**
 * NbaController — public endpoints theo BUILD_SPEC §6.
 * Roles: sale + manager + admin (xem), manager/admin (admin endpoints).
 */
import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/request-context';
import { Roles } from '../auth/roles.decorator';
import { NbaService } from './nba.service';

import { IsString, IsNumber, IsArray, ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

class FeedbackDto {
  @IsString()
  rec_id!: string;

  @IsString()
  status!: string;

  @IsString()
  @IsOptional()
  reject_reason?: string;

  @IsString()
  @IsOptional()
  note?: string;
}

class CallListAssignment {
  @IsNumber()
  customer_id!: number;

  @IsString()
  sale_id!: string;
}

class AssignCallListDto {
  @IsString()
  date!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CallListAssignment)
  assignments!: CallListAssignment[];
}

class SetKpiDto {
  @IsString()
  month!: string;

  @IsString()
  product!: string;

  @IsNumber()
  multiplier!: number;
}

class CreateNoteDto {
  @IsNumber()
  customerId!: number;

  @IsString()
  noteText!: string;
}

@ApiTags('nba')
@ApiBearerAuth()
@Controller('api/nba')
export class NbaController {
  constructor(private readonly nba: NbaService) {}

  /** GET /api/nba/calllist?date=YYYY-MM-DD */
  @Get('calllist')
  @Roles('sale', 'manager', 'admin')
  @ApiOperation({ summary: 'Call list T+1 với đề xuất mới nhất' })
  getCallList(@Query('date') date: string, @CurrentUser() user: AuthenticatedUser) {
    const d = date ?? new Date().toISOString().slice(0, 10);
    return this.nba.getCallList(d, user);
  }

  /** GET /api/nba/customer/:id */
  @Get('customer/:id')
  @Roles('sale', 'manager', 'admin')
  @ApiOperation({ summary: 'Đề xuất + staleness + versions cho 1 khách' })
  getCustomer(@Param('id', ParseIntPipe) id: number) {
    return this.nba.getCustomer(id);
  }

  /** POST /api/feedback */
  @Post('/feedback')
  @Roles('sale', 'manager', 'admin')
  @ApiOperation({ summary: 'Ghi feedback + kích suppression' })
  submitFeedback(@Body() body: FeedbackDto, @CurrentUser() user: AuthenticatedUser) {
    return this.nba.submitFeedback({ ...body, sale_id: user.sub });
  }

  /** POST /api/admin/calllist */
  @Post('/admin/calllist')
  @Roles('manager', 'admin')
  @ApiOperation({ summary: 'Assign call list T+1' })
  assignCallList(@Body() body: AssignCallListDto) {
    return this.nba.assignCallList(body.date, body.assignments);
  }

  /** PUT /api/admin/kpi */
  @Put('/admin/kpi')
  @Roles('manager', 'admin')
  @ApiOperation({ summary: 'Set hệ số KPI tháng' })
  setKpi(@Body() body: SetKpiDto) {
    return this.nba.setKpi(body.month, body.product, body.multiplier);
  }

  /** GET /api/audit/recommendation/:id */
  @Get('/audit/recommendation/:id')
  @Roles('sale', 'manager', 'admin')
  @ApiOperation({ summary: 'Truy vết đề xuất (version + snapshot + rules)' })
  audit(@Param('id') id: string) {
    return this.nba.auditRecommendation(id);
  }

  /** POST /api/nba/notes */
  @Post('notes')
  @Roles('sale', 'manager', 'admin')
  @ApiOperation({ summary: 'Lưu ghi chú cuộc gọi' })
  saveCallNote(@Body() body: CreateNoteDto, @CurrentUser() user: AuthenticatedUser) {
    const saleId = user.id ? Number(user.id) : 1;
    return this.nba.saveCallNote(body.customerId, saleId, body.noteText);
  }

  /** GET /api/nba/notes/:customerId */
  @Get('notes/:customerId')
  @Roles('sale', 'manager', 'admin')
  @ApiOperation({ summary: 'Xem lịch sử ghi chú' })
  getCallNotes(@Param('customerId', ParseIntPipe) customerId: number) {
    return this.nba.getCallNotes(customerId);
  }
}
