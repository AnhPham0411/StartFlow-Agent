import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import type { ISdPermissionConfiguration } from '@sdcorejs/angular/modules/permission';
import { AuthStateService } from './auth-state.service';
import { permissionsForRoles } from './permission-map';

@Injectable()
export class PermissionConfiguration implements ISdPermissionConfiguration {
  readonly disabled = false;
  private readonly authState = inject<AuthStateService>(AuthStateService);
  private readonly router = inject<Router>(Router);

  loadPermissions: ISdPermissionConfiguration['loadPermissions'] = () =>
    permissionsForRoles(this.authState.roles());

  getToken: ISdPermissionConfiguration['getToken'] = () => this.authState.getAccessToken();

  onForbiden: ISdPermissionConfiguration['onForbiden'] = () => {
    void this.router.navigateByUrl('/forbidden');
  };
}
