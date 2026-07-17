import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AuthProvider } from '@/src/auth/auth-context';
import { ProtectedApp } from '@/src/auth/protected-app';
import './globals.css';

export const metadata: Metadata = {
  title: 'StartFlow · AI Credit Workspace',
  description: 'Không gian điều phối đánh giá hồ sơ vay doanh nghiệp đa tác nhân.',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="vi">
      <body>
        <AuthProvider>
          <ProtectedApp>{children}</ProtectedApp>
        </AuthProvider>
      </body>
    </html>
  );
}
