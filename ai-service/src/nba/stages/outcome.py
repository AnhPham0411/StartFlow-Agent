from __future__ import annotations

from src.nba.contracts import CustomerSnapshot, StageOutput
from src.nba.stages.base import PipelineStage


class OutcomeStage(PipelineStage):
    name = "m11_outcome"

    async def execute(self, customer: CustomerSnapshot) -> StageOutput:
        return StageOutput(
            customer=customer, status="skipped", reason="product_open_events_not_configured"
        )

