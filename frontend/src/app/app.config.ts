import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { type ApplicationConfig, type EnvironmentProviders, type Provider } from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter, type Routes, withComponentInputBinding } from '@angular/router';
import { SD_CORE_CONFIGURATION } from '@sdcorejs/angular/configurations';
import { SD_AUTH_CONFIGURATION } from '@sdcorejs/angular/modules/auth';
import {
  provideSdKeycloak,
  SdKeycloakInterceptor,
  SdKeycloakService,
} from '@sdcorejs/angular/modules/keycloak';
import { SD_LAYOUT_CONFIGURATION } from '@sdcorejs/angular/modules/layout';
import { SD_PERMISSION_CONFIGURATION } from '@sdcorejs/angular/modules/permission';
import { environment } from '../environments/environment';
import type { AppEnvironment } from '../environments/environment.model';
import {
  AuthStateService,
  createKeycloakAuthAdapter,
  createMockAuthAdapter,
  STARTFLOW_AUTH_ADAPTER,
} from './core/auth/auth-state.service';
import { AuthConfiguration } from './core/auth/auth.configuration';
import { KeycloakConfiguration } from './core/auth/keycloak.configuration';
import { PermissionConfiguration } from './core/auth/permission.configuration';
import { APP_ENVIRONMENT } from './core/config/app-environment.token';
import { LayoutConfiguration } from './layout/layout.configuration';

/** Creates root providers for the selected Angular build environment. */
export function createAppConfig(
  routes: Routes,
  appEnvironment: AppEnvironment = environment,
): ApplicationConfig {
  const authProviders: Array<Provider | EnvironmentProviders> =
    appEnvironment.authMode === 'keycloak'
      ? [
          provideHttpClient(withInterceptors([SdKeycloakInterceptor])),
          provideSdKeycloak({ useClass: KeycloakConfiguration }),
          {
            provide: STARTFLOW_AUTH_ADAPTER,
            useFactory: (keycloakService: SdKeycloakService, config: AppEnvironment) =>
              createKeycloakAuthAdapter(keycloakService, config),
            deps: [SdKeycloakService, APP_ENVIRONMENT],
          },
        ]
      : [
          provideHttpClient(),
          { provide: STARTFLOW_AUTH_ADAPTER, useFactory: createMockAuthAdapter },
        ];

  return {
    providers: [
      provideAnimationsAsync(),
      provideRouter(routes, withComponentInputBinding()),
      { provide: APP_ENVIRONMENT, useValue: appEnvironment },
      { provide: SD_CORE_CONFIGURATION, useValue: { format: { number: '1.234.567,89' } } },
      { provide: SD_AUTH_CONFIGURATION, useClass: AuthConfiguration },
      { provide: SD_PERMISSION_CONFIGURATION, useClass: PermissionConfiguration },
      { provide: SD_LAYOUT_CONFIGURATION, useClass: LayoutConfiguration },
      AuthStateService,
      ...authProviders,
    ],
  };
}
