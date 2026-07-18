import { buildDatabaseUrl } from './database-url';

export type NodeEnvironment = 'development' | 'test' | 'production';
export type ExplainerMode = 'rules' | 'llm' | 'model';

export interface AppEnvironment {
  AI_SERVICE_URL: string;
  CORS_ORIGINS: string;
  DATABASE_URL: string;
  EXPLAINER_MODE: ExplainerMode;
  EXTERNAL_MODEL_URL?: string;
  INTERNAL_SERVICE_TOKEN: string;
  KEYCLOAK_ISSUER: string;
  KEYCLOAK_SECRET: string;
  LOG_LEVEL: string;
  LLM_API_KEY?: string;
  LLM_BASE_URL: string;
  LLM_MODEL: string;
  NODE_ENV: NodeEnvironment;
  PORT: number;
}

const required = [
  'AI_SERVICE_URL',
  'CORS_ORIGINS',
  'INTERNAL_SERVICE_TOKEN',
  'KEYCLOAK_ISSUER',
  'KEYCLOAK_SECRET',
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

  const explainerMode = String(input.EXPLAINER_MODE ?? 'rules');
  if (!['rules', 'llm', 'model'].includes(explainerMode)) {
    throw new Error('EXPLAINER_MODE must be rules, llm or model');
  }

  const llmApiKey = String(input.LLM_API_KEY ?? '').trim();
  if (explainerMode === 'llm' && llmApiKey.length === 0) {
    throw new Error('LLM_API_KEY is required when EXPLAINER_MODE=llm');
  }

  const externalModelUrl = String(input.EXTERNAL_MODEL_URL ?? '').trim();
  if (explainerMode === 'model' && externalModelUrl.length === 0) {
    throw new Error('EXTERNAL_MODEL_URL is required when EXPLAINER_MODE=model');
  }

  return {
    AI_SERVICE_URL: requireUrl(String(input.AI_SERVICE_URL), 'AI_SERVICE_URL'),
    CORS_ORIGINS: corsOrigins,
    DATABASE_URL: databaseUrl,
    EXPLAINER_MODE: explainerMode as ExplainerMode,
    EXTERNAL_MODEL_URL:
      externalModelUrl.length > 0 ? requireUrl(externalModelUrl, 'EXTERNAL_MODEL_URL') : undefined,
    INTERNAL_SERVICE_TOKEN: serviceToken,
    KEYCLOAK_ISSUER: requireUrl(String(input.KEYCLOAK_ISSUER), 'KEYCLOAK_ISSUER'),
    KEYCLOAK_SECRET: String(input.KEYCLOAK_SECRET),
    LOG_LEVEL: String(input.LOG_LEVEL ?? 'info'),
    LLM_API_KEY: llmApiKey.length > 0 ? llmApiKey : undefined,
    LLM_BASE_URL: requireUrl(
      String(input.LLM_BASE_URL ?? 'https://api.openai.com/v1'),
      'LLM_BASE_URL',
    ),
    LLM_MODEL: String(input.LLM_MODEL ?? 'gpt-4.1-mini'),
    NODE_ENV: nodeEnvironment as NodeEnvironment,
    PORT: port,
  };
}
