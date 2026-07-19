import { statusPresentation } from './status-presentation';

describe('statusPresentation', () => {
  it('maps run and approval states to Vietnamese Core badge presentation', () => {
    expect(statusPresentation('AWAITING_APPROVAL')).toEqual({
      label: 'Chờ phê duyệt',
      color: 'warning',
    });
    expect(statusPresentation('COMPLETED')).toEqual({ label: 'Hoàn tất', color: 'success' });
    expect(statusPresentation('FAILED')).toEqual({ label: 'Gặp lỗi', color: 'error' });
  });

  it('maps knowledge and decision states without relying on color-only meaning', () => {
    expect(statusPresentation('READY')).toEqual({ label: 'Sẵn sàng', color: 'success' });
    expect(statusPresentation('NEEDS_REVIEW')).toEqual({
      label: 'Cần xem xét',
      color: 'warning',
    });
  });

  it('keeps an unknown status readable with a neutral color', () => {
    expect(statusPresentation('CUSTOM_STATE')).toEqual({
      label: 'CUSTOM_STATE',
      color: 'secondary',
    });
    expect(statusPresentation('')).toEqual({ label: 'Không xác định', color: 'secondary' });
  });
});
