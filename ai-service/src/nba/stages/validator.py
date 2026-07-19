from __future__ import annotations

import re

from src.nba.contracts import ScriptDraft, ValidationResult
from src.nba.tools.calculators import NumericSlotRegistry

_NUMBER = re.compile(r"(?<![A-Za-z])\d+(?:[.,]\d+)?")
_EMAIL = re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.IGNORECASE)
_PHONE_OR_ACCOUNT = re.compile(r"(?<!\d)\d{9,16}(?!\d)")


class ScriptValidator:
    def validate(self, draft: ScriptDraft, slots: NumericSlotRegistry) -> ValidationResult:
        rendered = " ".join(
            (draft.product, draft.hook, draft.reason, draft.call_to_action)
        )
        errors: list[str] = []
        if _EMAIL.search(rendered) or _PHONE_OR_ACCOUNT.search(rendered):
            errors.append("pii_detected")
        for token in _NUMBER.findall(rendered):
            if not slots.owns(token.replace(",", ".")):
                errors.append("untraceable_numeric_token")
                break
        return ValidationResult(valid=not errors, error_codes=errors)

