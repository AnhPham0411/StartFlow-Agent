from __future__ import annotations

from src.nba.contracts import CustomerSnapshot, StageOutput
from src.nba.stages.base import PipelineStage


class ScoringStage(PipelineStage):
    name = "m4_scoring"

    async def execute(self, customer: CustomerSnapshot) -> StageOutput:
        return StageOutput(
            customer=customer,
            status="skipped",
            reason="production_weights_not_configured",
        )

