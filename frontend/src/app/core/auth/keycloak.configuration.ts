import { inject, Injectable } from '@angular/core';
import type { ISdKeycloakConfiguration } from '@sdcorejs/angular/modules/keycloak';
import { APP_ENVIRONMENT } from '../config/app-environment.token';

@Injectable()
export class KeycloakConfiguration implements ISdKeycloakConfiguration {
  private readonly environment = inject(APP_ENVIRONMENT);

  loadTenantConfig: ISdKeycloakConfiguration['loadTenantConfig'] = async () => {
    const config = this.environment;
    return {
      url: config.keycloakUrl,
      realm: config.keycloakRealm,
      clientId: config.keycloakClientId,
      secureRoutes: [config.apiUrl],
      silentRenewUrl: 'silent-renew',
      authErrorUrl: 'auth-keycloak-error',
    };
  };
}
