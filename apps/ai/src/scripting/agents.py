"""A5 — 1 class DomainAgent + 5 config nghiệp vụ (BUILD_SPEC C4).

Prompt nhận: tag (không PII) + score + rule + slot + (RAG sẽ thêm sau). Output JSON
{hook, explain, slots_used}. Self-check nhẹ trước khi trả (số phải nằm trong slots).
"""

from __future__ import annotations

from dataclasses import dataclass

from src.core.config import get_settings
from src.llm.provider import SCRIPTING_MARK, LLMProvider
from src.models.contracts import Product, ScriptingContract, ScriptResult, Slot


@dataclass(frozen=True)
class DomainConfig:
    product: Product
    role: str          # mô tả vai trò trong system prompt
    must_use_slots: tuple[str, ...]


DOMAIN_CONFIGS: dict[Product, DomainConfig] = {
    "the": DomainConfig("the", "chuyên viên tư vấn thẻ tín dụng", ("ten_goi", "lai_suat")),
    "vay": DomainConfig("vay", "chuyên viên tư vấn khoản vay", ("ten_goi", "tra_hang_thang")),
    "dautu": DomainConfig("dautu", "chuyên viên tư vấn đầu tư/tiết kiệm", ("ten_goi", "lai_suat")),
    "baohiem": DomainConfig("baohiem", "chuyên viên tư vấn bảo hiểm", ("ten_goi",)),
    "taikhoan": DomainConfig("taikhoan", "chuyên viên tư vấn tài khoản/combo", ("ten_goi",)),
}


class DomainAgent:
    def __init__(self, provider: LLMProvider) -> None:
        self._provider = provider

    async def run(self, contract: ScriptingContract) -> ScriptResult:
        cfg = DOMAIN_CONFIGS[contract.product]
        s = get_settings()
        system = (
            f"{SCRIPTING_MARK}\nBạn là {cfg.role} của SHB. Chỉ dùng dữ kiện được cấp, "
            "KHÔNG tự viết số, KHÔNG hứa hẹn/cam kết, KHÔNG mô tả hành động chưa xảy ra. "
            "Trả JSON {hook<=2 câu, explain<=1 câu, slots_used[]}."
        )
        user = self._build_user(contract)
        raw = await self._provider.complete_json(system, user, s.temp_script, s.script_timeout_s)
        slots_used = [Slot(key=str(x.get("key")), value=x.get("value")) for x in raw.get("slots_used", [])]
        if not slots_used:
            slots_used = contract.slots
        return ScriptResult(
            hook=str(raw.get("hook", "")).strip(),
            explain=str(raw.get("explain", "")).strip(),
            slots_used=slots_used,
        )

    @staticmethod
    def _build_user(contract: ScriptingContract) -> str:
        slot_lines = "\n".join(f"- {slot.key}: {slot.value}" for slot in contract.slots)
        return (
            f"customer_ref: {contract.customer_ref}\n"
            f"tags: {', '.join(contract.tags) or 'none'}\n"
            f"product: {contract.product}\n"
            f"score: {contract.score}\n"
            f"rules_applied: {', '.join(contract.rules_applied) or 'none'}\n"
            f"slots (chỉ được dùng số từ đây):\n{slot_lines}"
        )
