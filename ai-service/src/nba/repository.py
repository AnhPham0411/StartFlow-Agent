from __future__ import annotations

from asyncio import Lock
from collections.abc import Sequence
from typing import Protocol
from uuid import UUID

from src.nba.contracts import (
    CustomerSnapshot,
    NbaRunResult,
    RecommendationDraft,
    StoredRecommendation,
)


class NbaRepository(Protocol):
    async def load_customers(self, customer_ids: Sequence[int]) -> list[CustomerSnapshot]: ...

    async def save_running(self, run: NbaRunResult) -> None: ...

    async def commit_success(
        self, run: NbaRunResult, drafts: Sequence[RecommendationDraft]
    ) -> list[StoredRecommendation]: ...

    async def save_failure(self, run: NbaRunResult) -> None: ...

    async def get_run(self, run_id: UUID) -> NbaRunResult | None: ...


class InMemoryNbaRepository:
    """Atomic deterministic adapter for demos and tests; production DB is injected via this seam."""

    def __init__(self, customers: Sequence[CustomerSnapshot] = ()) -> None:
        self._customers = {item.customer_id: item for item in customers}
        self._runs: dict[UUID, NbaRunResult] = {}
        self.recommendations: list[StoredRecommendation] = []
        self._lock = Lock()

    def add_customers(self, customers: Sequence[CustomerSnapshot]) -> None:
        self._customers.update((item.customer_id, item) for item in customers)

    async def load_customers(self, customer_ids: Sequence[int]) -> list[CustomerSnapshot]:
        if not customer_ids:
            return [self._customers[key] for key in sorted(self._customers)]
        return [self._customers[item] for item in customer_ids if item in self._customers]

    async def save_running(self, run: NbaRunResult) -> None:
        async with self._lock:
            self._runs[run.run_id] = run.model_copy(deep=True)

    async def commit_success(
        self, run: NbaRunResult, drafts: Sequence[RecommendationDraft]
    ) -> list[StoredRecommendation]:
        async with self._lock:
            stored: list[StoredRecommendation] = []
            for draft in drafts:
                version = (
                    sum(item.customer_id == draft.customer_id for item in self.recommendations)
                    + 1
                )
                stored.append(
                    StoredRecommendation(
                        **draft.model_dump(), run_id=run.run_id, version=version
                    )
                )
            self.recommendations.extend(stored)
            self._runs[run.run_id] = run.model_copy(deep=True)
            return stored

    async def save_failure(self, run: NbaRunResult) -> None:
        async with self._lock:
            self._runs[run.run_id] = run.model_copy(deep=True)

    async def get_run(self, run_id: UUID) -> NbaRunResult | None:
        run = self._runs.get(run_id)
        return run.model_copy(deep=True) if run else None
