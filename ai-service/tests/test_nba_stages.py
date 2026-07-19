from __future__ import annotations

import pytest

from src.nba.contracts import CustomerSnapshot, SanitizedCustomer, ScriptDraft
from src.nba.stages.etl import EtlStage
from src.nba.stages.geo import GeoStage
from src.nba.stages.scripting import ScriptingStage


class InvalidScriptingModel:
    def __init__(self) -> None:
        self.calls = 0
        self.payloads: list[SanitizedCustomer] = []

    async def generate(self, customer: SanitizedCustomer, product: str) -> ScriptDraft:
        self.calls += 1
        self.payloads.append(customer)
        return ScriptDraft(
            product=product,
            hook="Uu dai 99%",
            reason="Khong co calculator slot",
            call_to_action="Hen tu van",
        )


@pytest.mark.asyncio
async def test_scripting_uses_bounded_regeneration_then_deterministic_fallback() -> None:
    model = InvalidScriptingModel()
    customer = CustomerSnapshot(
        customer_id=9,
        full_name="PII Name",
        account_number="123456789012",
        raw_transaction_narratives=["private"],
        metrics={"balance": 1_000_000.0},
    )

    output = await ScriptingStage(model).execute(customer)

    assert model.calls == 2
    assert output.recommendation is not None
    assert "deterministic_fallback" in output.recommendation.rules_applied
    assert all(not hasattr(payload, "full_name") for payload in model.payloads)


@pytest.mark.asyncio
async def test_etl_is_bit_identical_and_preserves_nulls() -> None:
    customer = CustomerSnapshot(
        customer_id=7,
        metrics={"balance": None, "income": 12_345.67},
    )
    stage = EtlStage()

    first = await stage.execute(customer)
    second = await stage.execute(customer)

    assert first.model_dump(mode="json") == second.model_dump(mode="json")
    assert first.customer.metrics["balance"] is None


@pytest.mark.asyncio
async def test_geo_below_threshold_does_not_infer_location() -> None:
    output = await GeoStage(0.8).execute(
        CustomerSnapshot(customer_id=5, geo_code="HCM", geo_confidence=0.79)
    )

    assert output.status == "skipped"
    assert output.customer.geo_code is None
    assert output.reason == "geo_below_confidence_threshold"

