from __future__ import annotations

from asyncio import timeout
from collections.abc import Sequence
from datetime import UTC, datetime

from src.nba.contracts import (
    NbaRunRequest,
    NbaRunResult,
    RecommendationDraft,
    StageEvent,
)
from src.nba.repository import NbaRepository
from src.nba.stages.base import PipelineStage


class NbaOrchestrator:
    def __init__(
        self,
        repository: NbaRepository,
        stages: Sequence[PipelineStage],
        *,
        max_attempts: int = 2,
        stage_timeout_seconds: float = 30.0,
    ) -> None:
        if max_attempts != 2:
            raise ValueError("NBA contract requires exactly two total attempts")
        self._repository = repository
        self._stages = list(stages)
        self._max_attempts = max_attempts
        if stage_timeout_seconds <= 0:
            raise ValueError("stage timeout must be positive")
        self._stage_timeout_seconds = stage_timeout_seconds

    async def run(self, request: NbaRunRequest) -> NbaRunResult:
        run = NbaRunResult(
            run_id=request.run_id,
            correlation_id=request.correlation_id,
            mode=request.mode,
            status="running",
            business_date=request.business_date,
            customer_id=request.customer_id,
            idempotency_key=request.idempotency_key,
        )
        await self._repository.save_running(run)
        drafts: list[RecommendationDraft] = []
        try:
            customers = await self._repository.load_customers(request.customer_ids)
            missing = set(request.customer_ids) - {item.customer_id for item in customers}
            if missing:
                raise LookupError("one or more customers were not found")
            for customer in customers:
                current_customer = customer
                for stage in self._stages:
                    output = None
                    for attempt in range(1, self._max_attempts + 1):
                        try:
                            async with timeout(self._stage_timeout_seconds):
                                output = await stage.execute(current_customer)
                            run.stages.append(
                                StageEvent(
                                    stage=stage.name,
                                    status=output.status,
                                    attempt=attempt,
                                    customer_id=current_customer.customer_id,
                                    reason=output.reason,
                                )
                            )
                            break
                        except Exception as exc:
                            run.stages.append(
                                StageEvent(
                                    stage=stage.name,
                                    status="failed",
                                    attempt=attempt,
                                    customer_id=current_customer.customer_id,
                                    reason=type(exc).__name__,
                                )
                            )
                            if attempt == self._max_attempts:
                                raise
                    if output:
                        current_customer = output.customer
                    if output and output.recommendation:
                        drafts.append(output.recommendation)
            run.status = "completed"
            run.recommendation_count = len(drafts)
            run.finished_at = datetime.now(UTC)
            await self._repository.commit_success(run, drafts)
        except Exception:
            run.status = "failed"
            run.error_code = "stage_failed"
            run.finished_at = datetime.now(UTC)
            await self._repository.save_failure(run)
        return run
