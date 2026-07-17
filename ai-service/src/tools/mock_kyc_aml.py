from __future__ import annotations

import hashlib
from typing import Any


def run_mock_kyc_aml(company_name: str, registration_number: str) -> dict[str, Any]:
    """Run a transparent demo ruleset; the result never claims a production KYC/AML lookup."""
    normalized_name = company_name.casefold()
    normalized_registration = registration_number.upper()
    explicit_block = "DEMO-BLOCK" in normalized_registration or "demo blocked" in normalized_name
    explicit_review = "DEMO-REVIEW" in normalized_registration or "demo review" in normalized_name
    reference = hashlib.sha256(f"{normalized_registration}:{normalized_name}".encode()).hexdigest()[
        :12
    ]
    if explicit_block:
        status, hard_stop, reasons = "BLOCKED", True, ["DEMO_SANCTIONS_MATCH"]
    elif explicit_review:
        status, hard_stop, reasons = "REVIEW", False, ["DEMO_BENEFICIAL_OWNER_REVIEW"]
    else:
        status, hard_stop, reasons = "CLEAR", False, []
    return {
        "status": status,
        "hardStop": hard_stop,
        "reasonCodes": reasons,
        "isMock": True,
        "source": "STARTFLOW_DEMO_RULESET_V1",
        "reference": f"demo-{reference}",
    }
