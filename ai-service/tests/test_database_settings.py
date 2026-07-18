from __future__ import annotations

from sqlalchemy.engine import make_url

from src.core.settings import Settings


def test_settings_build_database_url_from_split_fields(monkeypatch) -> None:
    monkeypatch.setenv("DB_HOST", "postgres.example.test")
    monkeypatch.setenv("DB_PORT", "5432")
    monkeypatch.setenv("DB_NAME", "startflow_dev")
    monkeypatch.setenv("DB_USER", "startflow_dev")
    monkeypatch.setenv("DB_PASSWORD", "fixture]password;=value")
    monkeypatch.setenv("DB_SSL_MODE", "require")

    database_url = Settings().ai_database_url
    assert database_url is not None
    assert "fixture]password;=value" not in database_url
    parsed = make_url(database_url)

    assert parsed.host == "postgres.example.test"
    assert parsed.port == 5432
    assert parsed.database == "startflow_dev"
    assert parsed.username == "startflow_dev"
    assert parsed.password == "fixture]password;=value"
    assert parsed.query["sslmode"] == "require"


def test_production_requires_complete_split_database_config(monkeypatch) -> None:
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("INTERNAL_SERVICE_TOKEN", "fixture-internal-token")
    monkeypatch.setenv("DB_SSL_MODE", "require")
    for key in ("DB_HOST", "DB_NAME", "DB_USER", "DB_PASSWORD"):
        monkeypatch.delenv(key, raising=False)

    try:
        Settings()
    except ValueError as error:
        assert "DB_HOST, DB_NAME, DB_USER and DB_PASSWORD" in str(error)
    else:
        raise AssertionError("production settings accepted missing database fields")


def test_production_requires_qdrant_connection(monkeypatch) -> None:
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("INTERNAL_SERVICE_TOKEN", "fixture-internal-token")
    monkeypatch.setenv("DB_HOST", "postgres.example.test")
    monkeypatch.setenv("DB_NAME", "startflow_dev")
    monkeypatch.setenv("DB_USER", "startflow_dev")
    monkeypatch.setenv("DB_PASSWORD", "fixture-password")
    monkeypatch.setenv("DB_SSL_MODE", "require")
    monkeypatch.delenv("QDRANT_URL", raising=False)
    monkeypatch.delenv("QDRANT_API_KEY", raising=False)

    try:
        Settings()
    except ValueError as error:
        assert "QDRANT_URL is required" in str(error)
    else:
        raise AssertionError("production settings accepted missing Qdrant connection")


def test_qdrant_vector_size_must_match_embedding_dimensions(monkeypatch) -> None:
    monkeypatch.setenv("QDRANT_VECTOR_SIZE", "768")
    monkeypatch.setenv("EMBEDDING_DIMENSIONS", "1536")

    try:
        Settings()
    except ValueError as error:
        assert "QDRANT_VECTOR_SIZE must match EMBEDDING_DIMENSIONS" in str(error)
    else:
        raise AssertionError("settings accepted incompatible embedding dimensions")
