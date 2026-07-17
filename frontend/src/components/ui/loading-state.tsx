export function LoadingState({ label = 'Đang tải dữ liệu…' }: { label?: string }) {
  return (
    <div className="loading-state" role="status">
      <div>
        <div className="spinner" aria-hidden="true" />
        <p className="muted">{label}</p>
      </div>
    </div>
  );
}
