from __future__ import annotations

import hashlib
import json

from src.nba.clients.local_llm import ScriptingModel
from src.nba.contracts import CustomerSnapshot, RecommendationDraft, ScriptDraft, StageOutput
from src.nba.safety import sanitize_for_model
from src.nba.stages.base import PipelineStage
from src.nba.stages.validator import ScriptValidator
from src.nba.tools.calculators import NumericSlotRegistry


class ScriptingStage(PipelineStage):
    name = "ag2_ag6_scripting_m7"

    def __init__(self, model: ScriptingModel) -> None:
        self._model = model
        self._validator = ScriptValidator()

    async def execute(self, customer: CustomerSnapshot) -> StageOutput:
        sanitized = sanitize_for_model(customer)
        draft = None
        used_fallback = False
        for _ in range(2):
            candidate = await self._model.generate(sanitized, "CASA")
            validation = self._validator.validate(candidate, NumericSlotRegistry())
            if validation.valid:
                draft = candidate
                break
        if draft is None:
            used_fallback = True
            draft = ScriptDraft(
                product="CASA",
                hook="Giai phap dong tien phu hop",
                reason="De xuat an toan tu du lieu tong hop",
                call_to_action="Hen lich tu van",
            )
        payload = json.dumps(sanitized.model_dump(mode="json"), sort_keys=True)
        snapshot_hash = hashlib.sha256(payload.encode()).hexdigest()
        return StageOutput(
            customer=customer,
            recommendation=RecommendationDraft(
                **draft.model_dump(),
                customer_id=customer.customer_id,
                snapshot_hash=snapshot_hash,
                rules_applied=[
                    "deterministic_fallback"
                    if used_fallback
                    else "demo_safe_no_production_rules"
                ],
            ),
        )
