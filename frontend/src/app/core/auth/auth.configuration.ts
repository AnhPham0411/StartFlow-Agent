import { inject, Injectable } from '@angular/core';
import type { ISdAuthConfiguration } from '@sdcorejs/angular/modules/auth';
import { AuthStateService } from './auth-state.service';

@Injectable()
export class AuthConfiguration implements ISdAuthConfiguration {
  private readonly authState = inject<AuthStateService>(AuthStateService);

  guard: ISdAuthConfiguration['guard'] = {
    auth: () => {
      if (this.authState.isAuthenticated()) return true;
      void this.authState.login();
      return false;
    },
    portal: () => true,
    authInfo: () => {
      const user = this.authState.user();
      return {
        id: user?.subject,
        username: user?.username,
        email: user?.email,
        firstName: user?.name,
      };
    },
  };

  action: ISdAuthConfiguration['action'] = {
    signout: () => this.authState.logout(),
  };
}
