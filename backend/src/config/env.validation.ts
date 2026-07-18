export type NodeEnvironment = 'development' | 'test' | 'production';
export type AuthMode = 'keycloak' | 'mock';

/**
 * Ai viết lời giải thích "vì sao khách phù hợp sản phẩm".
 * - `rules`  : chỉ suy diễn xác định từ policy + R1..R12, KHÔNG gọi LLM (luôn chạy được, rẻ).
 * - `llm`    : lấy bảng tiêu chí đã chấm rồi nhờ LLM ngoài diễn đạt thành câu cho sale đọc.
 * - `model`  : dành cho model riêng sau này — bật lên là ẩn hẳn nhánh `llm`.
 * Bảng tiêu chí đạt/không đạt LUÔN được tính bằng code, mọi mode. LLM chỉ diễn đạt lại,
 * không bao giờ được quyết định đạt hay trượt.
 */
export type ExplainerMode = 'rules' | 'llm' | 'model';

export interface AppEnvironment {
  AI_SERVICE_URL: string;
  AUTH_MODE: AuthMode;
  CORS_ORIGINS: string;
  DATABASE_URL: string;
  EXPLAINER_MODE: ExplainerMode;
  EXTERNAL_MODEL_URL: string;
  INTERNAL_SERVICE_TOKEN: string;
  KEYCLOAK_AUDIENCE: string;
  KEYCLOAK_ISSUER: string;
  LLM_API_KEY: string;
  LLM_BASE_URL: string;
  LLM_MODEL: string;
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

  const explainerMode = String(input.EXPLAINER_MODE ?? 'rules');
  if (!['rules', 'llm', 'model'].includes(explainerMode)) {
    throw new Error('EXPLAINER_MODE must be rules, llm or model');
  }
  // Fail-fast: bật llm mà thiếu key thì báo ngay lúc khởi động, đừng để tới lúc sale bấm mới lỗi.
  if (explainerMode === 'llm' && String(input.LLM_API_KEY ?? '').trim().length === 0) {
    throw new Error('LLM_API_KEY is required when EXPLAINER_MODE=llm');
  }
  if (explainerMode === 'model' && String(input.EXTERNAL_MODEL_URL ?? '').trim().length === 0) {
    throw new Error('EXTERNAL_MODEL_URL is required when EXPLAINER_MODE=model');
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
    EXPLAINER_MODE: explainerMode as ExplainerMode,
    EXTERNAL_MODEL_URL: String(input.EXTERNAL_MODEL_URL ?? ''),
    INTERNAL_SERVICE_TOKEN: serviceToken,
    KEYCLOAK_AUDIENCE: String(input.KEYCLOAK_AUDIENCE ?? ''),
    KEYCLOAK_ISSUER:
      authMode === 'keycloak' ? requireUrl(String(input.KEYCLOAK_ISSUER), 'KEYCLOAK_ISSUER') : '',
    LLM_API_KEY: String(input.LLM_API_KEY ?? ''),
    LLM_BASE_URL: String(input.LLM_BASE_URL ?? 'https://api.openai.com/v1'),
    LLM_MODEL: String(input.LLM_MODEL ?? 'gpt-4o-mini'),
    LOG_LEVEL: String(input.LOG_LEVEL ?? 'info'),
    NODE_ENV: nodeEnvironment as NodeEnvironment,
    PORT: port,
  };
}
