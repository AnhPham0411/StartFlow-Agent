from pathlib import Path

from fastapi.testclient import TestClient

from src.core.settings import get_settings
from src.main import create_app


def configure(monkeypatch) -> None:
    monkeypatch.setenv("ENVIRONMENT", "test")
    monkeypatch.setenv("INTERNAL_SERVICE_TOKEN", "test-service-token")
    for key in ("DB_HOST", "DB_NAME", "DB_USER", "DB_PASSWORD"):
        monkeypatch.delenv(key, raising=False)
    monkeypatch.setenv(
        "KNOWLEDGE_SEED_PATH", str(Path(__file__).resolve().parents[2] / "knowledge" / "seed")
    )
    get_settings.cache_clear()


def test_list_knowledge_requires_internal_token(monkeypatch) -> None:
    configure(monkeypatch)
    with TestClient(create_app()) as client:
        response = client.get("/knowledge", headers={"X-Internal-Service-Token": "wrong"})
    assert response.status_code == 401


def test_list_knowledge_uses_seed_fallback(monkeypatch) -> None:
    configure(monkeypatch)
    with TestClient(create_app()) as client:
        response = client.get(
            "/knowledge", headers={"X-Internal-Service-Token": "test-service-token"}
        )
    assert response.status_code == 200
    assert {item["domain"] for item in response.json()} == {
        "credit",
        "compliance",
        "operations",
    }


def test_ingest_requires_configured_database(monkeypatch) -> None:
    configure(monkeypatch)
    with TestClient(create_app()) as client:
        response = client.post(
            "/knowledge",
            headers={"X-Internal-Service-Token": "test-service-token"},
            json={
                "title": "Demo policy",
                "domain": "CREDIT",
                "content": "DEMO DATA. Nội dung mô phỏng đủ dài để thực hiện ingestion.",
                "demoData": True,
            },
        )
    assert response.status_code == 503
