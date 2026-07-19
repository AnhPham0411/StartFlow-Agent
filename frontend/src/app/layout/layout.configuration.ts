import { inject, Injectable } from '@angular/core';
import type { ISdLayoutConfiguration } from '@sdcorejs/angular/modules/layout';
import { AuthStateService } from '../core/auth/auth-state.service';

@Injectable()
export class LayoutConfiguration implements ISdLayoutConfiguration {
  private readonly authState = inject<AuthStateService>(AuthStateService);
  readonly homeUrl = '/dashboard';
  readonly sidebar = {
    version: 1 as const,
    brandColor: '#f37021',
    brandLightColor: '#fff3e8',
    logoUrl: '/logo.png',
    defaultTitle: 'SHB StartFlow',
    pin: { enabled: true },
  };

  userInfo: ISdLayoutConfiguration['userInfo'] = () => {
    const user = this.authState.user();
    return {
      username: user?.username,
      email: user?.email,
      fullName: user?.name ?? 'Người dùng StartFlow',
      avatar: user?.name,
    };
  };

  signout: ISdLayoutConfiguration['signout'] = () => this.authState.logout();
}
