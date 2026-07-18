import type { AppEnvironment } from './environment.model';

export const environment: AppEnvironment = {
  production: false,
  apiUrl: 'http://localhost:3001/api',
  authMode: 'mock',
  keycloakUrl: '',
  keycloakRealm: '',
  keycloakClientId: '',
};
