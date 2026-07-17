from __future__ import annotations

from collections.abc import Callable
from datetime import UTC, datetime
from typing import Any
from uuid import NAMESPACE_URL, UUID, uuid5

from src.models.contracts import AgentKind, PublicRunEventType, RunEvent


class EventFactory:
    def __init__(
        self,
        run_id: UUID,
        correlation_id: UUID,
        clock: Callable[[], datetime] | None = None,
    ) -> None:
        self.run_id = run_id
        self.correlation_id = correlation_id
        self.sequence = 0
        self.clock = clock or (lambda: datetime.now(UTC))

    def create(
        self,
        event_type: PublicRunEventType,
        agent: AgentKind | None,
        payload: dict[str, Any],
    ) -> RunEvent:
        self.sequence += 1
        idempotency_key = f"{self.run_id}:{self.sequence}:{event_type.value}"
        return RunEvent(
            id=uuid5(NAMESPACE_URL, idempotency_key),
            run_id=self.run_id,
            sequence=self.sequence,
            type=event_type,
            agent=agent,
            occurred_at=self.clock(),
            correlation_id=self.correlation_id,
            idempotency_key=idempotency_key,
            payload=payload,
        )
