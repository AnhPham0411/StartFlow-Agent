import { Prisma } from '@prisma/client';

import { CasesService } from '../src/modules/cases/cases.service';

describe('case queue summaries', () => {
  it('returns latest run and total run count for the dashboard queue', async () => {
    const createdAt = new Date('2026-07-17T10:00:00.000Z');
    const latestRun = {
      completedAt: null,
      createdAt,
      id: '31d6890d-af35-438f-9463-8175a1e001b1',
      status: 'AWAITING_APPROVAL',
    };
    const prisma = {
      loanCase: {
        findMany: jest.fn().mockResolvedValue([
          {
            _count: { runs: 3 },
            companyName: 'Minh An Demo',
            createdAt,
            createdBy: 'analyst-1',
            demoData: true,
            financials: {},
            id: '7698b6b6-3c0a-423e-b217-65ff781e3f7f',
            purpose: 'Bổ sung vốn lưu động demo',
            registrationNumber: 'DEMO-001',
            requestedAmount: new Prisma.Decimal(2_500_000_000),
            runs: [latestRun],
            submittedDocuments: [],
            updatedAt: createdAt,
          },
        ]),
      },
    };
    const service = new CasesService({} as never, prisma as never);

    await expect(service.list()).resolves.toEqual([
      expect.objectContaining({ latestRun, runCount: 3 }),
    ]);
  });

  it('dispatches only the frozen AI CaseInput fields in a run snapshot', () => {
    const createdAt = new Date('2026-07-19T03:00:00.000Z');
    const service = new CasesService({} as never, {} as never);

    const snapshot = service.snapshotData({
      companyName: 'Công ty Cổ phần Sao Việt Demo',
      createdAt,
      createdBy: 'demo-user',
      demoData: true,
      financials: {
        revenue: 45_000_000_000,
        ebitda: 9_000_000_000,
        totalDebt: 16_000_000_000,
        equity: 25_000_000_000,
        currentAssets: 20_000_000_000,
        currentLiabilities: 12_000_000_000,
      },
      id: '7698b6b6-3c0a-423e-b217-65ff781e3f7f',
      purpose: 'Bổ sung vốn lưu động phục vụ đơn hàng xuất khẩu trong quý tới.',
      registrationNumber: 'DEMO-01042',
      requestedAmount: new Prisma.Decimal(5_000_000_000),
      submittedDocuments: ['Giấy đăng ký doanh nghiệp'],
      updatedAt: createdAt,
    });

    expect(snapshot).toEqual({
      companyName: 'Công ty Cổ phần Sao Việt Demo',
      demoData: true,
      financials: expect.any(Object),
      purpose: 'Bổ sung vốn lưu động phục vụ đơn hàng xuất khẩu trong quý tới.',
      registrationNumber: 'DEMO-01042',
      requestedAmount: 5_000_000_000,
      submittedDocuments: ['Giấy đăng ký doanh nghiệp'],
    });
    expect(snapshot).not.toHaveProperty('id');
    expect(snapshot).not.toHaveProperty('createdAt');
    expect(snapshot).not.toHaveProperty('createdBy');
  });
});
