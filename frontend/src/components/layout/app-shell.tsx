'use client';

import {
  BookOpenText,
  LayoutDashboard,
  ListTodo,
  LogOut,
  Settings,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import type { UserRole } from '@startflow/contracts';
import { useAuth } from '@/src/auth/auth-context';
import { Badge } from '@/src/components/ui/badge';

/**
 * Tài khoản demo cho dev-login — phải là user CÓ THẬT trong bảng `users`.
 * Guard đọc role/branch từ DB theo id (jwt-auth.guard.ts → toDevUser), nên nếu ở đây
 * ghi sai role thì nhãn sẽ nói dối: chọn "Admin" mà thực tế vào bằng quyền sale.
 *
 * Chọn user nào có khách trong call list, nếu không mọi trang đều trống hoặc 403.
 * Kiểm tra lại bằng:
 *   SELECT assigned_sale_id, count(*) FROM call_lists WHERE list_date=CURRENT_DATE GROUP BY 1;
 */
const DEV_USERS: Array<{ id: number; role: UserRole; branch: string; label: string }> = [
  { id: 10, role: 'sale', branch: 'Hà Nội - Đống Đa', label: 'Sale · Đặng Hoàng Thu (HN-Đống Đa)' },
  { id: 12, role: 'sale', branch: 'Hà Nội - Đống Đa', label: 'Sale · Trần Hoàng Xuân (HN-Đống Đa)' },
  { id: 8, role: 'sale', branch: 'Huế', label: 'Sale · Dương Thanh Chi (Huế)' },
  { id: 7, role: 'manager', branch: 'Hà Nội - Đống Đa', label: 'Manager · Đỗ Anh Quân (HN-Đống Đa)' },
  { id: 17, role: 'admin', branch: 'Đà Nẵng', label: 'Admin · Lê Anh Nam' },
];

const navigation = [
  { href: '/nba/calllist', label: 'Tổng quan (Call List)', icon: ListTodo },
  { href: '/nba/customers', label: 'Khách hàng', icon: Users },
  { href: '/nba/admin', label: 'Quản lý', icon: Settings, managerOnly: true },
  { href: '/knowledge', label: 'Tri thức', icon: BookOpenText, adminOnly: true },
];

function Navigation({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();
  const { hasRole } = useAuth();
  const items = navigation.filter(
    (item) =>
      (!item.adminOnly || hasRole('admin')) && (!item.managerOnly || hasRole('manager') || hasRole('admin')),
  );
  const visible = mobile ? items.slice(0, 4) : items;

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
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user, roles, logout, setMockUser, mockBranch, mockUserId } = useAuth();

  return (
    <>
      <a className="skip-link" href="#main-content">
        Bỏ qua điều hướng
      </a>
      <div className="app-layout">
        <aside className="sidebar">
          <Link className="brand" href="/nba/calllist" aria-label="StartFlow - Tổng quan">
            <span className="brand-mark" aria-hidden="true">
              <span>SF</span>
            </span>
            <span className="brand-copy">
              <strong>STARTFLOW</strong>
              <small>AI SALES COPILOT</small>
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
            {process.env.NEXT_PUBLIC_AUTH_MODE === 'mock' && setMockUser && (
              <div className="dev-switcher" style={{ margin: '8px 0', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '8px' }}>
                <p style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Dev Role Switcher
                </p>
                <select
                  style={{ width: '100%', fontSize: '12px', background: '#1e293b', color: '#f8fafc', border: '1px solid #475569', borderRadius: '4px', padding: '4px 8px', outline: 'none' }}
                  value={`${roles[0] ?? 'sale'}|${mockBranch ?? ''}|${mockUserId ?? 10}`}
                  onChange={(e) => {
                    const [r, b, u] = e.target.value.split('|');
                    if (setMockUser && r && b && u) {
                      setMockUser(r as UserRole, b, Number(u));
                    }
                  }}
                >
                  {DEV_USERS.map((u) => (
                    <option key={u.id} value={`${u.role}|${u.branch}|${u.id}`}>
                      {u.label}
                    </option>
                  ))}
                </select>
                <p style={{ fontSize: '10px', color: '#64748b', marginTop: '5px', lineHeight: 1.4 }}>
                  Role và chi nhánh lấy từ bảng <code>users</code> theo id — lựa chọn ở đây chỉ
                  quyết định đăng nhập bằng user nào.
                </p>
              </div>
            )}
            <button className="nav-link" type="button" onClick={() => void logout()}>
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
