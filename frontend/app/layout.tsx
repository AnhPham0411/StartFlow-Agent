import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AuthProvider } from '@/src/auth/auth-context';
import { ProtectedApp } from '@/src/auth/protected-app';
import './globals.css';

export const metadata: Metadata = {
  title: 'StartFlow · AI Sales Copilot',
  description: 'Hệ thống gợi ý Next Best Action (NBA) hỗ trợ bán chéo kênh quầy.',
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
