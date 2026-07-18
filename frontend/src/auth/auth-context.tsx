'use client';

import type Keycloak from 'keycloak-js';
import type { UserRole } from '@startflow/contracts';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { resolveRoles } from './roles';

export type AuthStatus = 'initializing' | 'authenticated' | 'unauthenticated' | 'error';

export interface AuthUser {
  subject: string;
  name: string;
  email?: string;
}

export interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  roles: UserRole[];
  error: string | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  getAccessToken: () => Promise<string>;
  hasRole: (...roles: UserRole[]) => boolean;
  setMockUser?: (role: UserRole, branch: string, userId: number) => void;
  mockBranch?: string;
  mockUserId?: number;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

const keycloakConfig = {
  url: process.env.NEXT_PUBLIC_KEYCLOAK_URL ?? '',
  realm: process.env.NEXT_PUBLIC_KEYCLOAK_REALM ?? '',
  clientId: process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID ?? '',
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const keycloakRef = useRef<Keycloak | null>(null);
  const [status, setStatus] = useState<AuthStatus>('initializing');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [mockBranch, setMockBranch] = useState<string>('Hà Nội - Đống Đa');
  const [mockUserId, setMockUserId] = useState<number>(10);

  useEffect(() => {
    let active = true;
    const initialize = async () => {
      await Promise.resolve();
      if (!active) return;
      const authMode = process.env.NEXT_PUBLIC_AUTH_MODE ?? 'keycloak';

      if (authMode === 'mock') {
        if (process.env.NODE_ENV === 'production') {
          setError(
            'NEXT_PUBLIC_AUTH_MODE=mock bị từ chối trong production. Hãy cấu hình Keycloak.',
          );
          setStatus('error');
          return;
        }

        // Mặc định là user CÓ THẬT và CÓ KHÁCH trong call list (users.id=10, xem DEV_USERS
        // ở app-shell.tsx). Trước đây mặc định id=1 / "Chi nhánh A" — user 1 không được giao
        // khách nào nên mọi trang đều trống hoặc 403.
        const cachedRole = (window.localStorage.getItem('mock_role') || 'sale') as UserRole;
        const cachedBranch = window.localStorage.getItem('mock_branch') || 'Hà Nội - Đống Đa';
        const cachedUserId = Number(window.localStorage.getItem('mock_user_id') || '10');

        if (!window.localStorage.getItem('mock_role')) {
          window.localStorage.setItem('mock_role', cachedRole);
          window.localStorage.setItem('mock_branch', cachedBranch);
          window.localStorage.setItem('mock_user_id', String(cachedUserId));
        }

        setMockBranch(cachedBranch);
        setMockUserId(cachedUserId);

        setUser({ subject: 'demo-reviewer', name: 'Demo Reviewer', email: 'demo@startflow.local' });
        setRoles([cachedRole]);
        setStatus('authenticated');
        return;
      }

      if (authMode !== 'keycloak') {
        setError(`Chế độ xác thực “${authMode}” không được hỗ trợ.`);
        setStatus('error');
        return;
      }

      if (!keycloakConfig.url || !keycloakConfig.realm || !keycloakConfig.clientId) {
        setError(
          'Thiếu cấu hình Keycloak public. Kiểm tra các biến NEXT_PUBLIC_KEYCLOAK_* trong môi trường.',
        );
        setStatus('error');
        return;
      }

      try {
        const { default: KeycloakClient } = await import('keycloak-js');
        const client = new KeycloakClient(keycloakConfig);
        keycloakRef.current = client;
        const authenticated = await client.init({
          onLoad: 'check-sso',
          pkceMethod: 'S256',
          checkLoginIframe: false,
          silentCheckSsoRedirectUri: `${window.location.origin}/silent-check-sso.html`,
        });
        if (!active) return;
        if (!authenticated || !client.tokenParsed) {
          setStatus('unauthenticated');
          return;
        }
        const parsed = client.tokenParsed;
        const displayName =
          typeof parsed.name === 'string'
            ? parsed.name
            : typeof parsed.preferred_username === 'string'
              ? parsed.preferred_username
              : 'Người dùng StartFlow';
        setUser({
          subject: parsed.sub ?? 'unknown',
          name: displayName,
          email: typeof parsed.email === 'string' ? parsed.email : undefined,
        });
        setRoles(resolveRoles(parsed, keycloakConfig.clientId));
        setStatus('authenticated');
        client.onTokenExpired = () => {
          void client.updateToken(30);
        };
        client.onAuthLogout = () => {
          setUser(null);
          setRoles([]);
          setStatus('unauthenticated');
        };
      } catch {
        if (!active) return;
        setError('Không thể khởi tạo đăng nhập Keycloak. Kiểm tra URL, realm và web origin.');
        setStatus('error');
      }
    };

    void initialize();

    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async () => {
    if (process.env.NEXT_PUBLIC_AUTH_MODE === 'mock' && process.env.NODE_ENV !== 'production') {
      const cachedRole = (window.localStorage.getItem('mock_role') || 'sale') as UserRole;
      setUser({ subject: 'demo-reviewer', name: 'Demo Reviewer', email: 'demo@startflow.local' });
      setRoles([cachedRole]);
      setStatus('authenticated');
      return;
    }
    if (!keycloakRef.current) return;
    await keycloakRef.current.login({ redirectUri: window.location.href });
  }, []);

  const logout = useCallback(async () => {
    if (!keycloakRef.current) {
      setStatus('unauthenticated');
      return;
    }
    await keycloakRef.current.logout({ redirectUri: window.location.origin });
  }, []);

  const getAccessToken = useCallback(async () => {
    if (process.env.NEXT_PUBLIC_AUTH_MODE === 'mock' && process.env.NODE_ENV !== 'production')
      return 'mock-access-token';
    const client = keycloakRef.current;
    if (!client?.authenticated) throw new Error('AUTH_REQUIRED');
    await client.updateToken(30);
    if (!client.token) throw new Error('AUTH_REQUIRED');
    return client.token;
  }, []);

  const hasRole = useCallback(
    (...required: UserRole[]) => required.some((role) => roles.includes(role)),
    [roles],
  );

  const setMockUser = useCallback((role: UserRole, branch: string, userId: number) => {
    if (process.env.NEXT_PUBLIC_AUTH_MODE === 'mock') {
      window.localStorage.setItem('mock_role', role);
      window.localStorage.setItem('mock_branch', branch);
      window.localStorage.setItem('mock_user_id', String(userId));
      setMockBranch(branch);
      setMockUserId(userId);
      setRoles([role]);
      window.location.reload();
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      roles,
      error,
      login,
      logout,
      getAccessToken,
      hasRole,
      setMockUser,
      mockBranch,
      mockUserId,
    }),
    [status, user, roles, error, login, logout, getAccessToken, hasRole, setMockUser, mockBranch, mockUserId],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth phải được dùng bên trong AuthProvider');
  return value;
}
