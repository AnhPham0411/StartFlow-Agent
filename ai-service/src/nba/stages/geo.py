from __future__ import annotations

from src.nba.contracts import CustomerSnapshot, StageOutput
from src.nba.stages.base import PipelineStage


class GeoStage(PipelineStage):
    name = "m2_geo"

    def __init__(self, confidence_threshold: float) -> None:
        self._confidence_threshold = confidence_threshold

    async def execute(self, customer: CustomerSnapshot) -> StageOutput:
        confidence = customer.geo_confidence
        if customer.geo_code is None or confidence is None:
            return StageOutput(
                customer=customer, status="skipped", reason="geo_not_configured"
            )
        if confidence < self._confidence_threshold:
            clean = customer.model_copy(update={"geo_code": None})
            return StageOutput(
                customer=clean, status="skipped", reason="geo_below_confidence_threshold"
            )
        return StageOutput(customer=customer)

