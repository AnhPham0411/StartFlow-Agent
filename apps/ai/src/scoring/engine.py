"""A2 scoring engine — propensity, KHÔNG LLM (D2).

score(khách, sp) = sigmoid(intercept + Σ wᵢ·chuẩn_hóa(xᵢ)).
- Chuẩn hóa dùng mean/std từ weights (L8).
- Feature thiếu (None) → impute mean (=0 sau chuẩn hóa) — "median+cờ missing" tối giản.
- Vectorized numpy để 1000×5 < 1s.
"""

from __future__ import annotations

import numpy as np

from src.models.contracts import PRODUCTS, Profile, Score
from src.scoring.loader import WeightSet, load_production_weights


def _feature_value(features: dict, key: str) -> float | None:
    value = features.get(key)
    if value is None:
        return None
    if isinstance(value, bool):
        return 1.0 if value else 0.0
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _score_one(features: dict, ws: WeightSet) -> float:
    z = ws.intercept
    for feat, w in ws.weights.items():
        raw = _feature_value(features, feat)
        stat = ws.stats.get(feat, {"mean": 0.0, "std": 1.0})
        mean, std = stat["mean"], (stat["std"] or 1.0)
        x = mean if raw is None else raw          # impute mean → chuẩn hóa = 0
        z += w * ((x - mean) / std)
    return float(1.0 / (1.0 + np.exp(-z)))


def score_all(profiles: list[Profile]) -> list[Score]:
    """Chấm toàn bộ khách × 5 sản phẩm."""
    weights = load_production_weights()
    out: list[Score] = []
    for profile in profiles:
        for product in PRODUCTS:
            ws = weights[product]
            out.append(
                Score(
                    customer_id=profile.customer_id,
                    product=product,
                    score=round(_score_one(profile.features, ws), 5),
                    weights_version=ws.version,
                )
            )
    return out
