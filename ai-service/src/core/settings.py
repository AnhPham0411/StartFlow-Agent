from __future__ import annotations

from functools import lru_cache
from typing import Literal, Self

from pydantic import AnyHttpUrl, Field, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import URL


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

    db_host: str | None = None
    db_port: int = Field(default=5432, ge=1, le=65535)
    db_name: str | None = None
    db_user: str | None = None
    db_password: SecretStr | None = None
    db_ssl_mode: Literal["disable", "allow", "prefer", "require", "verify-ca", "verify-full"] = (
        "prefer"
    )
    db_ssl_root_cert: str | None = None
    knowledge_seed_path: str = "/app/knowledge/seed"
    rag_top_k: int = Field(default=3, ge=1, le=20)
    embedding_dimensions: int = Field(default=1536, ge=1, le=4096)
    qdrant_url: AnyHttpUrl | None = None
    qdrant_api_key: SecretStr | None = None
    qdrant_collection: str = Field(
        default="startflow_knowledge", pattern=r"^[A-Za-z0-9._-]+$"
    )
    qdrant_vector_size: int = Field(default=1536, ge=1, le=4096)
    qdrant_timeout_seconds: float = Field(default=10.0, gt=0, le=60)

    llm_mode: Literal["mock", "openai-compatible"] = "mock"
    llm_api_key: SecretStr | None = None
    llm_base_url: AnyHttpUrl | None = None
    llm_model: str = "gpt-4.1-mini"
    embedding_model: str = "text-embedding-3-small"

    internal_service_token: SecretStr = SecretStr("development-only-change-me")
    internal_callback_url: str = "http://backend:3001/internal/ai/events"
    callback_timeout_seconds: float = Field(default=5.0, gt=0, le=30)
    callback_max_attempts: int = Field(default=3, ge=1, le=6)

    nba_enabled: bool = True
    nba_demo_mode: bool = True
    nba_stage_max_attempts: int = Field(default=2, ge=2, le=2)
    nba_stage_timeout_seconds: float = Field(default=30.0, gt=0, le=300)
    nba_geo_confidence_threshold: float = Field(default=0.8, ge=0, le=1)

    @property
    def ai_database_url(self) -> str | None:
        """Build the SQLAlchemy DSN in memory from split deployment secrets."""
        host = self.db_host
        name = self.db_name
        user = self.db_user
        password = self.db_password
        if host is None or name is None or user is None or password is None:
            return None
        password_value = password.get_secret_value()
        if not host or not name or not user or not password_value:
            return None
        query: dict[str, str] = {"sslmode": self.db_ssl_mode}
        if self.db_ssl_root_cert:
            query["sslrootcert"] = self.db_ssl_root_cert
        return URL.create(
            drivername="postgresql",
            username=user,
            password=password_value,
            host=host,
            port=self.db_port,
            database=name,
            query=query,
        ).render_as_string(hide_password=False)

    @model_validator(mode="after")
    def validate_secure_modes(self) -> Self:
        if self.llm_mode == "openai-compatible" and self.llm_api_key is None:
            raise ValueError("LLM_API_KEY is required when LLM_MODE=openai-compatible")
        if self.qdrant_vector_size != self.embedding_dimensions:
            raise ValueError("QDRANT_VECTOR_SIZE must match EMBEDDING_DIMENSIONS")
        if self.environment == "production":
            if self.internal_service_token.get_secret_value() == "development-only-change-me":
                raise ValueError("INTERNAL_SERVICE_TOKEN must be changed in production")
            if not self.ai_database_url:
                raise ValueError(
                    "DB_HOST, DB_NAME, DB_USER and DB_PASSWORD are required in production"
                )
            if self.db_ssl_mode not in {"require", "verify-ca", "verify-full"}:
                raise ValueError("DB_SSL_MODE must fail closed in production")
            if self.qdrant_url is None:
                raise ValueError("QDRANT_URL is required in production")
            if self.qdrant_api_key is None or not self.qdrant_api_key.get_secret_value():
                raise ValueError("QDRANT_API_KEY is required in production")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
