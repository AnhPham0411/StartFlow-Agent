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
  accountType?: 'manager' | 'banker';
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  roles: UserRole[];
  error: string | null;
  login: (credentials?: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  getAccessToken: () => Promise<string>;
  hasRole: (...roles: UserRole[]) => boolean;
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

  useEffect(() => {
    let active = true;
    const initialize = async () => {
      await Promise.resolve();
      if (!active) return;
      const authMode = process.env.NEXT_PUBLIC_AUTH_MODE ?? 'keycloak';

      if (authMode === 'demo') {
        if (
          process.env.NODE_ENV === 'production' &&
          process.env.NEXT_PUBLIC_DEMO_PUBLIC_WARNING !== 'true'
        ) {
          setError(
            'AUTH_MODE=demo trong production cần NEXT_PUBLIC_DEMO_PUBLIC_WARNING=true để luôn hiển thị cảnh báo demo.',
          );
          setStatus('error');
          return;
        }
        const account = window.sessionStorage.getItem('startflow-demo-account');
        if (account === 'manager') {
          setUser({ subject: 'demo-manager', name: 'Manager', accountType: 'manager' });
          setRoles(['analyst', 'approver', 'admin']);
          setStatus('authenticated');
        } else if (account === 'banker') {
          setUser({ subject: 'demo-banker', name: 'Banker', accountType: 'banker' });
          setRoles(['analyst']);
          setStatus('authenticated');
        } else {
          setStatus('unauthenticated');
        }
        return;
      }

      if (authMode === 'mock') {
        if (process.env.NODE_ENV === 'production') {
          setError(
            'NEXT_PUBLIC_AUTH_MODE=mock bị từ chối trong production. Hãy cấu hình Keycloak.',
          );
          setStatus('error');
          return;
        }
        setUser({ subject: 'demo-reviewer', name: 'Demo Reviewer', email: 'demo@startflow.local' });
        setRoles(['analyst', 'approver']);
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

  const login = useCallback(async (credentials?: LoginCredentials) => {
    if (process.env.NEXT_PUBLIC_AUTH_MODE === 'demo') {
      const username = credentials?.username.trim().toLowerCase();
      if ((username !== 'manager' && username !== 'banker') || credentials?.password !== '12345678') {
        throw new Error('Tên đăng nhập hoặc mật khẩu demo không đúng.');
      }
      window.sessionStorage.setItem('startflow-demo-account', username);
      if (username === 'manager') {
        setUser({ subject: 'demo-manager', name: 'Manager', accountType: 'manager' });
        setRoles(['analyst', 'approver', 'admin']);
      } else {
        setUser({ subject: 'demo-banker', name: 'Banker', accountType: 'banker' });
        setRoles(['analyst']);
      }
      setStatus('authenticated');
      return;
    }
    if (process.env.NEXT_PUBLIC_AUTH_MODE === 'mock' && process.env.NODE_ENV !== 'production') {
      setUser({ subject: 'demo-reviewer', name: 'Demo Reviewer', email: 'demo@startflow.local' });
      setRoles(['analyst', 'approver']);
      setStatus('authenticated');
      return;
    }
    if (!keycloakRef.current) return;
    await keycloakRef.current.login({ redirectUri: window.location.href });
  }, []);

  const logout = useCallback(async () => {
    if (process.env.NEXT_PUBLIC_AUTH_MODE === 'demo') {
      window.sessionStorage.removeItem('startflow-demo-account');
      setUser(null);
      setRoles([]);
      setStatus('unauthenticated');
      return;
    }
    if (!keycloakRef.current) {
      setStatus('unauthenticated');
      return;
    }
    await keycloakRef.current.logout({ redirectUri: window.location.origin });
  }, []);

  const getAccessToken = useCallback(async () => {
    if (process.env.NEXT_PUBLIC_AUTH_MODE === 'demo') {
      const account = window.sessionStorage.getItem('startflow-demo-account');
      if (account === 'manager') return 'demo-manager-token';
      if (account === 'banker') return 'demo-banker-token';
      throw new Error('AUTH_REQUIRED');
    }
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
  const value = useMemo<AuthContextValue>(
    () => ({ status, user, roles, error, login, logout, getAccessToken, hasRole }),
    [status, user, roles, error, login, logout, getAccessToken, hasRole],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth phải được dùng bên trong AuthProvider');
  return value;
}
