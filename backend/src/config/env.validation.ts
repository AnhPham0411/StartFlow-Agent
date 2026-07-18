export type NodeEnvironment = 'development' | 'test' | 'production';
export type AuthMode = 'keycloak' | 'mock';

export interface AppEnvironment {
  AI_SERVICE_URL: string;
  AUTH_MODE: AuthMode;
  CORS_ORIGINS: string;
  DATABASE_URL: string;
  INTERNAL_SERVICE_TOKEN: string;
  KEYCLOAK_AUDIENCE: string;
  KEYCLOAK_ISSUER: string;
  LOG_LEVEL: string;
  NODE_ENV: NodeEnvironment;
  PORT: number;
}

// KEYCLOAK_* chỉ bắt buộc khi AUTH_MODE=keycloak (xem validateEnvironment).
const required = ['AI_SERVICE_URL', 'CORS_ORIGINS', 'DATABASE_URL', 'INTERNAL_SERVICE_TOKEN'] as const;

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

  const authMode = String(input.AUTH_MODE ?? 'keycloak');
  if (!['keycloak', 'mock'].includes(authMode)) {
    throw new Error('AUTH_MODE must be keycloak or mock');
  }
  if (authMode === 'mock' && nodeEnvironment === 'production') {
    throw new Error('AUTH_MODE=mock bị từ chối trong production — hãy cấu hình Keycloak');
  }
  // Chế độ keycloak mới cần realm/issuer/audience; chế độ mock (dev-login) bỏ qua.
  if (authMode === 'keycloak') {
    for (const key of ['KEYCLOAK_AUDIENCE', 'KEYCLOAK_ISSUER'] as const) {
      if (typeof input[key] !== 'string' || String(input[key]).trim().length === 0) {
        throw new Error(`${key} is required when AUTH_MODE=keycloak`);
      }
    }
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

  return {
    AI_SERVICE_URL: requireUrl(String(input.AI_SERVICE_URL), 'AI_SERVICE_URL'),
    AUTH_MODE: authMode as AuthMode,
    CORS_ORIGINS: corsOrigins,
    DATABASE_URL: String(input.DATABASE_URL),
    INTERNAL_SERVICE_TOKEN: serviceToken,
    KEYCLOAK_AUDIENCE: String(input.KEYCLOAK_AUDIENCE ?? ''),
    KEYCLOAK_ISSUER:
      authMode === 'keycloak' ? requireUrl(String(input.KEYCLOAK_ISSUER), 'KEYCLOAK_ISSUER') : '',
    LOG_LEVEL: String(input.LOG_LEVEL ?? 'info'),
    NODE_ENV: nodeEnvironment as NodeEnvironment,
    PORT: port,
  };
}
