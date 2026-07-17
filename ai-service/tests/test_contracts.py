from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from uuid import UUID

from src.models.contracts import PublicRunEventType, RunEvent


def test_python_event_contract_matches_frozen_json_schema() -> None:
    schema_path = (
        Path(__file__).resolve().parents[2] / "packages" / "contracts" / "run-event.schema.json"
    )
    schema = json.loads(schema_path.read_text(encoding="utf-8"))
    assert set(schema["properties"]["type"]["enum"]) == {item.value for item in PublicRunEventType}
    event = RunEvent(
        id=UUID(int=1),
        run_id=UUID(int=2),
        sequence=1,
        type=PublicRunEventType.RUN_STARTED,
        agent=None,
        occurred_at=datetime.now(UTC),
        correlation_id=UUID(int=3),
        idempotency_key="00000000-0000-0000-0000-000000000002:1:run.started",
        payload={"status": "PLANNING"},
    )
    assert set(event.model_dump(by_alias=True, mode="json")) == set(schema["required"])
