from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

from src.core.settings import get_settings
from src.main import create_app


def test_health_is_process_only(monkeypatch) -> None:
    monkeypatch.setenv("ENVIRONMENT", "test")
    monkeypatch.setenv("LLM_MODE", "mock")
    monkeypatch.setenv(
        "KNOWLEDGE_SEED_PATH", str(Path(__file__).resolve().parents[2] / "knowledge" / "seed")
    )
    get_settings.cache_clear()
    with TestClient(create_app()) as client:
        response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_ready_reports_seed_mode_when_database_is_not_configured(monkeypatch) -> None:
    monkeypatch.setenv("ENVIRONMENT", "test")
    for key in ("DB_HOST", "DB_NAME", "DB_USER", "DB_PASSWORD"):
        monkeypatch.delenv(key, raising=False)
    monkeypatch.setenv(
        "KNOWLEDGE_SEED_PATH", str(Path(__file__).resolve().parents[2] / "knowledge" / "seed")
    )
    get_settings.cache_clear()
    with TestClient(create_app()) as client:
        response = client.get("/ready")
    assert response.status_code == 200
    assert response.json()["checks"]["postgresAndPgvector"] == "not-configured-seed-mode"
