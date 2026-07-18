import { validateEnvironment } from '../src/config/env.validation';

const validEnvironment = {
  AI_SERVICE_URL: 'http://ai-service:8000',
  CORS_ORIGINS: 'http://localhost:3000',
  DATABASE_URL: 'postgresql://demo:demo@localhost:5432/demo',
  INTERNAL_SERVICE_TOKEN: 'a-demo-token-with-safe-length',
  KEYCLOAK_AUDIENCE: 'startflow-api',
  KEYCLOAK_ISSUER: 'https://auth.example.test/realms/startflow',
};

describe('environment validation', () => {
  it('normalizes validated URLs and supplies safe process defaults', () => {
    const result = validateEnvironment(validEnvironment);

    expect(result.PORT).toBe(3001);
    expect(result.NODE_ENV).toBe('development');
    expect(result.KEYCLOAK_ISSUER).toBe('https://auth.example.test/realms/startflow');
  });

  it('fails closed when an internal token is too short', () => {
    expect(() =>
      validateEnvironment({ ...validEnvironment, INTERNAL_SERVICE_TOKEN: 'short' }),
    ).toThrow('INTERNAL_SERVICE_TOKEN');
  });

  it('allows dev-login (AUTH_MODE=mock) without any Keycloak config', () => {
    const { KEYCLOAK_AUDIENCE, KEYCLOAK_ISSUER, ...withoutKeycloak } = validEnvironment;
    const result = validateEnvironment({ ...withoutKeycloak, AUTH_MODE: 'mock' });

    expect(result.AUTH_MODE).toBe('mock');
    expect(result.KEYCLOAK_ISSUER).toBe('');
  });

  it('rejects dev-login in production', () => {
    expect(() =>
      validateEnvironment({ ...validEnvironment, AUTH_MODE: 'mock', NODE_ENV: 'production' }),
    ).toThrow('production');
  });
});
