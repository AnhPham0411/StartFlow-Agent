from __future__ import annotations

from pathlib import Path
from uuid import uuid4

from fastapi.testclient import TestClient

from src.api import runs
from src.core.settings import get_settings
from src.main import create_app


class CapturingCallback:
    def __init__(self) -> None:
        self.events = []

    async def publish(self, event) -> None:
        self.events.append(event)

    async def close(self) -> None:
        pass


def payload(case_input) -> dict:
    return {
        "runId": str(uuid4()),
        "caseSnapshot": case_input.model_dump(by_alias=True, mode="json"),
        "mode": "MULTI",
    }


def test_run_api_requires_service_token(monkeypatch, case_input) -> None:
    monkeypatch.setenv("ENVIRONMENT", "test")
    monkeypatch.setenv("INTERNAL_SERVICE_TOKEN", "test-service-token")
    monkeypatch.setenv(
        "KNOWLEDGE_SEED_PATH", str(Path(__file__).resolve().parents[2] / "knowledge" / "seed")
    )
    get_settings.cache_clear()
    with TestClient(create_app()) as client:
        response = client.post(
            "/runs", json=payload(case_input), headers={"Idempotency-Key": "run-key-0001"}
        )
    assert response.status_code == 422


def test_run_api_executes_background_workflow_with_monotonic_events(
    monkeypatch, case_input
) -> None:
    monkeypatch.setenv("ENVIRONMENT", "test")
    monkeypatch.setenv("INTERNAL_SERVICE_TOKEN", "test-service-token")
    monkeypatch.setenv(
        "KNOWLEDGE_SEED_PATH", str(Path(__file__).resolve().parents[2] / "knowledge" / "seed")
    )
    get_settings.cache_clear()
    runs._accepted_keys.clear()
    app = create_app()
    with TestClient(app) as client:
        callback = CapturingCallback()
        app.state.runtime.callback = callback
        request_payload = payload(case_input)
        headers = {
            "X-Internal-Service-Token": "test-service-token",
            "X-Correlation-Id": str(uuid4()),
        }
        first = client.post("/runs", json=request_payload, headers=headers)
        second = client.post("/runs", json=request_payload, headers=headers)
        assert first.status_code == 202
        assert second.json() == first.json()
        assert [event.sequence for event in callback.events] == list(
            range(1, len(callback.events) + 1)
        )
        assert callback.events[-1].type == "run.completed"
        completed = [event for event in callback.events if event.type == "agent.completed"]
        assert all("taskId" in event.payload for event in completed)
        synthesis = next(event for event in callback.events if event.type == "synthesis.completed")
        assert "decision" in synthesis.payload


def test_single_mode_does_not_claim_specialist_or_tool_execution(monkeypatch, case_input) -> None:
    monkeypatch.setenv("ENVIRONMENT", "test")
    monkeypatch.setenv("INTERNAL_SERVICE_TOKEN", "test-service-token")
    monkeypatch.setenv(
        "KNOWLEDGE_SEED_PATH", str(Path(__file__).resolve().parents[2] / "knowledge" / "seed")
    )
    get_settings.cache_clear()
    runs._accepted_keys.clear()
    app = create_app()
    with TestClient(app) as client:
        callback = CapturingCallback()
        app.state.runtime.callback = callback
        request_payload = payload(case_input)
        request_payload["mode"] = "SINGLE"
        response = client.post(
            "/runs",
            json=request_payload,
            headers={
                "X-Internal-Service-Token": "test-service-token",
                "Idempotency-Key": "run-key-single-0001",
            },
        )
        assert response.status_code == 202
        event_types = [event.type for event in callback.events]
        assert "agent.started" not in event_types
        assert "tool.completed" not in event_types
        assert callback.events[0].payload["mode"] == "SINGLE"
