from __future__ import annotations

import pytest

from src.nba.contracts import CustomerSnapshot, ScriptDraft
from src.nba.safety import sanitize_for_model
from src.nba.stages.validator import ScriptValidator
from src.nba.tools.calculators import NumericSlotRegistry, percentage


def test_model_boundary_drops_raw_customer_pii() -> None:
    raw = CustomerSnapshot(
        customer_id=501,
        branch_id=3,
        assigned_user_id=11,
        full_name="Tran Thi Bi Mat",
        account_number="123456789012",
        raw_transaction_narratives=["Thanh toan demo@example.com 0901234567"],
        metrics={"monthly_income": 20_000_000.0},
        tags=["salary-income"],
    )

    payload = sanitize_for_model(raw).model_dump(mode="json")
    rendered = str(payload)

    assert "Tran Thi Bi Mat" not in rendered
    assert "123456789012" not in rendered
    assert "demo@example.com" not in rendered
    assert "0901234567" not in rendered
    assert payload["customer_id"] == 501
    assert payload["metrics"]["monthly_income"] == 20_000_000.0


def test_validator_rejects_numeric_claim_without_tool_slot() -> None:
    validator = ScriptValidator()
    draft = ScriptDraft(
        product="CASA",
        hook="Tang loi ich 25%",
        reason="Phu hop voi dong tien",
        call_to_action="Hen tu van",
    )

    result = validator.validate(draft, NumericSlotRegistry())

    assert not result.valid
    assert "untraceable_numeric_token" in result.error_codes


def test_validator_accepts_number_owned_by_calculator_slot() -> None:
    slots = NumericSlotRegistry()
    value = percentage(1, 4, slots, "usage_ratio")
    draft = ScriptDraft(
        product="CASA",
        hook=f"Ty le su dung {value}%",
        reason="Duoc tinh tu du lieu tong hop",
        call_to_action="Hen tu van",
    )

    result = ScriptValidator().validate(draft, slots)

    assert result.valid
    assert slots.as_dict() == {"usage_ratio": "25"}


def test_percentage_rejects_zero_denominator() -> None:
    with pytest.raises(ValueError, match="denominator"):
        percentage(1, 0, NumericSlotRegistry(), "invalid")

