import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <main className="centered-state">
      <p className="eyebrow">404 · Không tìm thấy</p>
      <h1>Màn hình này không tồn tại</h1>
      <p className="muted">Liên kết có thể đã thay đổi hoặc tài nguyên không còn khả dụng.</p>
      <Link className="button button--primary" href="/dashboard">
        <ArrowLeft aria-hidden="true" /> Về tổng quan
      </Link>
    </main>
  );
}
