import type { AppEnvironment } from './environment.model';

export const environment: AppEnvironment = {
  production: true,
  apiUrl: 'https://startflow-api.cloudsolution.vn/api',
  authMode: 'keycloak',
  keycloakUrl: 'https://auth-dev.cloudsolution.vn',
  keycloakRealm: 'startflow',
  keycloakClientId: 'portal-ops',
};
