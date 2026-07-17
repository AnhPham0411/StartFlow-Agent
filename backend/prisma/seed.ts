import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const demoCases = [
  {
    companyName: 'Công ty Cổ phần Sao Mai Demo',
    registrationNumber: 'DEMO-01010101',
    requestedAmount: new Prisma.Decimal('2500000000'),
    purpose: 'Bổ sung vốn lưu động cho chu kỳ sản xuất hàng hóa mô phỏng.',
    financials: {
      revenue: 18_000_000_000,
      ebitda: 3_600_000_000,
      totalDebt: 4_000_000_000,
      equity: 8_000_000_000,
      currentAssets: 7_500_000_000,
      currentLiabilities: 3_000_000_000,
    },
    submittedDocuments: ['Giấy đăng ký kinh doanh', 'Báo cáo tài chính', 'Phương án sử dụng vốn'],
  },
  {
    companyName: 'Công ty TNHH Mây Đỏ Demo',
    registrationNumber: 'DEMO-02020202',
    requestedAmount: new Prisma.Decimal('7200000000'),
    purpose: 'Tài trợ dự án mở rộng kho vận mô phỏng cần kiểm tra tuân thủ bổ sung.',
    financials: {
      revenue: 9_000_000_000,
      ebitda: 450_000_000,
      totalDebt: 8_500_000_000,
      equity: 2_100_000_000,
      currentAssets: 2_400_000_000,
      currentLiabilities: 4_600_000_000,
    },
    submittedDocuments: ['Giấy đăng ký kinh doanh'],
  },
] satisfies Array<{
  companyName: string;
  financials: Prisma.InputJsonValue;
  purpose: string;
  registrationNumber: string;
  requestedAmount: Prisma.Decimal;
  submittedDocuments: Prisma.InputJsonValue;
}>;

async function main(): Promise<void> {
  for (const demoCase of demoCases) {
    await prisma.loanCase.upsert({
      where: { registrationNumber: demoCase.registrationNumber },
      create: { ...demoCase, createdBy: 'seed:demo', demoData: true },
      update: {},
    });
  }
}

main()
  .catch((error: unknown) => {
    console.error('Demo seed failed', error instanceof Error ? error.message : 'unknown error');
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
