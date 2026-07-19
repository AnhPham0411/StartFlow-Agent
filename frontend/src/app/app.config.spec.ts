import { TestBed } from '@angular/core/testing';
import { SD_KEYCLOAK_CONFIGURATION } from '@sdcorejs/angular/modules/keycloak';
import type { AppEnvironment, StartFlowAuthMode } from '../environments/environment.model';
import { createAppConfig } from './app.config';
import { STARTFLOW_AUTH_ADAPTER, type StartFlowAuthAdapter } from './core/auth/auth-state.service';

describe('createAppConfig', () => {
  it('selects mock providers without installing the Core Keycloak initializer', () => {
    const adapter = configure('mock');

    expect(adapter.mode).toBe('mock');
    expect(TestBed.inject(SD_KEYCLOAK_CONFIGURATION, null)).toBeNull();
  });

  it('installs Core Keycloak and builds the adapter from its service', () => {
    const adapter = configure('keycloak');

    expect(adapter.mode).toBe('keycloak');
    expect(TestBed.inject(SD_KEYCLOAK_CONFIGURATION)).toBeDefined();
  });
});

function configure(authMode: StartFlowAuthMode): StartFlowAuthAdapter {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: createAppConfig([], appEnvironment(authMode)).providers,
  });
  return TestBed.inject(STARTFLOW_AUTH_ADAPTER);
}

function appEnvironment(authMode: StartFlowAuthMode): AppEnvironment {
  return {
    production: authMode === 'keycloak',
    apiUrl: 'https://api.startflow.test/api',
    authMode,
    keycloakUrl: authMode === 'keycloak' ? 'https://identity.startflow.test' : '',
    keycloakRealm: authMode === 'keycloak' ? 'startflow' : '',
    keycloakClientId: authMode === 'keycloak' ? 'startflow-web' : '',
  };
}
