import type { CaseInput } from '@startflow/contracts';

export interface CaseDemoFixture {
  id: string;
  label: string;
  description: string;
  input: CaseInput;
}

export const caseDemoFixtures: readonly CaseDemoFixture[] = [
  {
    id: 'conditional-approval',
    label: 'Sao Việt · Có điều kiện',
    description: 'Tài chính ổn định, cần bổ sung xác minh UBO và biên bản HĐQT.',
    input: {
      companyName: 'Công ty Cổ phần Sao Việt Demo',
      registrationNumber: 'DEMO-01042',
      requestedAmount: 5_000_000_000,
      purpose: 'Bổ sung vốn lưu động phục vụ đơn hàng xuất khẩu trong quý tới.',
      financials: {
        revenue: 45_000_000_000,
        ebitda: 9_000_000_000,
        totalDebt: 16_000_000_000,
        equity: 25_000_000_000,
        currentAssets: 20_000_000_000,
        currentLiabilities: 12_000_000_000,
      },
      submittedDocuments: [
        'Giấy đăng ký doanh nghiệp',
        'Báo cáo tài chính kiểm toán',
        'Hồ sơ người đại diện',
      ],
      demoData: true,
    },
  },
  {
    id: 'compliance-blocked',
    label: 'Mộc An · Compliance chặn',
    description: 'Fixture minh họa hard-stop AML và thiếu tài liệu vận hành.',
    input: {
      companyName: 'Công ty TNHH Mộc An Demo',
      registrationNumber: 'DEMO-AML-88',
      requestedAmount: 8_500_000_000,
      purpose: 'Mở rộng nhà xưởng và mua bổ sung thiết bị chế biến mô phỏng.',
      financials: {
        revenue: 31_000_000_000,
        ebitda: 4_200_000_000,
        totalDebt: 19_500_000_000,
        equity: 11_000_000_000,
        currentAssets: 8_000_000_000,
        currentLiabilities: 9_500_000_000,
      },
      submittedDocuments: ['Giấy đăng ký doanh nghiệp'],
      demoData: true,
    },
  },
] as const;

export const caseDocumentOptions = [
  'Giấy đăng ký doanh nghiệp',
  'Báo cáo tài chính kiểm toán',
  'Hồ sơ người đại diện',
  'Biên bản HĐQT/HĐTV',
  'Sao kê thuế quý gần nhất',
  'Hợp đồng đầu ra chính',
] as const;
