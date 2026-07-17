from __future__ import annotations

from functools import lru_cache
from typing import Literal, Self

from pydantic import AnyHttpUrl, Field, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=None,
        case_sensitive=False,
        extra="ignore",
    )

    service_name: str = "startflow-ai-service"
    environment: Literal["development", "test", "production"] = "development"
    log_level: str = "INFO"
    port: int = Field(default=8000, ge=1, le=65535)

    ai_database_url: str | None = None
    db_ssl_mode: Literal["disable", "allow", "prefer", "require", "verify-ca", "verify-full"] = (
        "prefer"
    )
    db_ssl_root_cert: str | None = None
    knowledge_seed_path: str = "/app/knowledge/seed"
    rag_top_k: int = Field(default=3, ge=1, le=20)
    embedding_dimensions: int = Field(default=1536, ge=1, le=4096)

    llm_mode: Literal["mock", "openai-compatible"] = "mock"
    llm_api_key: SecretStr | None = None
    llm_base_url: AnyHttpUrl | None = None
    llm_model: str = "gpt-4.1-mini"
    embedding_model: str = "text-embedding-3-small"

    internal_service_token: SecretStr = SecretStr("development-only-change-me")
    internal_callback_url: str = "http://backend:3001/internal/ai/events"
    callback_timeout_seconds: float = Field(default=5.0, gt=0, le=30)
    callback_max_attempts: int = Field(default=3, ge=1, le=6)

    @model_validator(mode="after")
    def validate_secure_modes(self) -> Self:
        if self.llm_mode == "openai-compatible" and self.llm_api_key is None:
            raise ValueError("LLM_API_KEY is required when LLM_MODE=openai-compatible")
        if self.environment == "production":
            if self.internal_service_token.get_secret_value() == "development-only-change-me":
                raise ValueError("INTERNAL_SERVICE_TOKEN must be changed in production")
            if not self.ai_database_url:
                raise ValueError("AI_DATABASE_URL is required in production")
            if self.db_ssl_mode not in {"require", "verify-ca", "verify-full"}:
                raise ValueError("DB_SSL_MODE must fail closed in production")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
