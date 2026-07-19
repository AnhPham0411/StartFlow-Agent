'use client';

import {
  BookOpenText,
  LayoutDashboard,
  LogOut,
  MessageSquareText,
  ScrollText,
  UsersRound,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useAuth } from '@/src/auth/auth-context';
import { Badge } from '@/src/components/ui/badge';

const navigation = [
  { href: '/assistant', label: 'Trợ lý AI', icon: MessageSquareText },
  { href: '/dashboard', label: 'Tổng quan', icon: LayoutDashboard },
  { href: '/cases', label: 'Hồ sơ', icon: ScrollText },
  { href: '/manager', label: 'Quản lý', icon: UsersRound, adminOnly: true },
  { href: '/knowledge', label: 'Tri thức', icon: BookOpenText, adminOnly: true },
];

function Navigation({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();
  const { hasRole, logout } = useAuth();
  const items = navigation.filter((item) => !item.adminOnly || hasRole('admin'));
  const visible = mobile ? items.slice(0, 3) : items;

  return (
    <nav
      className={mobile ? 'mobile-nav' : 'nav-list'}
      aria-label={mobile ? 'Điều hướng di động' : 'Điều hướng chính'}
    >
      {visible.map((item) => {
        const active =
          pathname === item.href || (item.href === '/cases' && pathname.startsWith('/cases/'));
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            className="nav-link"
            href={item.href}
            aria-current={active ? 'page' : undefined}
          >
            <Icon aria-hidden="true" />
            <span>{item.label}</span>
          </Link>
        );
      })}
      {mobile ? (
        <button
          className="nav-link logout-button"
          type="button"
          title="Đăng xuất khỏi StartFlow"
          onClick={() => void logout()}
        >
          <LogOut aria-hidden="true" />
          <span>Đăng xuất</span>
        </button>
      ) : null}
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user, roles, logout } = useAuth();

  return (
    <>
      <a className="skip-link" href="#main-content">
        Bỏ qua điều hướng
      </a>
      <div className="app-layout">
        <aside className="sidebar">
          <Link className="brand" href="/dashboard" aria-label="StartFlow - Tổng quan">
            <span className="brand-mark" aria-hidden="true">
              <span>SF</span>
            </span>
            <span className="brand-copy">
              <strong>STARTFLOW</strong>
              <small>AI BANKING WORKSPACE</small>
            </span>
          </Link>
          <Navigation />
          <div className="sidebar-footer">
            <p className="user-name">{user?.name}</p>
            <div className="role-row">
              {roles.map((role) => (
                <Badge key={role} tone="dark">
                  {role}
                </Badge>
              ))}
            </div>
            <button
              className="nav-link logout-button"
              type="button"
              title="Đăng xuất khỏi StartFlow"
              onClick={() => void logout()}
            >
              <LogOut aria-hidden="true" />
              <span>Đăng xuất</span>
            </button>
          </div>
        </aside>
        <main className="app-main" id="main-content" tabIndex={-1}>
          <div className="content-shell">{children}</div>
        </main>
      </div>
      <Navigation mobile />
    </>
  );
}
