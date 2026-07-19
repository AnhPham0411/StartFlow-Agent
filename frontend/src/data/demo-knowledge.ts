import type { KnowledgeDocument } from '@/src/lib/models';

export interface DemoKnowledgeDocument extends KnowledgeDocument {
  summary: string;
  keyPoints: string[];
  exampleCase: string;
}

export const demoKnowledgeDocuments: DemoKnowledgeDocument[] = [
  {
    id: 'demo-knowledge-sme-credit',
    title: 'Hướng dẫn thẩm định tín dụng doanh nghiệp SME',
    domain: 'credit',
    sectionCount: 8,
    chunkCount: 24,
    status: 'READY',
    createdAt: '2026-07-17T09:15:00.000Z',
    demoData: true,
    summary:
      'Quy trình mô phỏng từ tiếp nhận hồ sơ, phân tích dòng tiền, kiểm tra đòn bẩy đến đề xuất hạn mức và điều kiện giải ngân.',
    keyPoints: [
      'Đối chiếu doanh thu với sao kê và nghĩa vụ thuế.',
      'Đánh giá DSCR, hệ số nợ và nguồn trả nợ chính.',
      'Mọi ngoại lệ chính sách cần nêu rõ lý do và cấp phê duyệt.',
    ],
    exampleCase:
      'Công ty phân phối đề nghị hạn mức 12 tỷ đồng; doanh thu tăng nhưng dòng tiền theo mùa. Hồ sơ được đề xuất hạn mức quay vòng kèm điều kiện kiểm soát công nợ.',
  },
  {
    id: 'demo-knowledge-credit-file',
    title: 'Checklist hồ sơ vay vốn doanh nghiệp',
    domain: 'credit',
    sectionCount: 6,
    chunkCount: 18,
    status: 'READY',
    createdAt: '2026-07-16T14:30:00.000Z',
    demoData: true,
    summary:
      'Danh mục chứng từ pháp lý, tài chính, phương án kinh doanh và tài sản bảo đảm dùng để kiểm tra tính đầy đủ của hồ sơ.',
    keyPoints: [
      'Giấy đăng ký doanh nghiệp và thông tin người đại diện còn hiệu lực.',
      'Báo cáo tài chính, tờ khai thuế và sao kê phải cùng kỳ đối chiếu.',
      'Chứng từ mục đích vay phải có thể kiểm tra và truy vết.',
    ],
    exampleCase:
      'Hồ sơ Minh Phát thiếu sao kê quý gần nhất và hợp đồng đầu ra. Trợ lý đánh dấu hai hạng mục cần bổ sung trước khi chuyển sang thẩm định.',
  },
  {
    id: 'demo-knowledge-kyc',
    title: 'Quy trình KYC và xác minh chủ sở hữu hưởng lợi',
    domain: 'compliance',
    sectionCount: 7,
    chunkCount: 21,
    status: 'READY',
    createdAt: '2026-07-15T08:45:00.000Z',
    demoData: true,
    summary:
      'Hướng dẫn mô phỏng nhận diện khách hàng tổ chức, xác minh người đại diện và chuỗi sở hữu hưởng lợi trước khi mở quan hệ.',
    keyPoints: [
      'Xác minh danh tính bằng nguồn tài liệu độc lập, còn hiệu lực.',
      'Làm rõ cá nhân kiểm soát trực tiếp hoặc gián tiếp doanh nghiệp.',
      'Tăng cường thẩm tra khi cấu trúc sở hữu phức tạp hoặc có yếu tố rủi ro cao.',
    ],
    exampleCase:
      'Doanh nghiệp có hai lớp công ty mẹ. Nhân viên cần thu thập sơ đồ sở hữu và xác minh cá nhân nắm quyền kiểm soát cuối cùng.',
  },
  {
    id: 'demo-knowledge-aml',
    title: 'Hướng dẫn xử lý cảnh báo giao dịch bất thường',
    domain: 'compliance',
    sectionCount: 9,
    chunkCount: 27,
    status: 'READY',
    createdAt: '2026-07-14T11:20:00.000Z',
    demoData: true,
    summary:
      'Các bước rà soát cảnh báo AML mô phỏng, thu thập bối cảnh giao dịch, ghi nhận bằng chứng và chuyển cấp khi cần.',
    keyPoints: [
      'Không kết luận chỉ dựa trên một dấu hiệu đơn lẻ.',
      'So sánh giao dịch với hồ sơ khách hàng và hành vi lịch sử.',
      'Không tự động thực hiện hành động hạn chế tài khoản khi chưa được phê duyệt.',
    ],
    exampleCase:
      'Tài khoản doanh nghiệp phát sinh chuỗi chuyển tiền quốc tế khác với hồ sơ hoạt động. Cảnh báo được giữ để chuyên viên tuân thủ rà soát và phê duyệt bước tiếp theo.',
  },
  {
    id: 'demo-knowledge-lead',
    title: 'Khung sàng lọc khách hàng doanh nghiệp tiềm năng',
    domain: 'operations',
    sectionCount: 5,
    chunkCount: 15,
    status: 'READY',
    createdAt: '2026-07-13T10:05:00.000Z',
    demoData: true,
    summary:
      'Bộ tiêu chí hỗ trợ nhân viên kinh doanh ưu tiên khách hàng theo nhu cầu, quy mô, khả năng tiếp cận và mức độ phù hợp sản phẩm.',
    keyPoints: [
      'Ưu tiên nhu cầu có căn cứ thay vì chỉ dựa trên quy mô doanh thu.',
      'Không dùng thuộc tính nhạy cảm để chấm điểm khách hàng.',
      'Kết quả là gợi ý tiếp cận và luôn cần nhân viên duyệt.',
    ],
    exampleCase:
      'Khách hàng xuất nhập khẩu có dòng tiền ngoại tệ đều và nhu cầu vốn lưu động được gợi ý ưu tiên tư vấn gói thanh toán quốc tế.',
  },
  {
    id: 'demo-knowledge-complaint',
    title: 'Sổ tay tiếp nhận và xử lý khiếu nại khách hàng',
    domain: 'operations',
    sectionCount: 6,
    chunkCount: 16,
    status: 'READY',
    createdAt: '2026-07-12T15:40:00.000Z',
    demoData: true,
    summary:
      'Quy trình mô phỏng phân loại, chuyển đơn vị phụ trách, theo dõi thời hạn và phản hồi khiếu nại có thể kiểm chứng.',
    keyPoints: [
      'Xác nhận đã tiếp nhận và cung cấp mã theo dõi cho khách hàng.',
      'Phân loại mức độ ảnh hưởng để chọn thời hạn xử lý phù hợp.',
      'Nội dung phản hồi phải dựa trên kết quả xác minh và lưu vết.',
    ],
    exampleCase:
      'Khách hàng phản ánh giao dịch bị ghi nợ hai lần. Yêu cầu được ưu tiên, đối soát với nhật ký giao dịch và chuyển bộ phận vận hành xử lý.',
  },
];

export function isDemoKnowledgeDocument(
  item: KnowledgeDocument,
): item is DemoKnowledgeDocument {
  return (
    typeof (item as Partial<DemoKnowledgeDocument>).summary === 'string' &&
    Array.isArray((item as Partial<DemoKnowledgeDocument>).keyPoints)
  );
}
