const requiredDatabaseKeys = ['DB_HOST', 'DB_NAME', 'DB_PASSWORD', 'DB_USER'] as const;

function requireDatabaseValue(
  input: Record<string, unknown>,
  key: (typeof requiredDatabaseKeys)[number],
): string {
  const value = input[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${key} is required`);
  }
  return value;
}

/** Builds the Prisma-only DSN at runtime so deployment secrets keep DB fields separate. */
export function buildDatabaseUrl(input: Record<string, unknown>): string {
  const values = Object.fromEntries(
    requiredDatabaseKeys.map((key) => [key, requireDatabaseValue(input, key)]),
  ) as Record<(typeof requiredDatabaseKeys)[number], string>;
  const port = Number(input.DB_PORT ?? 5432);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('DB_PORT must be an integer between 1 and 65535');
  }
  if (!/^[A-Za-z0-9.-]+$/.test(values.DB_HOST)) {
    throw new Error('DB_HOST is invalid');
  }

  const sslMode = String(input.DB_SSL_MODE ?? 'require');
  if (!['disable', 'allow', 'prefer', 'require', 'verify-ca', 'verify-full'].includes(sslMode)) {
    throw new Error('DB_SSL_MODE is invalid');
  }
  const query = new URLSearchParams({ sslmode: sslMode });
  if (typeof input.DB_SSL_ROOT_CERT === 'string' && input.DB_SSL_ROOT_CERT.length > 0) {
    query.set('sslrootcert', input.DB_SSL_ROOT_CERT);
  }

  const username = encodeURIComponent(values.DB_USER);
  const password = encodeURIComponent(values.DB_PASSWORD);
  const database = encodeURIComponent(values.DB_NAME);
  return `postgresql://${username}:${password}@${values.DB_HOST}:${port}/${database}?${query.toString()}`;
}
