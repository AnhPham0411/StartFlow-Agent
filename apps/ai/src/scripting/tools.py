"""A5 tools — code thuần, có test số (không LLM). Nguồn slot filling = product_catalog.

Slot là số liệu DUY NHẤT được phép xuất hiện trong hook (validator V2 đối chiếu).
"""

from __future__ import annotations

from src.models.contracts import Product, Slot


def catalog_lookup(product: Product, catalog_row: dict) -> list[Slot]:
    """Đổi 1 dòng product_catalog thành slots dùng được cho scripting."""
    slots: list[Slot] = []
    mapping = {
        "package": "ten_goi",
        "rate": "lai_suat",
        "fee": "phi",
        "limit_min": "han_muc_min",
        "limit_max": "han_muc_max",
        "min_balance": "so_du_toi_thieu",
    }
    for col, key in mapping.items():
        value = catalog_row.get(col)
        if value is not None:
            slots.append(Slot(key=key, value=value))
    return slots


def loan_calculator(principal: float, annual_rate_pct: float, months: int) -> Slot:
    """Trả tiền trả hàng tháng (annuity). Có thể unit-test giá trị cố định."""
    r = annual_rate_pct / 100 / 12
    if r == 0:
        monthly = principal / months
    else:
        monthly = principal * r * (1 + r) ** months / ((1 + r) ** months - 1)
    return Slot(key="tra_hang_thang", value=round(monthly, 0))


def interest_calculator(amount: float, annual_rate_pct: float, months: int) -> Slot:
    interest = amount * (annual_rate_pct / 100) * (months / 12)
    return Slot(key="lai_du_kien", value=round(interest, 0))


def fee_calculator(amount: float, fee_pct: float) -> Slot:
    return Slot(key="phi_du_kien", value=round(amount * fee_pct / 100, 0))


def tier_checker(casa_avg: float, tiers: list[dict]) -> Slot:
    """Chọn hạng cao nhất mà số dư đạt. tiers=[{tier, min_balance}]."""
    eligible = [t for t in tiers if casa_avg >= float(t.get("min_balance", 0))]
    best = max(eligible, key=lambda t: float(t.get("min_balance", 0)), default=None)
    return Slot(key="hang_du_dieu_kien", value=best["tier"] if best else "co_ban")
