/**
 * NbaController — public endpoints theo BUILD_SPEC §6.
 * Roles: sale + manager + admin (xem), manager/admin (admin endpoints).
 */
import {
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

import { IsString, IsNumber, IsArray, ValidateNested, IsOptional, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

const FEEDBACK_STATUSES = ['success', 'rejected', 'no_contact', 'callback'] as const;
const PRODUCTS = ['the', 'vay', 'dautu', 'baohiem', 'taikhoan'] as const;

class FeedbackDto {
  @IsString()
  rec_id!: string;

  @IsIn(FEEDBACK_STATUSES as unknown as string[])
  status!: string;

  /** Bỏ trống thì service lấy product_rank1 của đề xuất (cột feedback.product NOT NULL). */
  @IsIn(PRODUCTS as unknown as string[])
  @IsOptional()
  product?: string;

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

  /** call_lists.assigned_sale_id là BIGINT FK users(id). */
  @IsNumber()
  sale_id!: number;
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

/** FE gửi snake_case (api-client.saveCallNote) — DTO phải khớp, nếu không ValidationPipe chặn. */
class CreateNoteDto {
  @IsNumber()
  customer_id!: number;

  @IsString()
  note_text!: string;
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
  @Roles('sale', 'manager', 'admin')
  @ApiOperation({ summary: 'Call list T+1 với đề xuất mới nhất' })
  getCallList(@Query('date') date: string, @CurrentUser() user: AuthenticatedUser) {
    const d = date ?? new Date().toISOString().slice(0, 10);
    return this.nba.getCallList(d, user);
  }

  /** GET /api/nba/customers?q=&limit= — danh sách khách trong phạm vi được phép xem */
  @Get('customers')
  @Roles('sale', 'manager', 'admin')
  @ApiOperation({ summary: 'Danh sách khách theo phạm vi của người dùng' })
  listCustomers(
    @CurrentUser() user: AuthenticatedUser,
    @Query('q') q?: string,
    @Query('limit') limit?: string,
  ) {
    return this.nba.listCustomers(user, q, limit ? Number(limit) : undefined);
  }

  /** GET /api/nba/customer/:id */
  @Get('customer/:id')
  @Roles('sale', 'manager', 'admin')
  @ApiOperation({ summary: 'Đề xuất + staleness + versions cho 1 khách' })
  getCustomer(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthenticatedUser) {
    return this.nba.getCustomer(id, user);
  }

  /** GET /api/nba/customer/:id/assessment?as_of=YYYY-MM-DD */
  @Get('customer/:id/assessment')
  @Roles('sale', 'manager', 'admin')
  @ApiOperation({ summary: 'Tổng hợp 3/6 tháng + chấm policy từng gói + lý do phù hợp' })
  async assessCustomer(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
    @Query('as_of') asOf?: string,
  ) {
    await this.nba.authorizeAssessment(id, user);
    return this.assessment.assess(id, asOf);
  }

  /** POST /api/feedback */
  @Post('/feedback')
  @Roles('sale', 'manager', 'admin')
  @ApiOperation({ summary: 'Ghi feedback + kích suppression' })
  submitFeedback(@Body() body: FeedbackDto, @CurrentUser() user: AuthenticatedUser) {
    // feedback.sale_id là BIGINT FK users(id) — phải dùng user.id, không phải user.sub (chuỗi).
    return this.nba.submitFeedback({ ...body, sale_id: requireUserId(user) });
  }

  /** POST /api/admin/calllist */
  @Post('/admin/calllist')
  @Roles('manager', 'admin')
  @ApiOperation({ summary: 'Assign call list T+1' })
  assignCallList(@Body() body: AssignCallListDto, @CurrentUser() user: AuthenticatedUser) {
    // created_by = người thực hiện assign (trước đây ghi nhầm thành sale được giao).
    return this.nba.assignCallList(body.date, body.assignments, requireUserId(user));
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
  audit(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.nba.auditRecommendation(id, user);
  }

  /** POST /api/nba/notes */
  @Post('notes')
  @Roles('sale', 'manager', 'admin')
  @ApiOperation({ summary: 'Lưu ghi chú cuộc gọi' })
  saveCallNote(@Body() body: CreateNoteDto, @CurrentUser() user: AuthenticatedUser) {
    return this.nba.saveCallNote(body.customer_id, requireUserId(user), body.note_text, user);
  }

  /** GET /api/nba/notes/:customerId */
  @Get('notes/:customerId')
  @Roles('sale', 'manager', 'admin')
  @ApiOperation({ summary: 'Xem lịch sử ghi chú' })
  getCallNotes(
    @Param('customerId', ParseIntPipe) customerId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.nba.getCallNotes(customerId, user);
  }
}
