import type { AppEnvironment } from './environment.model';

// Hosted development currently uses the verified shared StartFlow API and Keycloak endpoints.
export const environment: AppEnvironment = {
  production: false,
  apiUrl: 'https://startflow-api.cloudsolution.vn/api',
  authMode: 'keycloak',
  keycloakUrl: 'https://auth-dev.cloudsolution.vn',
  keycloakRealm: 'startflow',
  keycloakClientId: 'portal-ops',
};
