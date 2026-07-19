from __future__ import annotations

from asyncio import sleep
from collections.abc import Awaitable, Callable

import pytest

from src.nba.contracts import (
    CustomerSnapshot,
    NbaRunRequest,
    RecommendationDraft,
    RunMode,
    StageOutput,
)
from src.nba.orchestrator import NbaOrchestrator
from src.nba.repository import InMemoryNbaRepository
from src.nba.stages.base import PipelineStage

StageHandler = Callable[[CustomerSnapshot], Awaitable[StageOutput]]


class RecordingStage(PipelineStage):
    def __init__(self, name: str, handler: StageHandler) -> None:
        self.name = name
        self.handler = handler
        self.calls = 0

    async def execute(self, customer: CustomerSnapshot) -> StageOutput:
        self.calls += 1
        return await self.handler(customer)


def customer() -> CustomerSnapshot:
    return CustomerSnapshot(
        customer_id=101,
        branch_id=2,
        assigned_user_id=7,
        full_name="Nguyen Van Demo",
        account_number="012345678901",
        raw_transaction_narratives=["Chuyen tien cho demo@example.com 0901234567"],
        metrics={"balance": 25_000_000.0},
    )


@pytest.mark.asyncio
async def test_orchestrator_retries_once_then_commits_atomically() -> None:
    repository = InMemoryNbaRepository([customer()])

    async def flaky(item: CustomerSnapshot) -> StageOutput:
        if first.calls == 1:
            raise TimeoutError("temporary")
        return StageOutput(customer=item)

    async def recommend(item: CustomerSnapshot) -> StageOutput:
        return StageOutput(
            customer=item,
            recommendation=RecommendationDraft(
                customer_id=item.customer_id,
                product="CASA",
                hook="Duy tri dong tien linh hoat",
                reason="So du binh quan phu hop",
                call_to_action="Hen tu van 15 phut",
                snapshot_hash="a" * 64,
            ),
        )

    first = RecordingStage("m1", flaky)
    second = RecordingStage("m8", recommend)
    orchestrator = NbaOrchestrator(repository, [first, second], max_attempts=2)

    result = await orchestrator.run(
        NbaRunRequest(mode=RunMode.MINI, customer_ids=[101])
    )

    assert result.status == "completed"
    assert first.calls == 2
    assert second.calls == 1
    assert len(repository.recommendations) == 1
    assert repository.recommendations[0].run_id == result.run_id


@pytest.mark.asyncio
async def test_orchestrator_failure_never_commits_partial_recommendations() -> None:
    repository = InMemoryNbaRepository([customer()])

    async def draft(item: CustomerSnapshot) -> StageOutput:
        return StageOutput(
            customer=item,
            recommendation=RecommendationDraft(
                customer_id=item.customer_id,
                product="CASA",
                hook="Demo",
                reason="Demo",
                call_to_action="Demo",
                snapshot_hash="b" * 64,
            ),
        )

    async def broken(item: CustomerSnapshot) -> StageOutput:
        raise RuntimeError("validator unavailable")

    first = RecordingStage("draft", draft)
    second = RecordingStage("validator", broken)
    result = await NbaOrchestrator(repository, [first, second], max_attempts=2).run(
        NbaRunRequest(mode=RunMode.NIGHTLY, customer_ids=[101])
    )

    assert result.status == "failed"
    assert second.calls == 2
    assert repository.recommendations == []
    stored = await repository.get_run(result.run_id)
    assert stored is not None
    assert stored.error_code == "stage_failed"


@pytest.mark.asyncio
async def test_orchestrator_bounds_each_stage_attempt_with_timeout() -> None:
    repository = InMemoryNbaRepository([customer()])

    async def slow(item: CustomerSnapshot) -> StageOutput:
        await sleep(0.05)
        return StageOutput(customer=item)

    stage = RecordingStage("slow", slow)
    orchestrator = NbaOrchestrator(
        repository, [stage], max_attempts=2, stage_timeout_seconds=0.01
    )

    result = await orchestrator.run(
        NbaRunRequest(mode=RunMode.MINI, customer_ids=[101])
    )

    assert result.status == "failed"
    assert stage.calls == 2
    assert repository.recommendations == []
    assert result.stages[-1].reason == "TimeoutError"


@pytest.mark.asyncio
async def test_orchestrator_propagates_transformed_customer_between_stages() -> None:
    repository = InMemoryNbaRepository([customer()])
    observed_balances: list[float | None] = []

    async def transform(item: CustomerSnapshot) -> StageOutput:
        changed = item.model_copy(update={"metrics": {"balance": None}})
        return StageOutput(customer=changed)

    async def observe(item: CustomerSnapshot) -> StageOutput:
        observed_balances.append(item.metrics["balance"])
        return StageOutput(customer=item)

    stages = [RecordingStage("transform", transform), RecordingStage("observe", observe)]
    result = await NbaOrchestrator(repository, stages, max_attempts=2).run(
        NbaRunRequest(mode=RunMode.MINI, customer_ids=[101])
    )

    assert result.status == "completed"
    assert observed_balances == [None]
