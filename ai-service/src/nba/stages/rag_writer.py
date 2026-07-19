from __future__ import annotations

from src.nba.contracts import CustomerSnapshot, StageOutput
from src.nba.stages.base import PipelineStage


class RagWriterStage(PipelineStage):
    name = "m13_rag_writer"

    async def execute(self, customer: CustomerSnapshot) -> StageOutput:
        return StageOutput(
            customer=customer, status="skipped", reason="outcome_not_available"
        )

