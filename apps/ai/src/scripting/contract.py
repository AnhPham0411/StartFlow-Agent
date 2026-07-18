"""A5 — build_contract(): hàm DUY NHẤT dựng input cho domain agent (L3 CHỐT PII).

Output ScriptingContract KHÔNG chứa full_name, số tài khoản, nội dung CK thô.
Chỉ gồm: customer_ref (masking), tag khách, score, rule log, slot từ catalog.
"""

from __future__ import annotations

from src.models.contracts import Product, Profile, ScriptingContract, Slot

_FORBIDDEN_KEYS = {"full_name", "cif_code", "content", "counterparty", "dob", "address_raw"}


def mask_ref(cif_code: str) -> str:
    """customer_ref = 3 số cuối CIF (dashboard cũng chỉ hiển thị mức này ngoài trang chi tiết)."""
    digits = "".join(ch for ch in str(cif_code) if ch.isdigit())
    return f"KH-{digits[-3:]}" if digits else "KH-000"


def build_contract(
    profile: Profile,
    product: Product,
    score: float,
    rules_applied: list[str],
    slots: list[Slot],
    cif_code: str,
) -> ScriptingContract:
    tags = [t.tag for t in profile.tags]
    contract = ScriptingContract(
        customer_ref=mask_ref(cif_code),
        product=product,
        tags=tags,
        score=score,
        rules_applied=rules_applied,
        slots=slots,
    )
    _assert_no_pii(contract)
    return contract


def _assert_no_pii(contract: ScriptingContract) -> None:
    dumped = contract.model_dump()
    leaked = _FORBIDDEN_KEYS & set(dumped.keys())
    if leaked:
        raise ValueError(f"L3 vi phạm: contract chứa trường PII {leaked}")
    # slot value không được là chuỗi dài nghi là nội dung CK/tên
    for slot in contract.slots:
        if isinstance(slot.value, str) and len(slot.value) > 60:
            raise ValueError("L3 vi phạm: slot value quá dài, nghi chứa PII/nội dung thô")
