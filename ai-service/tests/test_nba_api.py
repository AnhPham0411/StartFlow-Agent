from __future__ import annotations

from fastapi.testclient import TestClient

from src.core.settings import get_settings
from src.main import create_app
from src.nba.contracts import CustomerSnapshot


def test_nba_run_endpoint_requires_internal_service_token(monkeypatch) -> None:
    monkeypatch.setenv("ENVIRONMENT", "test")
    monkeypatch.setenv("INTERNAL_SERVICE_TOKEN", "test-service-token")
    get_settings.cache_clear()

    with TestClient(create_app()) as client:
        response = client.post(
            "/internal/nba/runs/mini",
            json={"customerIds": [101]},
        )

    assert response.status_code == 422


def test_nba_mini_run_returns_auditable_stage_state(monkeypatch) -> None:
    monkeypatch.setenv("ENVIRONMENT", "test")
    monkeypatch.setenv("INTERNAL_SERVICE_TOKEN", "test-service-token")
    monkeypatch.setenv("NBA_DEMO_MODE", "true")
    get_settings.cache_clear()

    with TestClient(create_app()) as client:
        response = client.post(
            "/internal/nba/runs/mini",
            headers={"X-Internal-Service-Token": "test-service-token"},
            json={
                "customerIds": [101],
                "demoCustomers": [
                    {
                        "customerId": 101,
                        "branchId": 2,
                        "assignedUserId": 7,
                        "fullName": "Demo User",
                        "accountNumber": "123456789012",
                        "rawTransactionNarratives": ["Raw private narrative"],
                        "metrics": {"balance": 25000000},
                    }
                ],
            },
        )

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "succeeded"
    assert payload["kind"] == "mini"
    assert payload["run_id"]
    assert payload["stages"]
    assert all(stage["status"] in {"succeeded", "skipped"} for stage in payload["stages"])


def test_nba_api_accepts_and_emits_frozen_canonical_run_vocabulary(monkeypatch) -> None:
    monkeypatch.setenv("ENVIRONMENT", "test")
    monkeypatch.setenv("INTERNAL_SERVICE_TOKEN", "test-service-token")
    monkeypatch.setenv("NBA_DEMO_MODE", "true")
    get_settings.cache_clear()

    with TestClient(create_app()) as client:
        response = client.post(
            "/internal/nba/runs/mini",
            headers={"X-Internal-Service-Token": "test-service-token"},
            json={
                "kind": "mini",
                "business_date": "2026-07-19",
                "customer_id": 101,
                "idempotency_key": "mini-101-20260719",
                "demo_customers": [
                    {
                        "customerId": 101,
                        "metrics": {"balance": 25000000},
                    }
                ],
            },
        )

    assert response.status_code == 200
    payload = response.json()
    assert payload["kind"] == "mini"
    assert payload["business_date"] == "2026-07-19"
    assert payload["customer_id"] == 101
    assert payload["status"] == "succeeded"
    assert "mode" not in payload
    assert all("run_id" in stage for stage in payload["stages"])


def test_live_mode_does_not_produce_demo_recommendation_without_ranking_rules(
    monkeypatch,
) -> None:
    monkeypatch.setenv("ENVIRONMENT", "test")
    monkeypatch.setenv("INTERNAL_SERVICE_TOKEN", "test-service-token")
    monkeypatch.setenv("NBA_DEMO_MODE", "false")
    get_settings.cache_clear()
    app = create_app()

    with TestClient(app) as client:
        app.state.runtime.nba_repository.add_customers(
            [
                CustomerSnapshot(customer_id=101, metrics={"balance": 25_000_000.0})
            ]
        )
        response = client.post(
            "/internal/nba/runs/mini",
            headers={"X-Internal-Service-Token": "test-service-token"},
            json={
                "kind": "mini",
                "business_date": "2026-07-19",
                "customer_id": 101,
                "idempotency_key": "live-101-20260719",
            },
        )

    assert response.status_code == 200
    assert response.json()["status"] == "succeeded"
    assert app.state.runtime.nba_repository.recommendations == []
