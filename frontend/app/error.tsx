'use client';

import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/src/components/ui/button';

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="centered-state" role="alert">
      <div className="state-icon state-icon--danger">
        <AlertTriangle aria-hidden="true" />
      </div>
      <p className="eyebrow">Không thể hiển thị màn hình</p>
      <h1>Đã có lỗi ngoài dự kiến</h1>
      <p className="muted">Dữ liệu của bạn chưa bị thay đổi. Hãy thử tải lại màn hình.</p>
      <Button onClick={reset}>
        <RotateCcw aria-hidden="true" /> Thử lại
      </Button>
    </main>
  );
}
