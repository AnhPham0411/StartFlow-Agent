from __future__ import annotations

from src.nba.contracts import CustomerSnapshot, StageOutput
from src.nba.stages.base import PipelineStage


class RankerStage(PipelineStage):
    name = "m5_ranker"

    async def execute(self, customer: CustomerSnapshot) -> StageOutput:
        return StageOutput(
            customer=customer, status="skipped", reason="r1_r12_not_configured"
        )

