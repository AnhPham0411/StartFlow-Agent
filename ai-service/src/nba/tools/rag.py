from __future__ import annotations


def masked_case_key(customer_id: int) -> str:
    return f"customer-{customer_id}"

