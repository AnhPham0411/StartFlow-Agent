export type StartFlowAuthMode = 'keycloak' | 'mock';

/** Browser-visible configuration selected by Angular file replacements at build time. */
export interface AppEnvironment {
  production: boolean;
  apiUrl: string;
  authMode: StartFlowAuthMode;
  keycloakUrl: string;
  keycloakRealm: string;
  keycloakClientId: string;
}
