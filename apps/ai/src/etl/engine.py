"""A1 ETL — compute_features (deterministic, tái lập tuyệt đối).

L1: CẤM mọi lời gọi LLM trong module này.
NULL ≠ 0: thiếu dữ liệu để None (scoring impute median + cờ missing), không quy 0.
Feature theo BUILD_SPEC C3.
"""

from __future__ import annotations

import math
from collections import Counter
from datetime import date, timedelta

from src.core.config import get_settings


def _months_span(days: int) -> float:
    return max(days / 30.0, 1.0)


def compute_features(
    customer: dict,
    accounts: list[dict],
    loans: list[dict],
    transactions: list[dict],
    customer_tags: list[dict],
    as_of: date,
) -> dict[str, float | int | bool | None]:
    """Trả feature cứng cho 1 khách tại `as_of`. Input là bản ghi thô từ DB.

    - customer: {dob, cif_married, cif_occupation_risk, monthly_income, ...}
    - accounts: [{acct_type, balance}]
    - loans: [{outstanding, monthly_payment, is_overdue, is_mortgage}]
    - transactions: [{ts(date|datetime), amount, direction, counterparty, content}]
    - customer_tags: [{tag}]
    """
    s = get_settings()
    window_start = as_of - timedelta(days=s.tag_window_d)

    # E1 age (từ dob, không lưu tĩnh)
    dob = customer.get("dob")
    age = _age(dob, as_of) if dob else None

    # E2 dti = tổng monthly_payment / monthly_income
    income = _num(customer.get("monthly_income"))
    total_payment = sum(_num(loan.get("monthly_payment")) for loan in loans)
    dti = (total_payment / income) if income and income > 0 else None

    # E3 casa_avg (log) — trung bình số dư casa
    casa_balances = [_num(a.get("balance")) for a in accounts if a.get("acct_type") == "casa"]
    casa_avg = (sum(casa_balances) / len(casa_balances)) if casa_balances else None
    casa_avg_log = math.log1p(casa_avg) if casa_avg is not None else None

    # E4 casa_trend_3m — xu hướng dòng tiền vào 3 tháng (proxy: net inflow gần đây)
    txns_window = [t for t in transactions if _to_date(t.get("ts")) >= window_start]
    inflow = sum(_num(t.get("amount")) for t in txns_window if t.get("direction") == "in")
    outflow = sum(_num(t.get("amount")) for t in txns_window if t.get("direction") == "out")
    casa_trend_3m = round(inflow - outflow, 2) if txns_window else None

    # E5 salary_regular — có chuỗi CK vào định kỳ ~30 ngày ("LUONG")
    salary_regular = _has_periodic(txns_window, keyword="LUONG")

    # E6 has_loan / E7 has_card (has_card suy từ customer_products ở tầng gọi; ở đây từ loans)
    has_loan = len(loans) > 0

    # E8 txn_per_month
    txn_per_month = round(len(txns_window) / _months_span(s.tag_window_d), 2)

    # E9 days_since_big_txn — giao dịch lớn gần nhất
    big = [t for t in txns_window if _num(t.get("amount")) >= s.big_event_vnd]
    days_since_big_txn = (
        min((as_of - _to_date(t.get("ts"))).days for t in big) if big else None
    )

    # E10 dòng tiền kinh doanh (BIZ_INFLOW_MIN lần/tháng, BIZ_PARTNER_MIN đối tác)
    in_txns = [t for t in txns_window if t.get("direction") == "in"]
    inflow_per_month = len(in_txns) / _months_span(s.tag_window_d)
    partners = {(_norm(t.get("counterparty"))) for t in in_txns if t.get("counterparty")}
    biz_cashflow = inflow_per_month >= s.biz_inflow_min and len(partners) >= s.biz_partner_min

    features: dict[str, float | int | bool | None] = {
        "age": age,
        "dti": _round(dti, 4),
        "casa_avg": _round(casa_avg, 2),
        "casa_avg_log": _round(casa_avg_log, 4),
        "casa_trend_3m": casa_trend_3m,
        "salary_regular": salary_regular,
        "has_loan": has_loan,
        "txn_per_month": txn_per_month,
        "days_since_big_txn": days_since_big_txn,
        "biz_cashflow": biz_cashflow,
        # feature bảo hiểm (bộ vá v2)
        "cif_married": customer.get("cif_married"),
        "cif_occupation_risk": customer.get("cif_occupation_risk"),
        "has_mortgage": any(bool(loan.get("is_mortgage")) for loan in loans),
        "age_trucot": (age is not None and 30 <= age <= 47),
        "card_overdue": any(bool(loan.get("is_overdue")) for loan in loans),
    }
    # tag features (binary mức khách)
    held = {t["tag"] for t in customer_tags}
    for tag in held:
        features[tag] = True
    return features


# ── helpers ─────────────────────────────────────────────────────────────────
def _age(dob, as_of: date) -> int:
    d = _to_date(dob)
    return as_of.year - d.year - ((as_of.month, as_of.day) < (d.month, d.day))


def _to_date(value) -> date:
    if isinstance(value, date):
        return value
    if hasattr(value, "date"):
        return value.date()
    return date.fromisoformat(str(value)[:10])


def _num(value) -> float:
    try:
        return float(value) if value is not None else 0.0
    except (TypeError, ValueError):
        return 0.0


def _round(value, ndigits):
    return round(value, ndigits) if value is not None else None


def _norm(text) -> str:
    return " ".join(str(text).upper().split())


def _has_periodic(txns: list[dict], keyword: str) -> bool:
    s = get_settings()
    dates = sorted(
        _to_date(t.get("ts"))
        for t in txns
        if t.get("direction") == "in" and keyword.upper() in _norm(t.get("content"))
    )
    if len(dates) < 2:
        return False
    gaps = [(dates[i] - dates[i - 1]).days for i in range(1, len(dates))]
    return any(s.salary_gap_min <= g <= s.salary_gap_max for g in gaps)
