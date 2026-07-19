import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';

import type { PrismaService } from '../src/database/prisma.service';
import type { AuditService } from '../src/modules/audit/audit.service';
import { IdentityService } from '../src/modules/identity/identity.service';
import type { KeycloakAdminClient } from '../src/modules/identity/keycloak-admin.client';

describe('IdentityService protections', () => {
  const prisma = {
    $executeRawUnsafe: jest.fn(),
    $queryRawUnsafe: jest.fn(),
  } as unknown as PrismaService;
  const keycloak = {
    setEnabled: jest.fn(),
  } as unknown as KeycloakAdminClient;
  const audit = { append: jest.fn() } as unknown as AuditService;
  const actor = {
    active: true,
    effectiveRole: 'admin' as const,
    id: 17,
    roles: ['admin'],
    sub: 'kc-admin',
    username: 'user017',
  };

  beforeEach(() => jest.clearAllMocks());

  it('rejects deactivating a branch that still has active accounts', async () => {
    jest.mocked(prisma.$queryRawUnsafe).mockResolvedValueOnce([{ account_count: 2 }] as never);
    const service = new IdentityService(prisma, keycloak, audit);

    await expect(
      service.deactivateBranch(1, actor, '00000000-0000-4000-8000-000000000001'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.$executeRawUnsafe).not.toHaveBeenCalled();
  });

  it('rejects disabling the currently authenticated administrator', async () => {
    jest
      .mocked(prisma.$queryRawUnsafe)
      .mockResolvedValueOnce([
        { active: true, id: 17n, keycloak_user_id: 'kc-admin', role: 'admin', username: 'user017' },
      ] as never);
    const service = new IdentityService(prisma, keycloak, audit);

    await expect(
      service.setAccountEnabled(17, false, actor, '00000000-0000-4000-8000-000000000001'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(keycloak.setEnabled).not.toHaveBeenCalled();
  });

  it('rejects disabling the final active administrator', async () => {
    jest
      .mocked(prisma.$queryRawUnsafe)
      .mockResolvedValueOnce([
        { active: true, id: 28n, keycloak_user_id: 'kc-other', role: 'admin', username: 'user028' },
      ] as never)
      .mockResolvedValueOnce([{ count: 0 }] as never);
    const service = new IdentityService(prisma, keycloak, audit);

    await expect(
      service.setAccountEnabled(28, false, actor, '00000000-0000-4000-8000-000000000001'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(keycloak.setEnabled).not.toHaveBeenCalled();
  });

  it.each([
    ['admin', 1],
    ['manager', undefined],
    ['employee', undefined],
  ] as const)(
    'rejects invalid %s branch assignment before contacting Keycloak',
    async (role, branchId) => {
      const service = new IdentityService(prisma, keycloak, audit);

      await expect(
        service.createAccount(
          {
            branch_id: branchId,
            full_name: 'Demo User',
            role,
            username: 'demo.user',
          },
          actor,
          '00000000-0000-4000-8000-000000000001',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    },
  );

  it('limits a manager account listing to the authenticated branch', async () => {
    jest.mocked(prisma.$queryRawUnsafe).mockResolvedValueOnce([] as never);
    const service = new IdentityService(prisma, keycloak, audit);

    await service.listAccounts(
      { ...actor, branchId: 4, effectiveRole: 'manager', roles: ['manager'] },
      {},
    );

    expect(prisma.$queryRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('u.branch_id=$1::bigint'),
      4,
    );
  });
});
