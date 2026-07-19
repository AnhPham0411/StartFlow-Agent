'use client';

import { KeyRound, ShieldAlert } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { AppShell } from '@/src/components/layout/app-shell';
import { Button } from '@/src/components/ui/button';
import { LoadingState } from '@/src/components/ui/loading-state';
import { useAuth } from './auth-context';

export function ProtectedApp({ children }: { children: ReactNode }) {
  const { status, error, login } = useAuth();
  const [username, setUsername] = useState('banker');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const demoMode = process.env.NEXT_PUBLIC_AUTH_MODE === 'demo';

  async function submitDemoLogin(event: FormEvent) {
    event.preventDefault();
    setLoginError(null);
    try {
      await login({ username, password });
    } catch (caught) {
      setLoginError(caught instanceof Error ? caught.message : 'Không đăng nhập được.');
    }
  }

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
            <p className="eyebrow">StartFlow · Internal AI Workspace</p>
            <h1>Một câu hỏi. Đúng chuyên gia. Kết quả có căn cứ.</h1>
            <p>
              Tải tài liệu, hỏi trợ lý VLM local và theo dõi Planner phân công các agent nghiệp vụ
              phù hợp trong môi trường ngân hàng được kiểm soát.
            </p>
            <div className="auth-rail" aria-label="Ba lớp xử lý">
              <div className="auth-lane">01 · VLM INTAKE</div>
              <div className="auth-lane">02 · AGENT PLAN</div>
              <div className="auth-lane">03 · HUMAN GATE</div>
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
            <h2>Mở trợ lý nghiệp vụ</h2>
            <p className="muted">
              {demoMode
                ? 'Dùng một trong hai tài khoản demo bên dưới. Phiên chỉ được giữ trong trình duyệt này.'
                : 'Bạn sẽ được chuyển tới Keycloak bằng Authorization Code + PKCE. Token chỉ được giữ trong bộ nhớ phiên trình duyệt.'}
            </p>
            {demoMode ? (
              <form className="demo-login-form" onSubmit={(event) => void submitDemoLogin(event)}>
                <label htmlFor="demo-username">Tài khoản demo</label>
                <input
                  className="input"
                  id="demo-username"
                  autoComplete="username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                />
                <label htmlFor="demo-password">Mật khẩu</label>
                <input
                  className="input"
                  id="demo-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                {loginError ? <p className="field-error" role="alert">{loginError}</p> : null}
                <Button fullWidth type="submit">Đăng nhập</Button>
                <p className="field-help">
                  DEMO ONLY · manager hoặc banker · mật khẩu 12345678. Không dùng thông tin thật.
                </p>
              </form>
            ) : (
              <Button fullWidth onClick={() => void login()}>
                Đăng nhập với Keycloak
              </Button>
            )}
          </section>
        </div>
      </main>
    );
  }

  return <AppShell>{children}</AppShell>;
}
