from __future__ import annotations

from typing import Protocol

from src.nba.contracts import SanitizedCustomer, ScriptDraft


class ScriptingModel(Protocol):
    async def generate(self, customer: SanitizedCustomer, product: str) -> ScriptDraft: ...


class DeterministicDemoModel:
    async def generate(self, customer: SanitizedCustomer, product: str) -> ScriptDraft:
        del customer
        return ScriptDraft(
            product=product,
            hook="Giai phap dong tien linh hoat",
            reason="De xuat demo tu cac chi so da tong hop",
            call_to_action="Hen lich tu van",
        )

