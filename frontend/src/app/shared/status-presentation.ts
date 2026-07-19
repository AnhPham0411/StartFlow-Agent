import type { Color } from '@sdcorejs/utils/models';

export interface StatusPresentation {
  label: string;
  color: Color;
}

const STATUS_PRESENTATIONS: Readonly<Record<string, StatusPresentation>> = {
  PENDING: { label: 'Đang chờ', color: 'secondary' },
  PLANNING: { label: 'Đang lập kế hoạch', color: 'info' },
  RUNNING: { label: 'Đang xử lý', color: 'info' },
  AWAITING_APPROVAL: { label: 'Chờ phê duyệt', color: 'warning' },
  COMPLETED: { label: 'Hoàn tất', color: 'success' },
  PARTIAL: { label: 'Chưa đầy đủ', color: 'warning' },
  FAILED: { label: 'Gặp lỗi', color: 'error' },
  SKIPPED: { label: 'Đã bỏ qua', color: 'secondary' },
  RECOMMEND: { label: 'Đề xuất có điều kiện', color: 'success' },
  NEEDS_REVIEW: { label: 'Cần xem xét', color: 'warning' },
  BLOCKED: { label: 'Đã chặn', color: 'error' },
  READY: { label: 'Sẵn sàng', color: 'success' },
  PROCESSING: { label: 'Đang xử lý', color: 'info' },
};

export function statusPresentation(status: string): StatusPresentation {
  return (
    STATUS_PRESENTATIONS[status] ?? {
      label: status || 'Không xác định',
      color: 'secondary',
    }
  );
}
