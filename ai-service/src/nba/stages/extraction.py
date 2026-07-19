from __future__ import annotations

from src.nba.contracts import CustomerSnapshot, StageOutput
from src.nba.stages.base import PipelineStage


class ExtractionStage(PipelineStage):
    """AG1 placeholder. Raw narratives stay local and are never logged or forwarded."""

    name = "ag1_extraction"

    async def execute(self, customer: CustomerSnapshot) -> StageOutput:
        return StageOutput(
            customer=customer, status="skipped", reason="local_model_not_configured"
        )

