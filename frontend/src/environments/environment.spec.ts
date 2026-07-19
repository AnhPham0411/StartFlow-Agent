import { environment as developmentEnvironment } from './environment.development';
import { environment as productionEnvironment } from './environment.production';
import { environment as localEnvironment } from './environment';

describe('Angular build environments', () => {
  it('uses the local API with mock authentication for local development', () => {
    expect(localEnvironment).toEqual({
      production: false,
      apiUrl: 'http://localhost:3201/api',
      authMode: 'mock',
      keycloakUrl: '',
      keycloakRealm: '',
      keycloakClientId: '',
    });
  });

  it('uses the verified hosted endpoints for the development build', () => {
    expect(developmentEnvironment).toEqual({
      production: false,
      apiUrl: 'https://startflow-api.cloudsolution.vn/api',
      authMode: 'keycloak',
      keycloakUrl: 'https://auth-dev.cloudsolution.vn',
      keycloakRealm: 'startflow',
      keycloakClientId: 'portal-ops',
    });
  });

  it('marks the production build as optimized while preserving its approved public endpoints', () => {
    expect(productionEnvironment).toEqual({
      production: true,
      apiUrl: 'https://startflow-api.cloudsolution.vn/api',
      authMode: 'keycloak',
      keycloakUrl: 'https://auth-dev.cloudsolution.vn',
      keycloakRealm: 'startflow',
      keycloakClientId: 'portal-ops',
    });
  });
});
