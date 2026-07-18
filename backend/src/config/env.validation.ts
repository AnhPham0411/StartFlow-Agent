import { buildDatabaseUrl } from './database-url';

export type NodeEnvironment = 'development' | 'test' | 'production';

export interface AppEnvironment {
  AI_SERVICE_URL: string;
  CORS_ORIGINS: string;
  DATABASE_URL: string;
  INTERNAL_SERVICE_TOKEN: string;
  KEYCLOAK_AUDIENCE: string;
  KEYCLOAK_ISSUER: string;
  LOG_LEVEL: string;
  NODE_ENV: NodeEnvironment;
  PORT: number;
}

const required = [
  'AI_SERVICE_URL',
  'CORS_ORIGINS',
  'INTERNAL_SERVICE_TOKEN',
  'KEYCLOAK_AUDIENCE',
  'KEYCLOAK_ISSUER',
] as const;

function requireUrl(value: string, key: string): string {
  try {
    return new URL(value).toString().replace(/\/$/, '');
  } catch {
    throw new Error(`${key} must be an absolute URL`);
  }
}

export function validateEnvironment(input: Record<string, unknown>): AppEnvironment {
  for (const key of required) {
    if (typeof input[key] !== 'string' || input[key].trim().length === 0) {
      throw new Error(`${key} is required`);
    }
  }

  const nodeEnvironment = String(input.NODE_ENV ?? 'development');
  if (!['development', 'test', 'production'].includes(nodeEnvironment)) {
    throw new Error('NODE_ENV must be development, test or production');
  }

  const port = Number(input.PORT ?? 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }

  const serviceToken = String(input.INTERNAL_SERVICE_TOKEN);
  if (serviceToken.length < 16) {
    throw new Error('INTERNAL_SERVICE_TOKEN must contain at least 16 characters');
  }

  const corsOrigins = String(input.CORS_ORIGINS)
    .split(',')
    .map((origin) => requireUrl(origin.trim(), 'CORS_ORIGINS'))
    .join(',');
  const databaseUrl = buildDatabaseUrl(input);
  process.env.DATABASE_URL = databaseUrl;

  return {
    AI_SERVICE_URL: requireUrl(String(input.AI_SERVICE_URL), 'AI_SERVICE_URL'),
    CORS_ORIGINS: corsOrigins,
    DATABASE_URL: databaseUrl,
    INTERNAL_SERVICE_TOKEN: serviceToken,
    KEYCLOAK_AUDIENCE: String(input.KEYCLOAK_AUDIENCE),
    KEYCLOAK_ISSUER: requireUrl(String(input.KEYCLOAK_ISSUER), 'KEYCLOAK_ISSUER'),
    LOG_LEVEL: String(input.LOG_LEVEL ?? 'info'),
    NODE_ENV: nodeEnvironment as NodeEnvironment,
    PORT: port,
  };
}
