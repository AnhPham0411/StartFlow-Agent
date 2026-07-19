import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthStateService } from '../auth/auth-state.service';
import { APP_ENVIRONMENT } from '../config/app-environment.token';
import { AdminApiService } from './admin-api.service';

describe('AdminApiService', () => {
  let api: AdminApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        AdminApiService,
        {
          provide: APP_ENVIRONMENT,
          useValue: {
            production: true,
            apiUrl: 'https://api.startflow.test/api',
            authMode: 'keycloak',
            keycloakUrl: 'https://identity.startflow.test',
            keycloakRealm: 'startflow',
            keycloakClientId: 'portal-ops',
          },
        },
        {
          provide: AuthStateService,
          useValue: { getAccessToken: () => Promise.resolve('admin-token') },
        },
      ],
    });
    api = TestBed.inject(AdminApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads current identity and filtered branches with bearer authentication', async () => {
    const identityPromise = api.getCurrentIdentity();
    await Promise.resolve();
    const meRequest = http.expectOne('https://api.startflow.test/api/auth/me');
    expect(meRequest.request.headers.get('Authorization')).toBe('Bearer admin-token');
    meRequest.flush({
      id: 17,
      username: 'user017',
      full_name: 'Admin Demo',
      role: 'admin',
      active: true,
      branch: null,
      identity_synced: true,
      permissions: ['STARTFLOW_ACCOUNT_MANAGE'],
    });
    await expectAsync(identityPromise).toBeResolvedTo(jasmine.objectContaining({ role: 'admin' }));

    const branchesPromise = api.listBranches({ q: 'HN', active: true });
    await Promise.resolve();
    const branchRequest = http.expectOne(
      'https://api.startflow.test/api/admin/branches?q=HN&active=true',
    );
    branchRequest.flush([
      { id: 1, code: 'HN-HK', name: 'Ha Noi - Hoan Kiem', active: true, account_count: 3 },
    ]);
    await expectAsync(branchesPromise).toBeResolvedTo([
      jasmine.objectContaining({ code: 'HN-HK' }),
    ]);
  });

  it('uses dedicated branch and account action endpoints', async () => {
    const branchPromise = api.createBranch({ code: 'DN', name: 'Da Nang' });
    await Promise.resolve();
    const createBranch = http.expectOne('https://api.startflow.test/api/admin/branches');
    expect(createBranch.request.method).toBe('POST');
    expect(createBranch.request.body).toEqual({ code: 'DN', name: 'Da Nang' });
    createBranch.flush({ id: 7, code: 'DN', name: 'Da Nang', active: true, account_count: 0 });
    await branchPromise;

    const disablePromise = api.disableAccount(23);
    await Promise.resolve();
    const disable = http.expectOne('https://api.startflow.test/api/admin/accounts/23/disable');
    expect(disable.request.method).toBe('POST');
    disable.flush({});
    await disablePromise;

    const resetPromise = api.resetPassword(23);
    await Promise.resolve();
    const reset = http.expectOne(
      'https://api.startflow.test/api/admin/accounts/23/reset-password',
    );
    expect(reset.request.method).toBe('POST');
    reset.flush({});
    await resetPromise;
  });

  it('sends role and branch filters without leaking empty values', async () => {
    const accountsPromise = api.listAccounts({
      q: '',
      role: 'manager',
      branch_id: 3,
      active: false,
    });
    await Promise.resolve();

    const request = http.expectOne(
      'https://api.startflow.test/api/admin/accounts?role=manager&branch_id=3&active=false',
    );
    request.flush([]);
    await expectAsync(accountsPromise).toBeResolvedTo([]);
  });
});
