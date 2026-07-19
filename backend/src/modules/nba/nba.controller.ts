/**
 * NbaController — public endpoints theo BUILD_SPEC §6.
 * Roles: sale + manager + admin (xem), manager/admin (admin endpoints).
 */
import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
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
import { AssessmentService } from './assessment/assessment.service';
import { NbaService } from './nba.service';

import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

const FEEDBACK_STATUSES = ['success', 'rejected', 'no_contact', 'callback'] as const;
const PRODUCTS = ['the', 'vay', 'dautu', 'baohiem', 'taikhoan'] as const;

class FeedbackDto {
  @IsString()
  @Matches(/^\d+$/)
  rec_id!: string;

  @IsIn(FEEDBACK_STATUSES as unknown as string[])
  status!: string;

  /** Bỏ trống thì service lấy product_rank1 của đề xuất (cột feedback.product NOT NULL). */
  @IsIn(PRODUCTS as unknown as string[])
  @IsOptional()
  product?: string;

  @IsString()
  @IsOptional()
  @MaxLength(128)
  reject_reason?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  note?: string;
}

class CallListAssignment {
  @IsInt()
  @Min(1)
  customer_id!: number;

  /** call_lists.assigned_sale_id là BIGINT FK users(id). */
  @IsInt()
  @Min(1)
  sale_id!: number;
}

class AssignCallListDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CallListAssignment)
  assignments!: CallListAssignment[];
}

class SetKpiDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}$/)
  month!: string;

  @IsIn(PRODUCTS as unknown as string[])
  product!: string;

  @Min(0.8)
  @Max(1.5)
  multiplier!: number;
}

/** FE gửi snake_case (api-client.saveCallNote) — DTO phải khớp, nếu không ValidationPipe chặn. */
class CreateNoteDto {
  @IsInt()
  @Min(1)
  customer_id!: number;

  @IsString()
  @MaxLength(2000)
  note_text!: string;
}

function requireIsoDate(value: string, field: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    throw new BadRequestException(`${field} must use YYYY-MM-DD`);
  }
  return value;
}

/**
 * Mọi bảng NBA tham chiếu users(id) kiểu BIGINT. Token không map được về user trong DB
 * thì phải chặn thẳng, tránh fallback im lặng về id=1 (ghi nhầm dữ liệu sang sale khác).
 */
function requireUserId(user: AuthenticatedUser): number {
  if (typeof user.id !== 'number' || !Number.isFinite(user.id)) {
    throw new ForbiddenException('Tài khoản chưa được liên kết với user trong hệ thống NBA');
  }
  return user.id;
}

@ApiTags('nba')
@ApiBearerAuth()
@Controller('api/nba')
export class NbaController {
  constructor(
    private readonly nba: NbaService,
    private readonly assessment: AssessmentService,
  ) {}

  /** GET /api/nba/calllist?date=YYYY-MM-DD */
  @Get('calllist')
  @Roles('employee')
  @ApiOperation({ summary: 'Call list T+1 với đề xuất mới nhất' })
  getCallList(@Query('date') date: string, @CurrentUser() user: AuthenticatedUser) {
    const d = date ? requireIsoDate(date, 'date') : new Date().toISOString().slice(0, 10);
    return this.nba.getCallList(d, user);
  }

  /** GET /api/nba/customers?q=&limit= — danh sách khách trong phạm vi được phép xem */
  @Get('customers')
  @Roles('employee')
  @ApiOperation({ summary: 'Danh sách khách theo phạm vi của người dùng' })
  listCustomers(
    @CurrentUser() user: AuthenticatedUser,
    @Query('q') q?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = limit === undefined ? undefined : Number(limit);
    if (parsedLimit !== undefined && (!Number.isInteger(parsedLimit) || parsedLimit < 1)) {
      throw new BadRequestException('limit must be a positive integer');
    }
    return this.nba.listCustomers(user, q, parsedLimit);
  }

  /** GET /api/nba/customer/:id */
  @Get('customer/:id')
  @Roles('employee')
  @ApiOperation({ summary: 'Đề xuất + staleness + versions cho 1 khách' })
  getCustomer(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthenticatedUser) {
    return this.nba.getCustomer(id, user);
  }

  /** GET /api/nba/customer/:id/assessment?as_of=YYYY-MM-DD */
  @Get('customer/:id/assessment')
  @Roles('employee')
  @ApiOperation({ summary: 'Tổng hợp 3/6 tháng + chấm policy từng gói + lý do phù hợp' })
  async assessCustomer(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
    @Query('as_of') asOf?: string,
  ) {
    await this.nba.authorizeAssessment(id, user);
    return this.assessment.assess(id, asOf ? requireIsoDate(asOf, 'as_of') : undefined);
  }

  /** POST /api/feedback */
  @Post('/feedback')
  @Roles('employee')
  @ApiOperation({ summary: 'Ghi feedback + kích suppression' })
  submitFeedback(@Body() body: FeedbackDto, @CurrentUser() user: AuthenticatedUser) {
    // feedback.sale_id là BIGINT FK users(id) — phải dùng user.id, không phải user.sub (chuỗi).
    requireUserId(user);
    return this.nba.submitFeedback(body, user);
  }

  /** POST /api/admin/calllist */
  @Post('/admin/calllist')
  @Roles('manager')
  @ApiOperation({ summary: 'Assign call list T+1' })
  assignCallList(@Body() body: AssignCallListDto, @CurrentUser() user: AuthenticatedUser) {
    // created_by = người thực hiện assign (trước đây ghi nhầm thành sale được giao).
    return this.nba.assignCallList(body.date, body.assignments, requireUserId(user), user);
  }

  /** PUT /api/admin/kpi */
  @Put('/admin/kpi')
  @Roles('manager')
  @ApiOperation({ summary: 'Set hệ số KPI tháng' })
  setKpi(@Body() body: SetKpiDto) {
    return this.nba.setKpi(body.month, body.product, body.multiplier);
  }

  /** GET /api/audit/recommendation/:id */
  @Get('/audit/recommendation/:id')
  @Roles('employee')
  @ApiOperation({ summary: 'Truy vết đề xuất (version + snapshot + rules)' })
  audit(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.nba.auditRecommendation(id, user);
  }

  /** POST /api/nba/notes */
  @Post('notes')
  @Roles('employee')
  @ApiOperation({ summary: 'Lưu ghi chú cuộc gọi' })
  saveCallNote(@Body() body: CreateNoteDto, @CurrentUser() user: AuthenticatedUser) {
    return this.nba.saveCallNote(body.customer_id, requireUserId(user), body.note_text, user);
  }

  /** GET /api/nba/notes/:customerId */
  @Get('notes/:customerId')
  @Roles('employee')
  @ApiOperation({ summary: 'Xem lịch sử ghi chú' })
  getCallNotes(
    @Param('customerId', ParseIntPipe) customerId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.nba.getCallNotes(customerId, user);
  }
}
