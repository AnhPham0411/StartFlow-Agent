"""A2 loader — nạp trọng số propensity.

L8: chỉ load weights `is_production=true`; mean/std đọc từ file weights, KHÔNG tính lại.
Ưu tiên nạp từ `src/scoring/weights/weights_{product}_v{n}.json`. Nếu chưa có file
(giai đoạn khung), dùng DEFAULT_WEIGHTS builtin để engine vẫn chạy — sẽ thay bằng
weights train thật ở B6.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

from src.models.contracts import PRODUCTS, Product

_WEIGHTS_DIR = Path(__file__).resolve().parent / "weights"


@dataclass(frozen=True)
class WeightSet:
    product: Product
    version: str
    intercept: float
    weights: dict[str, float]           # feature -> hệ số
    stats: dict[str, dict[str, float]]  # feature -> {mean, std}


# Bộ mặc định tối giản (khung) — mỗi gói vài feature có ý nghĩa nghiệp vụ.
DEFAULT_WEIGHTS: dict[Product, WeightSet] = {
    "baohiem": WeightSet(
        "baohiem", "v0-default", -2.91,
        {"cif_married": 0.52, "age_trucot": 0.48, "tag_hocphi": 0.46,
         "tag_dong_phi_bh": -0.38, "has_mortgage": 0.29},
        {"cif_married": {"mean": 0.5, "std": 0.5}, "age_trucot": {"mean": 0.3, "std": 0.46},
         "tag_hocphi": {"mean": 0.12, "std": 0.32}, "tag_dong_phi_bh": {"mean": 0.09, "std": 0.29},
         "has_mortgage": {"mean": 0.15, "std": 0.36}},
    ),
    "vay": WeightSet(
        "vay", "v0-default", -2.2,
        {"dti": -1.1, "biz_cashflow": 0.7, "tag_thu_kinh_doanh": 0.6, "salary_regular": 0.4},
        {"dti": {"mean": 0.35, "std": 0.2}, "biz_cashflow": {"mean": 0.06, "std": 0.24},
         "tag_thu_kinh_doanh": {"mean": 0.06, "std": 0.24}, "salary_regular": {"mean": 0.55, "std": 0.5}},
    ),
    "dautu": WeightSet(
        "dautu", "v0-default", -2.5,
        {"casa_avg_log": 0.6, "tag_thu_cho_thue": 0.5, "salary_regular": 0.3},
        {"casa_avg_log": {"mean": 16.0, "std": 2.0}, "tag_thu_cho_thue": {"mean": 0.05, "std": 0.22},
         "salary_regular": {"mean": 0.55, "std": 0.5}},
    ),
    "the": WeightSet(
        "the", "v0-default", -1.8,
        {"txn_per_month": 0.5, "tag_dining": 0.3, "tag_travel": 0.3, "salary_regular": 0.3},
        {"txn_per_month": {"mean": 20.0, "std": 12.0}, "tag_dining": {"mean": 0.2, "std": 0.4},
         "tag_travel": {"mean": 0.1, "std": 0.3}, "salary_regular": {"mean": 0.55, "std": 0.5}},
    ),
    "taikhoan": WeightSet(
        "taikhoan", "v0-default", -1.5,
        {"biz_cashflow": 0.6, "txn_per_month": 0.4, "tag_thu_kinh_doanh": 0.4},
        {"biz_cashflow": {"mean": 0.06, "std": 0.24}, "txn_per_month": {"mean": 20.0, "std": 12.0},
         "tag_thu_kinh_doanh": {"mean": 0.06, "std": 0.24}},
    ),
}


def _load_file(product: Product) -> WeightSet | None:
    if not _WEIGHTS_DIR.exists():
        return None
    candidates = sorted(_WEIGHTS_DIR.glob(f"weights_{product}_v*.json"))
    for path in reversed(candidates):  # version cao nhất trước
        data = json.loads(path.read_text(encoding="utf-8"))
        if not data.get("is_production", True):
            continue
        return WeightSet(
            product=product,
            version=data.get("version", path.stem),
            intercept=float(data["intercept"]),
            weights={k: float(v) for k, v in data["weights"].items()},
            stats={k: {"mean": float(v["mean"]), "std": float(v["std"])}
                   for k, v in data.get("stats", {}).items()},
        )
    return None


def load_production_weights() -> dict[Product, WeightSet]:
    """Trả weights production cho từng gói (file nếu có, else default builtin)."""
    result: dict[Product, WeightSet] = {}
    for product in PRODUCTS:
        result[product] = _load_file(product) or DEFAULT_WEIGHTS[product]
    return result
