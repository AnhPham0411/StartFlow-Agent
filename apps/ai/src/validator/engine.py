"""A6 Validator engine — chain V1 → V2 → V3.

V1: regex nhóm cấm (patterns.py).
V2: đối chiếu số — mọi con số trong hook phải khớp slots_used (→ catalog).
V3: BH/đầu tư — similarity với template duyệt sẵn < ngưỡng → reject.
Reject → regenerate tối đa MAX_REGEN → fallback template (điền slot, không LLM).
Mọi reject trả về ValidationReject để orchestrator ghi validator_log.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from difflib import SequenceMatcher

from src.core.config import get_settings
from src.models.contracts import ScriptResult, Slot
from src.validator.patterns import PATTERN_GROUPS, SO_LIEU

_NUM = re.compile(r"\d[\d.,]*")

# Template duyệt sẵn cho BH/đầu tư (V3). Khung — thay bằng bộ compliance duyệt.
APPROVED_TEMPLATES = {
    "baohiem": "Gói bảo hiểm phù hợp giúp anh chị bảo vệ tài chính gia đình với quyền lợi rõ ràng.",
    "dautu": "Sản phẩm đầu tư kỳ hạn linh hoạt giúp anh chị tối ưu dòng tiền nhàn rỗi.",
}


@dataclass
class ValidationReject:
    pattern_group: str
    reason: str
    draft_hook: str = ""     # bản bị chặn — ghi validator_log


def _numbers(text: str) -> list[str]:
    return [n.strip(".,") for n in _NUM.findall(text)]


def _slot_numbers(slots: list[Slot]) -> set[str]:
    out: set[str] = set()
    for slot in slots:
        for n in _NUM.findall(str(slot.value)):
            out.add(n.strip(".,"))
    return out


def check(hook: str, slots_used: list[Slot], product: str) -> ValidationReject | None:
    """Chạy V1→V2→V3. Trả None nếu hợp lệ, else ValidationReject."""
    # V1 — pattern cấm
    for group, pattern in PATTERN_GROUPS.items():
        if pattern.search(hook):
            return ValidationReject(group, f"V1 khớp nhóm cấm '{group}'")

    # V2 — số trong hook phải nằm trong slots_used
    if SO_LIEU.search(hook):
        allowed = _slot_numbers(slots_used)
        for token in _numbers(hook):
            if token and token not in allowed:
                return ValidationReject("so_lieu", f"V2 số '{token}' không có trong slots_used")

    # V3 — BH/đầu tư đối chiếu template
    if product in APPROVED_TEMPLATES:
        s = get_settings()
        sim = SequenceMatcher(None, hook.lower(), APPROVED_TEMPLATES[product].lower()).ratio()
        if sim < s.template_sim_min:
            return ValidationReject("template", f"V3 similarity {sim:.2f} < {s.template_sim_min}")
    return None


async def enforce(generate, product: str, slots: list[Slot]):
    """Sinh (async) → validate, regen tối đa MAX_REGEN, cuối cùng fallback template.

    generate(attempt:int) -> awaitable[ScriptResult]. Trả (ScriptResult, list[ValidationReject]).
    """
    s = get_settings()
    rejects: list[ValidationReject] = []
    for attempt in range(1, s.max_regen + 2):  # MAX_REGEN regen + 1 lần đầu
        result = await generate(attempt)
        reject = check(result.hook, result.slots_used or slots, product)
        if reject is None:
            return result, rejects
        reject.draft_hook = result.hook
        rejects.append(reject)
    # Fallback template — điền slot, không LLM.
    fallback = ScriptResult(
        hook=APPROVED_TEMPLATES.get(product, "Đề xuất sản phẩm phù hợp với nhu cầu hiện tại."),
        explain="Bản chuẩn hóa theo template được duyệt.",
        slots_used=slots,
    )
    return fallback, rejects
