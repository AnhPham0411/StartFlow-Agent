import { ForbiddenException } from '@nestjs/common';

import type { AuthenticatedUser } from '../src/common/types/request-context';
import type { PrismaService } from '../src/database/prisma.service';
import { NbaService } from '../src/modules/nba/nba.service';

function createSubject() {
  const prisma = {
    $queryRawUnsafe: jest.fn(),
  } as unknown as PrismaService;

  return {
    prisma,
    query: prisma.$queryRawUnsafe as jest.Mock,
    service: new NbaService(prisma),
  };
}

const analyst: AuthenticatedUser = {
  id: 11,
  roles: ['analyst'],
  sub: 'analyst-subject',
  username: 'sales.demo',
};

const approver: AuthenticatedUser = {
  branch: 'HN-01',
  branchId: 1,
  id: 21,
  roles: ['manager'],
  sub: 'approver-subject',
  username: 'manager.demo',
};

const realmAdmin: AuthenticatedUser = {
  roles: ['realm-admin', 'admin'],
  sub: 'realm-admin-subject',
};

describe('NbaService authorization scope', () => {
  it('keeps legacy analyst call lists scoped to the linked sale id', async () => {
    const { query, service } = createSubject();
    query.mockResolvedValue([]);

    await service.getCallList('2026-07-18', analyst);

    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('assigned_sale_id = $2::bigint'),
      '2026-07-18',
      11,
    );
  });

  it('keeps legacy approver call lists scoped to the linked branch', async () => {
    const { query, service } = createSubject();
    query.mockResolvedValue([]);

    await service.getCallList('2026-07-18', approver);

    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('SELECT id FROM users WHERE branch_id = $2::bigint'),
      '2026-07-18',
      1,
    );
  });

  it('lets a realm admin without a linked NBA user view the complete call list', async () => {
    const { query, service } = createSubject();
    query.mockResolvedValue([]);

    await service.getCallList('2026-07-18', realmAdmin);

    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.not.stringContaining('assigned_sale_id = $2::bigint'),
      '2026-07-18',
    );
  });

  it('lets a realm admin without a linked NBA user list every customer', async () => {
    const { query, service } = createSubject();
    query.mockResolvedValue([]);

    await service.listCustomers(realmAdmin);

    expect(query).toHaveBeenCalledWith(expect.not.stringContaining('WHERE c.id IN'), 200);
  });

  it('rejects feedback for a recommendation outside the caller scope', async () => {
    const { query, service } = createSubject();
    query
      .mockResolvedValueOnce([{ customer_id: 99, product_rank1: 'the', product_rank2: null }])
      .mockResolvedValueOnce([{ n: 0 }]);

    await expect(
      service.submitFeedback({ rec_id: '100', status: 'success' }, analyst),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(query).toHaveBeenCalledTimes(2);
  });

  it('rejects manager assignment to a sale outside the linked branch', async () => {
    const { query, service } = createSubject();
    query.mockResolvedValueOnce([{ n: 0 }]);

    await expect(
      service.assignCallList(
        '2026-07-19',
        [{ customer_id: 1, sale_id: 999 }],
        approver.id!,
        approver,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(query).toHaveBeenCalledTimes(1);
  });
});

describe('NbaService recommendation staleness', () => {
  it('aggregates CASA, debt and product flags independently to avoid join fan-out', async () => {
    const { query, service } = createSubject();
    query
      .mockResolvedValueOnce([{ n: 1 }])
      .mockResolvedValueOnce([{ full_name: 'Khách hàng Demo', cif_code: 'CIF-001' }])
      .mockResolvedValueOnce([
        {
          id: '100',
          input_snapshot: {
            features: { casa_avg: 100_000_000, total_debt: 20_000_000, product_flags: ['the'] },
          },
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { casa_avg: 100_000_000, total_debt: 20_000_000, product_flags: '["the"]' },
      ])
      .mockResolvedValueOnce([]);

    await service.getCustomer(99, analyst);

    const stalenessSql = String(query.mock.calls[4]?.[0]);
    expect(stalenessSql).toContain('SELECT AVG(a.balance)');
    expect(stalenessSql).toContain('SELECT SUM(l.outstanding)');
    expect(stalenessSql).not.toContain('LEFT JOIN accounts');
    expect(stalenessSql).not.toContain('LEFT JOIN loans');
  });
});
