from __future__ import annotations

from src.nba.contracts import CustomerSnapshot, SanitizedCustomer


def sanitize_for_model(customer: CustomerSnapshot) -> SanitizedCustomer:
    """Build the only payload allowed to cross an external model boundary."""
    return SanitizedCustomer(
        customer_id=customer.customer_id,
        branch_id=customer.branch_id,
        assigned_user_id=customer.assigned_user_id,
        metrics=customer.metrics,
        tags=customer.tags,
        geo_code=customer.geo_code,
        geo_confidence=customer.geo_confidence,
    )

