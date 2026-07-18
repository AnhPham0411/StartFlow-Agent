import { validateEnvironment } from '../src/config/env.validation';

const validEnvironment = {
  AI_SERVICE_URL: 'http://ai-service:8000',
  CORS_ORIGINS: 'http://localhost:3000',
  DB_HOST: 'localhost',
  DB_NAME: 'demo',
  DB_PASSWORD: 'fixture-password',
  DB_PORT: '5432',
  DB_SSL_MODE: 'require',
  DB_USER: 'demo',
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
    expect(result.DATABASE_URL).toContain('sslmode=require');
    expect(result.EXPLAINER_MODE).toBe('rules');
    expect(result.LLM_BASE_URL).toBe('https://api.openai.com/v1');
  });

  it('fails closed when an internal token is too short', () => {
    expect(() =>
      validateEnvironment({ ...validEnvironment, INTERNAL_SERVICE_TOKEN: 'short' }),
    ).toThrow('INTERNAL_SERVICE_TOKEN');
  });

  it('requires provider configuration for non-rule explainers', () => {
    expect(() => validateEnvironment({ ...validEnvironment, EXPLAINER_MODE: 'llm' })).toThrow(
      'LLM_API_KEY',
    );

    expect(() => validateEnvironment({ ...validEnvironment, EXPLAINER_MODE: 'model' })).toThrow(
      'EXTERNAL_MODEL_URL',
    );
  });
});
