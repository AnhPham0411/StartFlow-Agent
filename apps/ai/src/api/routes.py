"""API FastAPI (internal) — BUILD_SPEC §6.

POST /batch/nightly · POST /batch/mini/{id} · POST /simulate/big-txn
POST /admin/retrain?product= · GET /tags/review?tag=
"""

from __future__ import annotations

from datetime import date, datetime

from fastapi import APIRouter, Body
from pydantic import BaseModel

from src.batch import orchestrator
from src.core.db import fetch_all, get_conn

router = APIRouter()


@router.post("/batch/nightly")
async def batch_nightly() -> dict:
    return await orchestrator.run_nightly()


@router.post("/batch/mini/{customer_id}")
async def batch_mini(customer_id: int) -> dict:
    return await orchestrator.run_mini(customer_id)


class BigTxn(BaseModel):
    customer_id: int
    amount: float
    content: str = "giao dich dot bien demo"


@router.post("/simulate/big-txn", status_code=202)
async def simulate_big_txn(payload: BigTxn = Body(...)) -> dict:
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            "INSERT INTO transactions(customer_id, ts, amount, direction, content) "
            "VALUES (%s,%s,%s,'in',%s)",
            (payload.customer_id, datetime.now(), payload.amount, payload.content),
        )
    result = await orchestrator.run_mini(payload.customer_id)
    return {"accepted": True, **result}


@router.post("/admin/retrain")
async def admin_retrain(product: str) -> dict:
    """B6: retrain propensity + 4 cửa duyệt."""
    from src.training.retrain import run_retrain
    from src.core.db import get_conn
    with get_conn() as conn:
        return run_retrain(conn, product)


@router.get("/tags/review")
async def tags_review(tag: str | None = None) -> dict:
    if tag:
        rows = fetch_all(
            "SELECT tag, n_reviewed, precision_observed FROM v_tag_precision WHERE tag=%s", (tag,))
    else:
        rows = fetch_all("SELECT tag, n_reviewed, precision_observed FROM v_tag_precision")
    return {"as_of": date.today().isoformat(), "precision": rows}
