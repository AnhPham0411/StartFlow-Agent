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
  {
    companyName: 'Công ty Cổ phần Logistics Mekong Demo',
    registrationNumber: 'DEMO-03030303',
    requestedAmount: new Prisma.Decimal('4800000000'),
    purpose: 'Bổ sung đội xe lạnh phục vụ chuỗi phân phối thực phẩm tại khu vực phía Nam.',
    financials: {
      revenue: 32_000_000_000,
      ebitda: 5_800_000_000,
      totalDebt: 9_000_000_000,
      equity: 14_000_000_000,
      currentAssets: 12_500_000_000,
      currentLiabilities: 6_000_000_000,
    },
    submittedDocuments: [
      'Giấy đăng ký kinh doanh',
      'Báo cáo tài chính kiểm toán',
      'Hợp đồng đầu ra',
    ],
  },
  {
    companyName: 'Công ty TNHH Nông nghiệp Xanh Demo',
    registrationNumber: 'DEMO-04040404',
    requestedAmount: new Prisma.Decimal('3200000000'),
    purpose: 'Tài trợ vốn mùa vụ và hệ thống tưới tiết kiệm cho vùng nguyên liệu nông nghiệp demo.',
    financials: {
      revenue: 15_500_000_000,
      ebitda: 2_200_000_000,
      totalDebt: 3_800_000_000,
      equity: 7_500_000_000,
      currentAssets: 6_200_000_000,
      currentLiabilities: 2_900_000_000,
    },
    submittedDocuments: ['Giấy đăng ký kinh doanh', 'Phương án mùa vụ', 'Hợp đồng bao tiêu'],
  },
  {
    companyName: 'Công ty Cổ phần Xây dựng Atlas Demo',
    registrationNumber: 'DEMO-05050505',
    requestedAmount: new Prisma.Decimal('12000000000'),
    purpose: 'Bổ sung vốn thi công dự án hạ tầng với nhu cầu rà soát kỹ đòn bẩy và dòng tiền.',
    financials: {
      revenue: 58_000_000_000,
      ebitda: 4_100_000_000,
      totalDebt: 31_000_000_000,
      equity: 12_000_000_000,
      currentAssets: 21_000_000_000,
      currentLiabilities: 18_500_000_000,
    },
    submittedDocuments: ['Giấy đăng ký kinh doanh', 'Báo cáo tài chính', 'Hợp đồng thi công'],
  },
  {
    companyName: 'Công ty TNHH Bán lẻ An Phú Demo',
    registrationNumber: 'DEMO-06060606',
    requestedAmount: new Prisma.Decimal('2800000000'),
    purpose: 'Mở rộng chuỗi cửa hàng tiện lợi và bổ sung hàng hóa cho mùa mua sắm cuối năm.',
    financials: {
      revenue: 41_000_000_000,
      ebitda: 7_600_000_000,
      totalDebt: 6_500_000_000,
      equity: 18_000_000_000,
      currentAssets: 15_000_000_000,
      currentLiabilities: 5_200_000_000,
    },
    submittedDocuments: [
      'Giấy đăng ký kinh doanh',
      'Báo cáo tài chính kiểm toán',
      'Kế hoạch mở rộng',
    ],
  },
  {
    companyName: 'Công ty Cổ phần Y tế Bình Minh Demo',
    registrationNumber: 'DEMO-07070707',
    requestedAmount: new Prisma.Decimal('6500000000'),
    purpose: 'Đầu tư thiết bị xét nghiệm mới với yêu cầu kiểm tra giấy phép và hồ sơ nhà cung cấp.',
    financials: {
      revenue: 26_000_000_000,
      ebitda: 4_300_000_000,
      totalDebt: 8_200_000_000,
      equity: 13_500_000_000,
      currentAssets: 9_500_000_000,
      currentLiabilities: 4_100_000_000,
    },
    submittedDocuments: ['Giấy đăng ký kinh doanh', 'Báo cáo tài chính', 'Hồ sơ thiết bị y tế'],
  },
  {
    companyName: 'Công ty TNHH Sản xuất Đông Á Demo',
    registrationNumber: 'DEMO-08080808',
    requestedAmount: new Prisma.Decimal('8900000000'),
    purpose: 'Mua dây chuyền đóng gói tự động để thực hiện đơn hàng xuất khẩu đã ký trong năm.',
    financials: {
      revenue: 64_000_000_000,
      ebitda: 11_500_000_000,
      totalDebt: 14_000_000_000,
      equity: 29_000_000_000,
      currentAssets: 25_000_000_000,
      currentLiabilities: 10_500_000_000,
    },
    submittedDocuments: [
      'Giấy đăng ký kinh doanh',
      'Báo cáo tài chính kiểm toán',
      'Đơn hàng xuất khẩu',
    ],
  },
  {
    companyName: 'Công ty Cổ phần Công nghệ Horizon Demo',
    registrationNumber: 'DEMO-09090909',
    requestedAmount: new Prisma.Decimal('4000000000'),
    purpose: 'Đầu tư hạ tầng điện toán phục vụ nền tảng SaaS đang tăng trưởng nhanh trong khu vực.',
    financials: {
      revenue: 22_000_000_000,
      ebitda: 6_200_000_000,
      totalDebt: 2_500_000_000,
      equity: 16_000_000_000,
      currentAssets: 11_000_000_000,
      currentLiabilities: 3_200_000_000,
    },
    submittedDocuments: ['Giấy đăng ký kinh doanh', 'Báo cáo tài chính', 'Kế hoạch tăng trưởng'],
  },
  {
    companyName: 'Công ty TNHH Thực phẩm Đại Dương Demo',
    registrationNumber: 'DEMO-10101010',
    requestedAmount: new Prisma.Decimal('5500000000'),
    purpose: 'Bổ sung vốn nhập nguyên liệu và nâng cấp kho lạnh cho chuỗi đơn hàng bán lẻ demo.',
    financials: {
      revenue: 37_000_000_000,
      ebitda: 5_100_000_000,
      totalDebt: 10_500_000_000,
      equity: 15_000_000_000,
      currentAssets: 13_500_000_000,
      currentLiabilities: 7_200_000_000,
    },
    submittedDocuments: ['Giấy đăng ký kinh doanh', 'Báo cáo tài chính', 'Hợp đồng nguyên liệu'],
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
      update: { ...demoCase, demoData: true },
    });
  }
}

main()
  .catch((error: unknown) => {
    console.error('Demo seed failed', error instanceof Error ? error.message : 'unknown error');
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
