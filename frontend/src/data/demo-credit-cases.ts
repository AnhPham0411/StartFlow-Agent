import type { CaseDetail, RunSummary } from '@/src/lib/models';

function demoRun(
  id: string,
  caseId: string,
  status: RunSummary['status'],
  createdAt: string,
  finalDecisionStatus?: NonNullable<RunSummary['finalDecisionStatus']>,
): RunSummary {
  return {
    id,
    caseId,
    status,
    createdAt,
    completedAt: ['COMPLETED', 'PARTIAL', 'FAILED'].includes(status) ? createdAt : null,
    finalDecisionStatus: finalDecisionStatus ?? null,
  };
}

const records: Array<Omit<CaseDetail, 'latestRun' | 'runCount'>> = [
  {
    id: 'demo-case-sao-mai',
    companyName: 'Công ty Cổ phần Sao Mai Demo',
    registrationNumber: 'DEMO-01010101',
    requestedAmount: 2_500_000_000,
    purpose: 'Bổ sung vốn lưu động cho chu kỳ sản xuất hàng hóa tổng hợp.',
    createdAt: '2026-07-18T08:15:00.000Z',
    createdBy: 'seed:demo',
    demoData: true,
    financials: { revenue: 18_000_000_000, ebitda: 3_600_000_000, totalDebt: 4_000_000_000, equity: 8_000_000_000, currentAssets: 7_500_000_000, currentLiabilities: 3_000_000_000 },
    submittedDocuments: ['Giấy đăng ký kinh doanh', 'Báo cáo tài chính 2025', 'Phương án sử dụng vốn'],
    runs: [demoRun('demo-run-sao-mai', 'demo-case-sao-mai', 'COMPLETED', '2026-07-18T09:05:00.000Z', 'RECOMMEND')],
  },
  {
    id: 'demo-case-may-do',
    companyName: 'Công ty TNHH Mây Đỏ Demo',
    registrationNumber: 'DEMO-02020202',
    requestedAmount: 7_200_000_000,
    purpose: 'Tài trợ mở rộng kho vận; cần kiểm tra tuân thủ và khả năng trả nợ.',
    createdAt: '2026-07-18T07:30:00.000Z',
    createdBy: 'seed:demo',
    demoData: true,
    financials: { revenue: 9_000_000_000, ebitda: 450_000_000, totalDebt: 8_500_000_000, equity: 2_100_000_000, currentAssets: 2_400_000_000, currentLiabilities: 4_600_000_000 },
    submittedDocuments: ['Giấy đăng ký kinh doanh', 'Báo cáo tài chính 2025'],
    runs: [demoRun('demo-run-may-do', 'demo-case-may-do', 'AWAITING_APPROVAL', '2026-07-18T10:40:00.000Z', 'NEEDS_REVIEW')],
  },
  {
    id: 'demo-case-minh-phat',
    companyName: 'Công ty Minh Phát Demo',
    registrationNumber: 'DEMO-03030303',
    requestedAmount: 5_000_000_000,
    purpose: 'Hạn mức vốn lưu động phục vụ đơn hàng mới.',
    createdAt: '2026-07-18T09:45:00.000Z',
    createdBy: 'seed:demo',
    demoData: true,
    financials: { revenue: 32_000_000_000, ebitda: 5_100_000_000, totalDebt: 6_200_000_000, equity: 12_500_000_000, currentAssets: 15_800_000_000, currentLiabilities: 7_100_000_000 },
    submittedDocuments: ['Giấy đăng ký kinh doanh', 'Báo cáo tài chính', 'Sao kê tài khoản', 'Hợp đồng đầu ra'],
    runs: [demoRun('demo-run-minh-phat', 'demo-case-minh-phat', 'RUNNING', '2026-07-18T11:20:00.000Z')],
  },
  {
    id: 'demo-case-an-binh',
    companyName: 'Công ty An Bình Demo',
    registrationNumber: 'DEMO-04040404',
    requestedAmount: 3_000_000_000,
    purpose: 'Đầu tư thiết bị sản xuất và cải thiện năng suất.',
    createdAt: '2026-07-17T14:10:00.000Z',
    createdBy: 'seed:demo',
    demoData: true,
    financials: { revenue: 21_000_000_000, ebitda: 3_200_000_000, totalDebt: 3_800_000_000, equity: 9_400_000_000, currentAssets: 10_200_000_000, currentLiabilities: 4_300_000_000 },
    submittedDocuments: ['Giấy đăng ký kinh doanh', 'Báo cáo tài chính', 'Báo giá thiết bị'],
    runs: [demoRun('demo-run-an-binh', 'demo-case-an-binh', 'COMPLETED', '2026-07-17T15:25:00.000Z', 'RECOMMEND')],
  },
  {
    id: 'demo-case-dong-hai',
    companyName: 'Công ty Đông Hải Demo',
    registrationNumber: 'DEMO-05050505',
    requestedAmount: 9_500_000_000,
    purpose: 'Tài trợ thương mại cho lô hàng xuất nhập khẩu tổng hợp.',
    createdAt: '2026-07-17T08:20:00.000Z',
    createdBy: 'seed:demo',
    demoData: true,
    financials: { revenue: 45_000_000_000, ebitda: 2_900_000_000, totalDebt: 17_000_000_000, equity: 10_500_000_000, currentAssets: 19_000_000_000, currentLiabilities: 15_500_000_000 },
    submittedDocuments: ['Giấy đăng ký kinh doanh', 'Báo cáo tài chính', 'Hợp đồng ngoại thương'],
    runs: [demoRun('demo-run-dong-hai', 'demo-case-dong-hai', 'PARTIAL', '2026-07-17T10:05:00.000Z', 'NEEDS_REVIEW')],
  },
  {
    id: 'demo-case-sao-viet',
    companyName: 'Hộ kinh doanh Sao Việt Demo',
    registrationNumber: 'DEMO-06060606',
    requestedAmount: 800_000_000,
    purpose: 'Trang bị POS và bổ sung vốn cho điểm bán mới.',
    createdAt: '2026-07-18T12:00:00.000Z',
    createdBy: 'seed:demo',
    demoData: true,
    financials: { revenue: 8_000_000_000, ebitda: 1_100_000_000, totalDebt: 900_000_000, equity: 3_600_000_000, currentAssets: 4_200_000_000, currentLiabilities: 1_500_000_000 },
    submittedDocuments: ['Giấy đăng ký hộ kinh doanh', 'Sao kê tài khoản'],
    runs: [],
  },
];

export const demoCreditCases: CaseDetail[] = records.map((record) => ({
  ...record,
  runCount: record.runs.length,
  latestRun: record.runs[0] ?? null,
}));

export function findDemoCreditCase(caseId: string) {
  return demoCreditCases.find((item) => item.id === caseId) ?? null;
}
