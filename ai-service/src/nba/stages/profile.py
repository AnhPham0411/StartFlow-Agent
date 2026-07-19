from __future__ import annotations

from src.nba.contracts import CustomerSnapshot, StageOutput
from src.nba.stages.base import PipelineStage


class ProfileStage(PipelineStage):
    name = "m3_profile"

    async def execute(self, customer: CustomerSnapshot) -> StageOutput:
        return StageOutput(customer=customer.model_copy(deep=True))

