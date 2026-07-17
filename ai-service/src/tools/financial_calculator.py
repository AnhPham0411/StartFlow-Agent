from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from src.models.contracts import FinancialSnapshot


def _ratio(numerator: float, denominator: float) -> float | None:
    if denominator == 0:
        return None
    value = Decimal(str(numerator)) / Decimal(str(denominator))
    return float(value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def calculate_financial_metrics(
    financials: FinancialSnapshot,
    requested_amount: float,
) -> dict[str, Any]:
    """Calculate deterministic ratios; it does not call or emulate an external system."""
    ratios = {
        "ebitdaMargin": _ratio(financials.ebitda, financials.revenue),
        "debtToEbitda": _ratio(financials.total_debt, financials.ebitda),
        "debtToEquity": _ratio(financials.total_debt, financials.equity),
        "currentRatio": _ratio(financials.current_assets, financials.current_liabilities),
        "requestedAmountToRevenue": _ratio(requested_amount, financials.revenue),
    }
    hard_risk = financials.ebitda <= 0 or (
        ratios["currentRatio"] is not None and ratios["currentRatio"] < 0.8
    )
    elevated_risk = (
        ratios["debtToEbitda"] is None
        or ratios["debtToEbitda"] > 4
        or (ratios["debtToEquity"] is not None and ratios["debtToEquity"] > 3)
    )
    risk_band = "HIGH" if hard_risk else "MEDIUM" if elevated_risk else "LOW"
    return {"ratios": ratios, "riskBand": risk_band, "calculationVersion": "demo-v1"}
