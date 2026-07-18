import { buildDatabaseUrl } from '../src/config/database-url';

describe('database URL construction', () => {
  it('encodes split credentials and carries the TLS policy', () => {
    const credentialFixture = ['fixture', ']', 'value', ';', '='].join('');
    const result = buildDatabaseUrl({
      DB_HOST: 'postgres.example.test',
      DB_NAME: 'startflow_dev',
      DB_PASSWORD: credentialFixture,
      DB_PORT: '5432',
      DB_SSL_MODE: 'require',
      DB_USER: 'startflow_dev',
    });

    const parsed = new URL(result);
    expect(decodeURIComponent(parsed.username)).toBe('startflow_dev');
    expect(decodeURIComponent(parsed.password)).toBe(credentialFixture);
    expect(parsed.hostname).toBe('postgres.example.test');
    expect(parsed.pathname).toBe('/startflow_dev');
    expect(parsed.searchParams.get('sslmode')).toBe('require');
    expect(result).not.toContain(credentialFixture);
  });

  it('rejects missing split database fields', () => {
    expect(() => buildDatabaseUrl({ DB_HOST: 'postgres.example.test' })).toThrow('DB_NAME');
  });
});
