import { TestBed } from '@angular/core/testing';
import { type ActivatedRouteSnapshot, Router, type RouterStateSnapshot } from '@angular/router';
import { SD_AUTH_CONFIGURATION, SdAuthGuard, SdAuthService } from '@sdcorejs/angular/modules/auth';
import {
  SD_PERMISSION_CONFIGURATION,
  SdPermissionGuard,
} from '@sdcorejs/angular/modules/permission';
import type { UserRole } from '@startflow/contracts';
import { AuthConfiguration } from './auth.configuration';
import { AuthStateService } from './auth-state.service';
import { PermissionConfiguration } from './permission.configuration';
import { STARTFLOW_PERMISSIONS } from './permission-map';

describe('Core auth and permission guards', () => {
  it('blocks an unauthenticated route and starts login through the auth adapter state', () => {
    const harness = configureHarness(false, []);

    const allowed = harness.authGuard.canActivate(route(), state('/dashboard'));

    expect(allowed).toBeFalse();
    expect(harness.authState.login).toHaveBeenCalledTimes(1);
  });

  it('allows an authenticated common workspace permission', async () => {
    const harness = configureHarness(true, ['employee']);

    expect(harness.authGuard.canActivate(route(), state('/cases'))).toBeTrue();
    await harness.permissionGuard.canActivate(route(), state('/cases'));

    await expectAsync(
      harness.permissionGuard.canActivateChild(
        route(STARTFLOW_PERMISSIONS.caseView),
        state('/cases'),
      ),
    ).toBeResolvedTo(true);
  });

  it('denies missing admin and approval permissions and invokes the forbidden route', async () => {
    const harness = configureHarness(true, ['employee']);
    await harness.permissionGuard.canActivate(route(), state('/dashboard'));

    await expectAsync(
      harness.permissionGuard.canActivateChild(
        route(STARTFLOW_PERMISSIONS.knowledgeView),
        state('/knowledge'),
      ),
    ).toBeResolvedTo(false);
    await expectAsync(
      harness.permissionGuard.canActivateChild(
        route(STARTFLOW_PERMISSIONS.runApprove),
        state('/runs/run-1'),
      ),
    ).toBeResolvedTo(false);

    expect(harness.navigateByUrl.calls.allArgs()).toEqual([['/forbidden'], ['/forbidden']]);
  });

  it('allows the protected paths for administrator and approver roles', async () => {
    const harness = configureHarness(true, ['admin', 'manager']);
    await harness.permissionGuard.canActivate(route(), state('/dashboard'));

    await expectAsync(
      harness.permissionGuard.canActivateChild(
        route(STARTFLOW_PERMISSIONS.knowledgeView),
        state('/knowledge'),
      ),
    ).toBeResolvedTo(true);
    await expectAsync(
      harness.permissionGuard.canActivateChild(
        route(STARTFLOW_PERMISSIONS.runApprove),
        state('/runs/run-1'),
      ),
    ).toBeResolvedTo(true);
    expect(harness.navigateByUrl).not.toHaveBeenCalled();
  });

  it('keeps the Core auth signout action wired to auth state logout', async () => {
    const harness = configureHarness(true, ['employee']);

    harness.authService.signout();
    await Promise.resolve();
    await Promise.resolve();

    expect(harness.authState.logout).toHaveBeenCalledTimes(1);
  });
});

function configureHarness(authenticated: boolean, roles: UserRole[]) {
  TestBed.resetTestingModule();
  const authState = {
    isAuthenticated: jasmine.createSpy('isAuthenticated').and.returnValue(authenticated),
    login: jasmine.createSpy('login').and.resolveTo(),
    logout: jasmine.createSpy('logout').and.resolveTo(),
    user: jasmine.createSpy('user').and.returnValue({
      subject: 'user-1',
      name: 'StartFlow User',
      username: 'startflow.user',
      email: 'user@startflow.test',
    }),
    roles: jasmine.createSpy('roles').and.returnValue(roles),
    getAccessToken: jasmine.createSpy('getAccessToken').and.resolveTo('access-token'),
  };
  const navigateByUrl = jasmine.createSpy('navigateByUrl').and.resolveTo(true);

  TestBed.configureTestingModule({
    providers: [
      { provide: AuthStateService, useValue: authState },
      { provide: Router, useValue: { navigateByUrl } },
      { provide: SD_AUTH_CONFIGURATION, useClass: AuthConfiguration },
      { provide: SD_PERMISSION_CONFIGURATION, useClass: PermissionConfiguration },
    ],
  });

  return {
    authState,
    navigateByUrl,
    authGuard: TestBed.inject(SdAuthGuard),
    authService: TestBed.inject(SdAuthService),
    permissionGuard: TestBed.inject(SdPermissionGuard),
  };
}

function route(permission?: string): ActivatedRouteSnapshot {
  return { data: permission ? { permission } : {} } as ActivatedRouteSnapshot;
}

function state(url: string): RouterStateSnapshot {
  return { url } as RouterStateSnapshot;
}
