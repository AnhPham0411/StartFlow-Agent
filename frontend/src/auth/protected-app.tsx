'use client';

import { KeyRound, ShieldAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { AppShell } from '@/src/components/layout/app-shell';
import { Button } from '@/src/components/ui/button';
import { LoadingState } from '@/src/components/ui/loading-state';
import { useAuth } from './auth-context';

export function ProtectedApp({ children }: { children: ReactNode }) {
  const { status, error, login } = useAuth();
  const pathname = usePathname();
  const isStandalone = pathname?.startsWith('/prototypes');

  if (status === 'initializing') return <LoadingState label="Đang xác minh phiên làm việc…" />;

  if (status === 'error') {
    return (
      <main className="centered-state" role="alert">
        <div className="state-icon state-icon--danger">
          <ShieldAlert aria-hidden="true" />
        </div>
        <p className="eyebrow">Cấu hình xác thực</p>
        <h1>Không thể bảo vệ không gian làm việc</h1>
        <p className="muted">{error}</p>
      </main>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <main className="auth-page">
        <section className="auth-story">
          <div>
            <p className="eyebrow">StartFlow · AI Credit Workspace</p>
            <h1>Một hồ sơ. Ba chuyên gia. Một quyết định có căn cứ.</h1>
            <p>
              Theo dõi Credit, Compliance và Operations cùng phân tích hồ sơ, đối chiếu căn cứ rồi
              hội tụ tại cổng quyết định của con người.
            </p>
            <div className="auth-rail" aria-label="Ba luồng chuyên gia">
              <div className="auth-lane">01 · CREDIT</div>
              <div className="auth-lane">02 · COMPLIANCE</div>
              <div className="auth-lane">03 · OPERATIONS</div>
            </div>
            <div className="auth-gate" aria-hidden="true" />
          </div>
          <small>Dữ liệu mô phỏng cho hackathon · Không sử dụng PII thật</small>
        </section>
        <div className="auth-card-wrap">
          <section className="panel auth-card">
            <div className="state-icon">
              <KeyRound aria-hidden="true" />
            </div>
            <p className="eyebrow">Đăng nhập an toàn</p>
            <h2>Mở không gian đánh giá</h2>
            <p className="muted">
              Bạn sẽ được chuyển tới Keycloak bằng Authorization Code + PKCE. Token chỉ được giữ
              trong bộ nhớ phiên trình duyệt.
            </p>
            <Button fullWidth onClick={() => void login()}>
              Đăng nhập với Keycloak
            </Button>
          </section>
        </div>
      </main>
    );
  }

  if (isStandalone) return <>{children}</>;

  return <AppShell>{children}</AppShell>;
}
