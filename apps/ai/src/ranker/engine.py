"""A3 Ranker engine — áp rule theo thứ tự: hard block → multiplier → KPI → sort → Top N.

Mọi rule kích hoạt được ghi vào rules_applied (audit + explainability, G4).
0 gói qua ranker → RankResult.ranked rỗng (không sinh recommendation).
"""

from __future__ import annotations

from src.core.config import get_settings
from src.models.contracts import PRODUCTS, Product, RankedProduct, RankResult
from src.ranker.rules import HARD_BLOCK_RULES, MULTIPLIER_RULES, RankContext


def rank(ctx: RankContext) -> RankResult:
    s = get_settings()
    rules_applied: list[str] = []
    blocked: set[Product] = set()
    block_all = False
    multipliers: dict[Product, float] = {p: 1.0 for p in PRODUCTS}

    for rule in HARD_BLOCK_RULES:
        for hit in rule(ctx):
            rules_applied.append(hit.code)
            if hit.product is None:
                block_all = True
            else:
                blocked.add(hit.product)

    for rule in MULTIPLIER_RULES:
        for hit in rule(ctx):
            rules_applied.append(hit.code)
            if hit.product is not None:
                multipliers[hit.product] *= hit.multiplier

    if block_all:
        return RankResult(customer_id=ctx.customer_id, ranked=[], rules_applied=_dedup(rules_applied))

    candidates: list[RankedProduct] = []
    for product in PRODUCTS:
        if product in blocked:
            continue
        base = ctx.base_scores.get(product, 0.0)
        final = base * multipliers[product]
        applied = [c for c in _dedup(rules_applied) if _affects(c, product, ctx)]
        candidates.append(
            RankedProduct(product=product, base_score=base, final_score=round(final, 5), rules_applied=applied)
        )

    candidates.sort(key=lambda r: r.final_score, reverse=True)
    top = candidates[: s.top_n]
    return RankResult(customer_id=ctx.customer_id, ranked=top, rules_applied=_dedup(rules_applied))


def _dedup(codes: list[str]) -> list[str]:
    seen: dict[str, None] = {}
    for c in codes:
        seen.setdefault(c, None)
    return list(seen.keys())


def _affects(code: str, product: Product, ctx: RankContext) -> bool:
    """R11/R12 gắn theo gói cụ thể; các rule chung để ở cấp khách."""
    if code == "R11":
        return product == "baohiem"
    if code == "R12":
        return ctx.kpi.get(product, 1.0) != 1.0
    return False
