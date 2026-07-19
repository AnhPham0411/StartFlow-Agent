from __future__ import annotations

from src.nba.contracts import CustomerSnapshot, StageOutput
from src.nba.stages.base import PipelineStage


class EtlStage(PipelineStage):
    """M1 demo-safe pass-through: Pydantic preserves NULL and numeric values exactly."""

    name = "m1_etl"

    async def execute(self, customer: CustomerSnapshot) -> StageOutput:
        return StageOutput(customer=customer.model_copy(deep=True))

