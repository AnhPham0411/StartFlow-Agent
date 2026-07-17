import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from './button';

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="empty-state" role="alert">
      <div className="state-icon state-icon--danger">
        <AlertTriangle aria-hidden="true" />
      </div>
      <h2>Không thể tải dữ liệu</h2>
      <p className="muted">{message}</p>
      {onRetry ? (
        <Button onClick={onRetry}>
          <RotateCcw aria-hidden="true" /> Thử lại
        </Button>
      ) : null}
    </div>
  );
}
