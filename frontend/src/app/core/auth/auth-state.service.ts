import { inject, Injectable, InjectionToken, computed, signal } from '@angular/core';
import type { SdKeycloakService } from '@sdcorejs/angular/modules/keycloak';
import type { UserRole } from '@startflow/contracts';
import type { AppEnvironment } from '../../../environments/environment.model';
import { resolveRoles, type StartFlowTokenClaims } from './roles';

export type AuthStatus = 'authenticated' | 'unauthenticated' | 'error';

export interface AuthUser {
  subject: string;
  name: string;
  username?: string;
  email?: string;
}

export interface StartFlowAuthAdapter {
  readonly mode: 'keycloak' | 'mock';
  readonly clientId?: string;
  isAuthenticated(): boolean;
  getClaims(): StartFlowTokenClaims | undefined;
  login(): Promise<void>;
  logout(): Promise<void>;
  getAccessToken(): Promise<string>;
}

export const STARTFLOW_AUTH_ADAPTER = new InjectionToken<StartFlowAuthAdapter>(
  'startflow.auth-adapter',
);

@Injectable({ providedIn: 'root' })
export class AuthStateService {
  readonly #adapter = inject(STARTFLOW_AUTH_ADAPTER);
  readonly #status = signal<AuthStatus>('unauthenticated');
  readonly #user = signal<AuthUser | null>(null);
  readonly #roles = signal<UserRole[]>([]);
  readonly #error = signal<string | null>(null);

  readonly status = this.#status.asReadonly();
  readonly user = this.#user.asReadonly();
  readonly roles = this.#roles.asReadonly();
  readonly error = this.#error.asReadonly();
  readonly isAuthenticated = computed(() => this.#status() === 'authenticated');

  constructor() {
    this.refresh();
  }

  refresh(): void {
    if (!this.#adapter.isAuthenticated()) {
      this.#status.set('unauthenticated');
      this.#user.set(null);
      this.#roles.set([]);
      return;
    }

    const claims = this.#adapter.getClaims();
    const name = claims?.name ?? claims?.preferred_username ?? 'Người dùng StartFlow';
    this.#user.set({
      subject: claims?.sub ?? 'unknown',
      name,
      username: claims?.preferred_username,
      email: claims?.email,
    });
    this.#roles.set(resolveRoles(claims, this.#clientId()));
    this.#error.set(null);
    this.#status.set('authenticated');
  }

  async login(): Promise<void> {
    await this.#adapter.login();
    this.refresh();
  }

  async logout(): Promise<void> {
    await this.#adapter.logout();
    this.#user.set(null);
    this.#roles.set([]);
    this.#error.set(null);
    this.#status.set('unauthenticated');
  }

  async getAccessToken(): Promise<string> {
    try {
      const token = await this.#adapter.getAccessToken();
      this.refresh();
      return token;
    } catch (error) {
      this.#error.set(error instanceof Error ? error.message : 'AUTH_REQUIRED');
      this.#status.set('error');
      throw error;
    }
  }

  #clientId(): string {
    if (this.#adapter.mode === 'mock') return 'startflow-web';
    return this.#adapter.clientId ?? '';
  }
}

export function createKeycloakAuthAdapter(
  keycloakService: SdKeycloakService,
  environment: AppEnvironment,
): StartFlowAuthAdapter {
  return {
    mode: 'keycloak',
    isAuthenticated: () => !!keycloakService.getIsAuthenticated(),
    getClaims: () => keycloakService.keycloak?.tokenParsed as StartFlowTokenClaims | undefined,
    login: () => keycloakService.login(),
    logout: () => keycloakService.logout(),
    getAccessToken: async () => {
      if (!keycloakService.keycloak?.authenticated) throw new Error('AUTH_REQUIRED');
      await keycloakService.keycloak.updateToken(30);
      const token = keycloakService.getToken();
      if (!token) throw new Error('AUTH_REQUIRED');
      return token;
    },
    clientId: environment.keycloakClientId,
  };
}

export function createMockAuthAdapter(): StartFlowAuthAdapter {
  const claims: StartFlowTokenClaims = {
    sub: 'demo-reviewer',
    name: 'Demo Reviewer',
    preferred_username: 'demo-reviewer',
    email: 'demo@startflow.local',
    realm_access: { roles: ['analyst', 'approver'] },
  };
  return {
    mode: 'mock',
    isAuthenticated: () => true,
    getClaims: () => claims,
    login: () => Promise.resolve(),
    logout: () => Promise.resolve(),
    getAccessToken: () => Promise.resolve('mock-access-token'),
  };
}
