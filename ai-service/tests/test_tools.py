from src.tools.document_checklist import check_documents
from src.tools.financial_calculator import calculate_financial_metrics
from src.tools.mock_kyc_aml import run_mock_kyc_aml


def test_financial_calculator_is_deterministic(case_input) -> None:
    first = calculate_financial_metrics(case_input.financials, case_input.requested_amount)
    second = calculate_financial_metrics(case_input.financials, case_input.requested_amount)
    assert first == second
    assert first["riskBand"] == "LOW"
    assert first["ratios"]["debtToEbitda"] == 1.5


def test_mock_kyc_aml_is_explicit_and_can_hard_stop() -> None:
    result = run_mock_kyc_aml("Công ty Demo", "DEMO-BLOCK-01")
    assert result["isMock"] is True
    assert result["source"] == "STARTFLOW_DEMO_RULESET_V1"
    assert result["hardStop"] is True


def test_document_checklist_lists_missing_documents() -> None:
    result = check_documents(["financial statements"])
    assert result["complete"] is False
    assert "financial statements" in result["present"]
    assert "tax returns" in result["missing"]
