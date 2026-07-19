from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal


class NumericSlotRegistry:
    def __init__(self) -> None:
        self._slots: dict[str, str] = {}

    def register(self, name: str, value: Decimal) -> str:
        rendered = format(value.normalize(), "f")
        self._slots[name] = rendered
        return rendered

    def owns(self, rendered_number: str) -> bool:
        normalized = format(Decimal(rendered_number).normalize(), "f")
        return normalized in self._slots.values()

    def as_dict(self) -> dict[str, str]:
        return dict(self._slots)


def percentage(
    numerator: int | float | Decimal,
    denominator: int | float | Decimal,
    slots: NumericSlotRegistry,
    slot_name: str,
) -> str:
    denominator_value = Decimal(str(denominator))
    if denominator_value == 0:
        raise ValueError("denominator must be non-zero")
    result = (Decimal(str(numerator)) / denominator_value * 100).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )
    return slots.register(slot_name, result)

