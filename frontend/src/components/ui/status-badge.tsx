import { Badge, type BadgeTone } from './badge';

const statusMap: Record<string, { label: string; tone: BadgeTone }> = {
  PENDING: { label: 'Đang chờ', tone: 'neutral' },
  PLANNING: { label: 'Đang lập kế hoạch', tone: 'info' },
  RUNNING: { label: 'Đang xử lý', tone: 'info' },
  AWAITING_APPROVAL: { label: 'Chờ phê duyệt', tone: 'warning' },
  COMPLETED: { label: 'Hoàn tất', tone: 'success' },
  PARTIAL: { label: 'Chưa đầy đủ', tone: 'warning' },
  FAILED: { label: 'Gặp lỗi', tone: 'danger' },
  SKIPPED: { label: 'Đã bỏ qua', tone: 'neutral' },
  RECOMMEND: { label: 'Đề xuất có điều kiện', tone: 'success' },
  NEEDS_REVIEW: { label: 'Cần xem xét', tone: 'warning' },
  BLOCKED: { label: 'Đã chặn', tone: 'danger' },
  READY: { label: 'Sẵn sàng', tone: 'success' },
  PROCESSING: { label: 'Đang xử lý', tone: 'info' },
};

export function StatusBadge({ status }: { status: string }) {
  const mapped = statusMap[status] ?? { label: status, tone: 'neutral' as const };
  return <Badge tone={mapped.tone}>{mapped.label}</Badge>;
}
