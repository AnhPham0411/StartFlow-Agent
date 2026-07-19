import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import type { AuthenticatedUser, RequestContext } from '../../common/types/request-context';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles, type ApplicationRole } from '../auth/roles.decorator';
import {
  CreateAccountDto,
  CreateBranchDto,
  UpdateAccountDto,
  UpdateBranchDto,
} from './dto/identity.dto';
import { IdentityService } from './identity.service';

function optionalBoolean(value?: string): boolean | undefined {
  if (value === undefined) return undefined;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new BadRequestException('active must be true or false');
}

function optionalRole(value?: string): ApplicationRole | undefined {
  if (value === undefined) return undefined;
  if (value === 'employee' || value === 'manager' || value === 'admin') return value;
  throw new BadRequestException('role must be employee, manager or admin');
}

@ApiTags('auth')
@ApiBearerAuth()
@Controller('api/auth')
export class AuthProfileController {
  constructor(private readonly identity: IdentityService) {}

  @Get('me')
  @Roles('employee')
  @ApiOperation({ summary: 'Return the effective application identity and permissions' })
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.identity.me(user);
  }
}

@ApiTags('identity-admin')
@ApiBearerAuth()
@Controller('api/admin')
@Roles('manager')
export class IdentityAdminController {
  constructor(private readonly identity: IdentityService) {}

  @Get('branches')
  listBranches(
    @CurrentUser() actor: AuthenticatedUser,
    @Query('q') q?: string,
    @Query('active') active?: string,
  ) {
    return this.identity.listBranches(actor, q, optionalBoolean(active));
  }

  @Post('branches')
  @Roles('admin')
  createBranch(
    @Body() body: CreateBranchDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: RequestContext,
  ) {
    return this.identity.createBranch(body, actor, request.correlationId);
  }

  @Put('branches/:id')
  @Roles('admin')
  updateBranch(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateBranchDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: RequestContext,
  ) {
    return this.identity.updateBranch(id, body, actor, request.correlationId);
  }

  @Post('branches/:id/deactivate')
  @Roles('admin')
  deactivateBranch(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: RequestContext,
  ) {
    return this.identity.deactivateBranch(id, actor, request.correlationId);
  }

  @Get('accounts')
  listAccounts(
    @CurrentUser() actor: AuthenticatedUser,
    @Query('q') q?: string,
    @Query('role') role?: string,
    @Query('branch_id') branchId?: string,
    @Query('active') active?: string,
  ) {
    const parsedBranch = branchId === undefined ? undefined : Number(branchId);
    if (parsedBranch !== undefined && (!Number.isInteger(parsedBranch) || parsedBranch < 1)) {
      throw new BadRequestException('branch_id must be a positive integer');
    }
    return this.identity.listAccounts(actor, {
      active: optionalBoolean(active),
      branchId: parsedBranch,
      role: optionalRole(role),
      search: q,
    });
  }

  @Post('accounts')
  @Roles('admin')
  createAccount(
    @Body() body: CreateAccountDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: RequestContext,
  ) {
    return this.identity.createAccount(body, actor, request.correlationId);
  }

  @Put('accounts/:id')
  @Roles('admin')
  updateAccount(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateAccountDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: RequestContext,
  ) {
    return this.identity.updateAccount(id, body, actor, request.correlationId);
  }

  @Post('accounts/:id/enable')
  @Roles('admin')
  enableAccount(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: RequestContext,
  ) {
    return this.identity.setAccountEnabled(id, true, actor, request.correlationId);
  }

  @Post('accounts/:id/disable')
  @Roles('admin')
  disableAccount(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: RequestContext,
  ) {
    return this.identity.setAccountEnabled(id, false, actor, request.correlationId);
  }

  @Post('accounts/:id/reset-password')
  @Roles('admin')
  resetPassword(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: RequestContext,
  ) {
    return this.identity.resetPassword(id, actor, request.correlationId);
  }
}
