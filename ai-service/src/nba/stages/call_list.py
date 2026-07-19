from __future__ import annotations

from src.nba.contracts import CustomerSnapshot, StageOutput
from src.nba.stages.base import PipelineStage


class CallListStage(PipelineStage):
    name = "m6_call_list"

    async def execute(self, customer: CustomerSnapshot) -> StageOutput:
        return StageOutput(
            customer=customer, status="skipped", reason="ranking_not_available"
        )

