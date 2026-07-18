"""A3 Ranker — 12 rule (BUILD_SPEC C2). Mỗi rule là 1 HÀM THUẦN (ctx) -> list[RuleHit].

L5: rule KHÔNG đọc customer_geo — geo không bao giờ vào ranker.
Thứ tự áp ở engine: hard block → multiplier → KPI → sort → Top 2.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from src.core.config import get_settings
from src.models.contracts import PRODUCTS, Product, RuleHit


@dataclass
class RankContext:
    customer_id: int
    features: dict                              # profile.features (KHÔNG có geo)
    base_scores: dict[Product, float]           # score A2 theo gói
    cic_group: int = 1                          # credit_bureau
    held: set[tuple[Product, str | None]] = field(default_factory=set)  # (product, tier)
    suppressed: set[Product | None] = field(default_factory=set)        # None = hoãn toàn khách
    last_contact_days: int | None = None        # ngày gần nhất tiếp cận
    locked: bool = False                        # đang bị sale khác lock
    kpi: dict[Product, float] = field(default_factory=dict)             # R12 multiplier
    catalog: dict[Product, dict] = field(default_factory=dict)          # min_balance, age_min/max, required
    required_cif: dict[Product, list[str]] = field(default_factory=dict)


def _all(products=PRODUCTS) -> list[Product]:
    return list(products)


# ── Hard block ───────────────────────────────────────────────────────────────
def r1_cic_bad(ctx: RankContext) -> list[RuleHit]:
    if ctx.cic_group >= 2:
        return [RuleHit(code="R1", product=p, block=True, reason="CIC nhóm 2+") for p in ("vay", "the")]
    return []


def r2_card_overdue(ctx: RankContext) -> list[RuleHit]:
    if ctx.features.get("card_overdue"):
        # xung đột kinh điển: nợ thẻ quá hạn → chặn tiết kiệm/đầu tư
        return [RuleHit(code="R2", product=p, block=True, reason="Nợ thẻ quá hạn") for p in ("dautu",)]
    return []


def r3_dti_high(ctx: RankContext) -> list[RuleHit]:
    dti = ctx.features.get("dti")
    if dti is not None and dti > 0.6:
        return [RuleHit(code="R3", product=p, block=True, reason="DTI > 60%") for p in ("vay", "the")]
    return []


def r4_already_held(ctx: RankContext) -> list[RuleHit]:
    held_products = {p for (p, _tier) in ctx.held}
    return [RuleHit(code="R4", product=p, block=True, reason="Đã có SP cùng hạng") for p in held_products]


def r5_suppressed(ctx: RankContext) -> list[RuleHit]:
    hits = []
    for p in ctx.suppressed:
        if p is not None:
            hits.append(RuleHit(code="R5", product=p, block=True, reason="Đã từ chối < 90 ngày"))
    return hits


def r6_contact_cooldown(ctx: RankContext) -> list[RuleHit]:
    s = get_settings()
    if ctx.last_contact_days is not None and ctx.last_contact_days < s.contact_cooldown_d:
        # hoãn toàn bộ khách
        return [RuleHit(code="R6", product=None, block=True, reason="Tiếp cận < 14 ngày")]
    return []


def r7_locked(ctx: RankContext) -> list[RuleHit]:
    if ctx.locked:
        return [RuleHit(code="R7", product=None, block=True, reason="Đang bị sale khác lock")]
    return []


def r8_missing_cif(ctx: RankContext) -> list[RuleHit]:
    hits = []
    for product, fields in ctx.required_cif.items():
        if any(ctx.features.get(f) in (None, "") for f in fields):
            hits.append(RuleHit(code="R8", product=product, block=True, reason="Thiếu trường CIF bắt buộc"))
    return hits


def r9_min_balance(ctx: RankContext) -> list[RuleHit]:
    casa = ctx.features.get("casa_avg")
    min_invest = ctx.catalog.get("dautu", {}).get("min_balance")
    if casa is not None and min_invest is not None and casa < float(min_invest):
        return [RuleHit(code="R9", product="dautu", block=True, reason="Số dư < ngưỡng đầu tư")]
    return []


def r10_age_range(ctx: RankContext) -> list[RuleHit]:
    age = ctx.features.get("age")
    if age is None:
        return []
    hits = []
    for product, cat in ctx.catalog.items():
        lo, hi = cat.get("age_min"), cat.get("age_max")
        if (lo is not None and age < lo) or (hi is not None and age > hi):
            hits.append(RuleHit(code="R10", product=product, block=True, reason="Tuổi ngoài dải SP"))
    return hits


# ── Multiplier ───────────────────────────────────────────────────────────────
def r11_has_insurance_elsewhere(ctx: RankContext) -> list[RuleHit]:
    if ctx.features.get("tag_dong_phi_bh"):
        return [RuleHit(code="R11", product="baohiem", multiplier=0.5, reason="Đã đóng phí BH nơi khác")]
    return []


def r12_kpi(ctx: RankContext) -> list[RuleHit]:
    hits = []
    for product, mult in ctx.kpi.items():
        if mult != 1.0:
            hits.append(RuleHit(code="R12", product=product, multiplier=float(mult), reason="Hệ số KPI tháng"))
    return hits


# Thứ tự cố định (audit tái lập).
HARD_BLOCK_RULES = [r1_cic_bad, r2_card_overdue, r3_dti_high, r4_already_held, r5_suppressed,
                    r6_contact_cooldown, r7_locked, r8_missing_cif, r9_min_balance, r10_age_range]
MULTIPLIER_RULES = [r11_has_insurance_elsewhere, r12_kpi]
