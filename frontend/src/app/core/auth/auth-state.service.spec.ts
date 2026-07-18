import { TestBed } from '@angular/core/testing';
import type { SdKeycloakService } from '@sdcorejs/angular/modules/keycloak';
import type { AppEnvironment } from '../../../environments/environment.model';
import type { StartFlowTokenClaims } from './roles';
import {
  AuthStateService,
  STARTFLOW_AUTH_ADAPTER,
  createKeycloakAuthAdapter,
  createMockAuthAdapter,
  type StartFlowAuthAdapter,
} from './auth-state.service';

describe('AuthStateService', () => {
  it('refreshes profile and merged realm/client roles from the active adapter', () => {
    let authenticated = true;
    const claims: StartFlowTokenClaims = {
      sub: 'user-7',
      name: 'Nguyễn An',
      preferred_username: 'an.nguyen',
      realm_access: { roles: ['analyst'] },
      resource_access: { 'startflow-web': { roles: ['approver', 'unknown'] } },
    };
    const adapter = createAdapter({
      clientId: 'startflow-web',
      isAuthenticated: () => authenticated,
      getClaims: () => claims,
    });
    const service = createService(adapter);

    expect(service.status()).toBe('authenticated');
    expect(service.user()).toEqual({
      subject: 'user-7',
      name: 'Nguyễn An',
      username: 'an.nguyen',
      email: undefined,
    });
    expect(service.roles()).toEqual(['analyst', 'approver', 'sale', 'manager']);

    authenticated = false;
    service.refresh();

    expect(service.status()).toBe('unauthenticated');
    expect(service.user()).toBeNull();
    expect(service.roles()).toEqual([]);
  });

  it('records token failures and clears the failure when logout completes', async () => {
    const tokenError = new Error('token refresh failed');
    const adapter = createAdapter({
      isAuthenticated: () => true,
      getClaims: () => ({ sub: 'user-7', realm_access: { roles: ['analyst'] } }),
      getAccessToken: () => Promise.reject(tokenError),
    });
    const service = createService(adapter);

    await expectAsync(service.getAccessToken()).toBeRejectedWith(tokenError);
    expect(service.status()).toBe('error');
    expect(service.error()).toBe('token refresh failed');

    await service.logout();

    expect(adapter.logout).toHaveBeenCalled();
    expect(service.status()).toBe('unauthenticated');
    expect(service.user()).toBeNull();
    expect(service.roles()).toEqual([]);
    expect(service.error()).toBeNull();
  });

  it('resynchronizes authenticated state after a transient token failure recovers', async () => {
    let tokenAttempt = 0;
    const adapter = createAdapter({
      isAuthenticated: () => true,
      getClaims: () => ({
        sub: 'recovered-user',
        name: 'Người dùng đã khôi phục',
        realm_access: { roles: ['analyst'] },
      }),
      getAccessToken: () => {
        tokenAttempt += 1;
        return tokenAttempt === 1
          ? Promise.reject(new Error('temporary refresh failure'))
          : Promise.resolve('recovered-token');
      },
    });
    const service = createService(adapter);

    await expectAsync(service.getAccessToken()).toBeRejected();
    expect(service.status()).toBe('error');

    await expectAsync(service.getAccessToken()).toBeResolvedTo('recovered-token');
    expect(service.status()).toBe('authenticated');
    expect(service.error()).toBeNull();
    expect(service.user()?.subject).toBe('recovered-user');
    expect(service.roles()).toEqual(['analyst', 'sale']);
  });
});

describe('StartFlow auth adapters', () => {
  it('refreshes Keycloak tokens for 30 seconds and wires profile, login and logout', async () => {
    const updateToken = jasmine.createSpy('updateToken').and.resolveTo(true);
    const login = jasmine.createSpy('login').and.resolveTo();
    const logout = jasmine.createSpy('logout').and.resolveTo();
    const keycloakService = {
      keycloak: {
        authenticated: true,
        tokenParsed: { sub: 'keycloak-user', realm_access: { roles: ['approver'] } },
        updateToken,
      },
      getIsAuthenticated: () => true,
      getToken: () => 'fresh-token',
      login,
      logout,
    } as unknown as SdKeycloakService;
    const adapter = createKeycloakAuthAdapter(keycloakService, keycloakEnvironment());

    await expectAsync(adapter.getAccessToken()).toBeResolvedTo('fresh-token');
    expect(updateToken).toHaveBeenCalledOnceWith(30);
    expect(adapter.getClaims()?.sub).toBe('keycloak-user');
    expect(adapter.clientId).toBe('startflow-web');

    await adapter.login();
    await adapter.logout();
    expect(login).toHaveBeenCalledTimes(1);
    expect(logout).toHaveBeenCalledTimes(1);
  });

  it('fails closed when Keycloak is unauthenticated or returns no token', async () => {
    const updateToken = jasmine.createSpy('updateToken').and.resolveTo(true);
    const service = {
      keycloak: { authenticated: false, updateToken },
      getIsAuthenticated: () => false,
      getToken: () => undefined,
      login: () => Promise.resolve(),
      logout: () => Promise.resolve(),
    } as unknown as SdKeycloakService;
    const adapter = createKeycloakAuthAdapter(service, keycloakEnvironment());

    await expectAsync(adapter.getAccessToken()).toBeRejectedWithError('AUTH_REQUIRED');
    expect(updateToken).not.toHaveBeenCalled();

    (service.keycloak as { authenticated: boolean }).authenticated = true;
    await expectAsync(adapter.getAccessToken()).toBeRejectedWithError('AUTH_REQUIRED');
    expect(updateToken).toHaveBeenCalledOnceWith(30);
  });

  it('keeps mock authentication self-contained without a Keycloak dependency', async () => {
    const adapter = createMockAuthAdapter();

    expect(adapter.mode).toBe('mock');
    expect(adapter.isAuthenticated()).toBeTrue();
    expect(adapter.getClaims()?.realm_access?.roles).toEqual(['analyst', 'approver']);
    await expectAsync(adapter.getAccessToken()).toBeResolvedTo('mock-access-token');
    await expectAsync(adapter.login()).toBeResolved();
    await expectAsync(adapter.logout()).toBeResolved();
  });
});

function createService(adapter: StartFlowAuthAdapter): AuthStateService {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [AuthStateService, { provide: STARTFLOW_AUTH_ADAPTER, useValue: adapter }],
  });
  return TestBed.inject(AuthStateService);
}

function createAdapter(
  overrides: Partial<Omit<StartFlowAuthAdapter, 'logout'>> = {},
): StartFlowAuthAdapter & { logout: jasmine.Spy<() => Promise<void>> } {
  const logout = jasmine.createSpy<() => Promise<void>>('logout').and.resolveTo();
  return {
    mode: 'keycloak',
    clientId: 'startflow-web',
    isAuthenticated: () => false,
    getClaims: () => undefined,
    login: () => Promise.resolve(),
    logout,
    getAccessToken: () => Promise.resolve('access-token'),
    ...overrides,
  };
}

function keycloakEnvironment(): AppEnvironment {
  return {
    production: true,
    apiUrl: 'https://api.startflow.test/api',
    authMode: 'keycloak',
    keycloakUrl: 'https://identity.startflow.test',
    keycloakRealm: 'startflow',
    keycloakClientId: 'startflow-web',
  };
}
