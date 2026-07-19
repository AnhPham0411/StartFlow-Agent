import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type { AuthenticatedUser } from '../../common/types/request-context';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { ApplicationRole } from '../auth/roles.decorator';
import type {
  CreateAccountDto,
  CreateBranchDto,
  UpdateAccountDto,
  UpdateBranchDto,
} from './dto/identity.dto';
import { KeycloakAdminClient } from './keycloak-admin.client';

interface BranchRow {
  account_count: number;
  active: boolean;
  code: string;
  id: bigint | number;
  name: string;
}

interface AccountRow {
  active: boolean;
  branch_active?: boolean | null;
  branch_code?: string | null;
  branch_id?: bigint | number | null;
  branch_name?: string | null;
  full_name?: string;
  id: bigint | number;
  keycloak_user_id: string | null;
  role: ApplicationRole;
  username: string;
}

const PERMISSIONS: Record<ApplicationRole, string[]> = {
  employee: ['STARTFLOW_CUSTOMER_VIEW'],
  manager: ['STARTFLOW_CUSTOMER_VIEW', 'STARTFLOW_BRANCH_VIEW', 'STARTFLOW_ACCOUNT_VIEW'],
  admin: [
    'STARTFLOW_CUSTOMER_VIEW',
    'STARTFLOW_BRANCH_VIEW',
    'STARTFLOW_BRANCH_MANAGE',
    'STARTFLOW_ACCOUNT_VIEW',
    'STARTFLOW_ACCOUNT_MANAGE',
  ],
};

@Injectable()
export class IdentityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly keycloak: KeycloakAdminClient,
    private readonly audit: AuditService,
  ) {}

  async me(user: AuthenticatedUser) {
    if (user.id === undefined) throw new ForbiddenException('Account is not mapped locally');
    const account = await this.requireAccount(user.id);
    if (!account.active) throw new ForbiddenException('Account is disabled');
    return {
      id: Number(account.id),
      username: account.username,
      full_name: account.full_name ?? account.username,
      role: account.role,
      active: account.active,
      branch: this.branchRef(account),
      permissions: PERMISSIONS[account.role],
    };
  }

  async listBranches(actor: AuthenticatedUser, search?: string, active?: boolean) {
    const params: unknown[] = [];
    const filters: string[] = [];
    if (actor.effectiveRole === 'manager') {
      if (!actor.branchId) throw new ForbiddenException('Manager branch is not mapped');
      params.push(actor.branchId);
      filters.push(`b.id = $${params.length}::bigint`);
    }
    if (search?.trim()) {
      params.push(`%${search.trim()}%`);
      filters.push(`(b.code ILIKE $${params.length} OR b.name ILIKE $${params.length})`);
    }
    if (active !== undefined) {
      params.push(active);
      filters.push(`b.active = $${params.length}`);
    }
    const rows = await this.prisma.$queryRawUnsafe<BranchRow[]>(
      `SELECT b.id, b.code, b.name, b.active,
              count(u.id) FILTER (WHERE u.active)::int AS account_count
       FROM branches b LEFT JOIN users u ON u.branch_id = b.id
       ${filters.length ? `WHERE ${filters.join(' AND ')}` : ''}
       GROUP BY b.id ORDER BY b.code`,
      ...params,
    );
    return rows.map((row) => ({ ...row, id: Number(row.id) }));
  }

  async createBranch(input: CreateBranchDto, actor: AuthenticatedUser, correlationId: string) {
    try {
      const [row] = await this.prisma.$queryRawUnsafe<BranchRow[]>(
        `INSERT INTO branches(code, name) VALUES($1, $2)
         RETURNING id, code, name, active, 0::int AS account_count`,
        input.code,
        input.name,
      );
      if (!row) throw new Error('Branch insert returned no row');
      await this.record('identity.branch.create', 'branch', Number(row.id), actor, correlationId, {
        code: row.code,
      });
      return { ...row, id: Number(row.id) };
    } catch (error) {
      if (this.isUniqueViolation(error)) throw new ConflictException('Branch code already exists');
      throw error;
    }
  }

  async updateBranch(
    id: number,
    input: UpdateBranchDto,
    actor: AuthenticatedUser,
    correlationId: string,
  ) {
    if (input.active === false) return this.deactivateBranch(id, actor, correlationId);
    const [row] = await this.prisma.$queryRawUnsafe<BranchRow[]>(
      `UPDATE branches SET name=$2, active=COALESCE($3, active), updated_at=now()
       WHERE id=$1::bigint RETURNING id, code, name, active,
       (SELECT count(*)::int FROM users WHERE branch_id=$1::bigint AND active) AS account_count`,
      id,
      input.name,
      input.active ?? null,
    );
    if (!row) throw new NotFoundException(`Branch ${id} does not exist`);
    await this.record('identity.branch.update', 'branch', id, actor, correlationId, {
      active: row.active,
    });
    return { ...row, id: Number(row.id) };
  }

  async deactivateBranch(id: number, actor: AuthenticatedUser, correlationId: string) {
    const [state] = await this.prisma.$queryRawUnsafe<Array<{ account_count: number }>>(
      `SELECT count(*)::int AS account_count FROM users WHERE branch_id=$1::bigint AND active`,
      id,
    );
    if ((state?.account_count ?? 0) > 0) {
      throw new ConflictException('Branch still has active accounts');
    }
    const changed = await this.prisma.$executeRawUnsafe(
      `UPDATE branches SET active=false, updated_at=now() WHERE id=$1::bigint AND active`,
      id,
    );
    if (!changed) throw new NotFoundException(`Active branch ${id} does not exist`);
    await this.record('identity.branch.deactivate', 'branch', id, actor, correlationId);
    return { ok: true };
  }

  async listAccounts(
    actor: AuthenticatedUser,
    filters: { active?: boolean; branchId?: number; role?: ApplicationRole; search?: string },
  ) {
    const params: unknown[] = [];
    const where: string[] = [];
    if (actor.effectiveRole === 'manager') {
      if (!actor.branchId) throw new ForbiddenException('Manager branch is not mapped');
      params.push(actor.branchId);
      where.push(`u.branch_id=$${params.length}::bigint`);
    } else if (filters.branchId) {
      params.push(filters.branchId);
      where.push(`u.branch_id=$${params.length}::bigint`);
    }
    if (filters.role) {
      params.push(filters.role);
      where.push(`u.role=$${params.length}::user_role`);
    }
    if (filters.active !== undefined) {
      params.push(filters.active);
      where.push(`u.active=$${params.length}`);
    }
    if (filters.search?.trim()) {
      params.push(`%${filters.search.trim()}%`);
      where.push(`(u.username ILIKE $${params.length} OR u.full_name ILIKE $${params.length})`);
    }
    const rows = await this.prisma.$queryRawUnsafe<AccountRow[]>(
      `${this.accountSelect()} ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY u.username`,
      ...params,
    );
    return rows.map((row) => this.accountDto(row));
  }

  async createAccount(input: CreateAccountDto, actor: AuthenticatedUser, correlationId: string) {
    const branch = await this.validateRoleBranch(input.role, input.branch_id);
    const keycloakId = await this.keycloak.provisionAccount(
      input.username,
      input.full_name,
      input.role,
    );
    try {
      const [row] = await this.prisma.$queryRawUnsafe<AccountRow[]>(
        `INSERT INTO users(username, full_name, role, branch, branch_id, keycloak_user_id, active)
         VALUES($1,$2,$3::user_role,$4,$5::bigint,$6,true)
         RETURNING id, username, full_name, role::text AS role, active, keycloak_user_id,
                   branch_id, $7::text AS branch_code, $4::text AS branch_name, $8::boolean AS branch_active`,
        input.username,
        input.full_name,
        input.role,
        branch?.name ?? null,
        branch?.id ?? null,
        keycloakId,
        branch?.code ?? null,
        branch?.active ?? null,
      );
      if (!row) throw new Error('Account insert returned no row');
      await this.record(
        'identity.account.create',
        'account',
        Number(row.id),
        actor,
        correlationId,
        {
          role: input.role,
          branch_id: input.branch_id ?? null,
        },
      );
      return this.accountDto(row);
    } catch (error) {
      await this.keycloak.deleteAccount(keycloakId).catch(() => undefined);
      if (this.isUniqueViolation(error)) throw new ConflictException('Username already exists');
      throw error;
    }
  }

  async updateAccount(
    id: number,
    input: UpdateAccountDto,
    actor: AuthenticatedUser,
    correlationId: string,
  ) {
    const current = await this.requireAccount(id);
    const branch = await this.validateRoleBranch(input.role, input.branch_id);
    if (current.role === 'admin' && input.role !== 'admin') await this.assertAnotherAdmin(id);
    if (current.keycloak_user_id) {
      await this.keycloak.updateAccount(current.keycloak_user_id, {
        fullName: input.full_name,
        role: input.role,
      });
    }
    let row: AccountRow | undefined;
    try {
      [row] = await this.prisma.$queryRawUnsafe<AccountRow[]>(
        `UPDATE users SET full_name=$2, role=$3::user_role, branch=$4, branch_id=$5::bigint,
                          updated_at=now()
         WHERE id=$1::bigint
         RETURNING id, username, full_name, role::text AS role, active, keycloak_user_id,
                   branch_id, $6::text AS branch_code, $4::text AS branch_name, $7::boolean AS branch_active`,
        id,
        input.full_name,
        input.role,
        branch?.name ?? null,
        branch?.id ?? null,
        branch?.code ?? null,
        branch?.active ?? null,
      );
    } catch (error) {
      if (current.keycloak_user_id) {
        await this.keycloak
          .updateAccount(current.keycloak_user_id, {
            fullName: current.full_name,
            role: current.role,
          })
          .catch(() => undefined);
      }
      throw error;
    }
    if (!row) throw new NotFoundException(`Account ${id} does not exist`);
    await this.record('identity.account.update', 'account', id, actor, correlationId, {
      role: input.role,
      branch_id: input.branch_id ?? null,
    });
    return this.accountDto(row);
  }

  async setAccountEnabled(
    id: number,
    enabled: boolean,
    actor: AuthenticatedUser,
    correlationId: string,
  ) {
    const account = await this.requireAccount(id);
    if (!enabled && (actor.id === id || actor.sub === account.keycloak_user_id)) {
      throw new ForbiddenException('You cannot disable your own account');
    }
    if (!enabled && account.role === 'admin') await this.assertAnotherAdmin(id);
    if (!account.keycloak_user_id) throw new ConflictException('Account is not synced to Keycloak');

    await this.keycloak.setEnabled(account.keycloak_user_id, enabled);
    try {
      await this.prisma.$executeRawUnsafe(
        `UPDATE users SET active=$2, updated_at=now() WHERE id=$1::bigint`,
        id,
        enabled,
      );
    } catch (error) {
      await this.keycloak.setEnabled(account.keycloak_user_id, !enabled).catch(() => undefined);
      throw error;
    }
    await this.record(
      enabled ? 'identity.account.enable' : 'identity.account.disable',
      'account',
      id,
      actor,
      correlationId,
    );
    return { ok: true };
  }

  async resetPassword(id: number, actor: AuthenticatedUser, correlationId: string) {
    const account = await this.requireAccount(id);
    if (!account.keycloak_user_id) throw new ConflictException('Account is not synced to Keycloak');
    await this.keycloak.resetPassword(account.keycloak_user_id);
    await this.record('identity.account.reset_password', 'account', id, actor, correlationId);
    return { ok: true };
  }

  private async validateRoleBranch(role: ApplicationRole, branchId?: number) {
    if (role === 'admin') {
      if (branchId !== undefined) throw new BadRequestException('Admin cannot belong to a branch');
      return null;
    }
    if (!branchId) throw new BadRequestException('Manager and employee require a branch');
    const [branch] = await this.prisma.$queryRawUnsafe<BranchRow[]>(
      `SELECT id, code, name, active, 0::int AS account_count FROM branches WHERE id=$1::bigint`,
      branchId,
    );
    if (!branch) throw new NotFoundException(`Branch ${branchId} does not exist`);
    if (!branch.active)
      throw new ConflictException('Account cannot be assigned to an inactive branch');
    return branch;
  }

  private async requireAccount(id: number): Promise<AccountRow> {
    const [row] = await this.prisma.$queryRawUnsafe<AccountRow[]>(
      `${this.accountSelect()} WHERE u.id=$1::bigint`,
      id,
    );
    if (!row) throw new NotFoundException(`Account ${id} does not exist`);
    return row;
  }

  private async assertAnotherAdmin(excludedId: number): Promise<void> {
    const [row] = await this.prisma.$queryRawUnsafe<Array<{ count: number }>>(
      `SELECT count(*)::int AS count FROM users
       WHERE role='admin'::user_role AND active AND id<>$1::bigint`,
      excludedId,
    );
    if ((row?.count ?? 0) < 1) throw new ConflictException('The final active admin is protected');
  }

  private accountSelect(): string {
    return `SELECT u.id, u.username, u.full_name, u.role::text AS role, u.active,
                   u.keycloak_user_id, u.branch_id, b.code AS branch_code,
                   b.name AS branch_name, b.active AS branch_active
            FROM users u LEFT JOIN branches b ON b.id=u.branch_id`;
  }

  private accountDto(row: AccountRow) {
    return {
      id: Number(row.id),
      username: row.username,
      full_name: row.full_name ?? row.username,
      role: row.role,
      active: row.active,
      branch: this.branchRef(row),
      identity_synced: Boolean(row.keycloak_user_id),
    };
  }

  private branchRef(row: AccountRow) {
    return row.branch_id && row.branch_code && row.branch_name
      ? { id: Number(row.branch_id), code: row.branch_code, name: row.branch_name }
      : null;
  }

  private record(
    action: string,
    entityType: string,
    entityId: number,
    actor: AuthenticatedUser,
    correlationId: string,
    payload?: Record<string, unknown>,
  ) {
    return this.audit.append({
      action,
      actorSubject: actor.sub,
      correlationId,
      entityId: String(entityId),
      entityType,
      payload,
    });
  }

  private isUniqueViolation(error: unknown): boolean {
    if (typeof error !== 'object' || error === null) return false;
    if ('code' in error && error.code === '23505') return true;
    if (
      'meta' in error &&
      typeof error.meta === 'object' &&
      error.meta !== null &&
      'code' in error.meta
    ) {
      return error.meta.code === '23505';
    }
    return false;
  }
}
