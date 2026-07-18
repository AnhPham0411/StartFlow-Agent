"""Truy cập DB cho batch pipeline. Recommendations/audit_log là append-only (chỉ INSERT)."""

from __future__ import annotations

import json
from datetime import date

from src.core.db import get_conn
from src.models.contracts import Recommendation


def create_batch_run(run_type: str) -> int:
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            "INSERT INTO batch_runs(run_type, status) VALUES (%s, 'running') RETURNING id",
            (run_type,),
        )
        return cur.fetchone()["id"]


def finish_batch_run(run_id: int, status: str, stats: dict) -> None:
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            "UPDATE batch_runs SET status=%s, finished_at=now(), stats=%s WHERE id=%s",
            (status, json.dumps(stats), run_id),
        )


def load_customers(limit: int | None = None) -> list[dict]:
    sql = "SELECT id, cif_code, dob, cif_married, cif_occupation_risk, monthly_income FROM customers ORDER BY id"
    if limit:
        sql += f" LIMIT {int(limit)}"
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(sql)
        return cur.fetchall()


def _by_customer(rows: list[dict]) -> dict[int, list[dict]]:
    out: dict[int, list[dict]] = {}
    for r in rows:
        out.setdefault(r["customer_id"], []).append(r)
    return out


def load_related(customer_ids: list[int]) -> dict:
    if not customer_ids:
        return {"accounts": {}, "loans": {}, "transactions": {}, "tags": {}, "cic": {}}
    ids = tuple(customer_ids)
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute("SELECT customer_id, acct_type, balance FROM accounts WHERE customer_id = ANY(%s)", (list(ids),))
        accounts = _by_customer(cur.fetchall())
        cur.execute(
            "SELECT customer_id, outstanding, monthly_payment, is_overdue, is_mortgage "
            "FROM loans WHERE customer_id = ANY(%s)", (list(ids),))
        loans = _by_customer(cur.fetchall())
        cur.execute(
            "SELECT customer_id, ts, amount, direction, counterparty, content "
            "FROM transactions WHERE customer_id = ANY(%s)", (list(ids),))
        txns = _by_customer(cur.fetchall())
        cur.execute(
            "SELECT customer_id, tag, txn_count, avg_confidence FROM customer_tags WHERE customer_id = ANY(%s)",
            (list(ids),))
        tags = _by_customer(cur.fetchall())
        cur.execute("SELECT customer_id, cic_group FROM credit_bureau WHERE customer_id = ANY(%s)", (list(ids),))
        cic = {r["customer_id"]: r["cic_group"] for r in cur.fetchall()}
    return {"accounts": accounts, "loans": loans, "transactions": txns, "tags": tags, "cic": cic}


def load_call_list(list_date: date) -> list[int]:
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute("SELECT customer_id FROM call_lists WHERE list_date=%s", (list_date,))
        return [r["customer_id"] for r in cur.fetchall()]


def load_catalog() -> dict[str, list[dict]]:
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT product, package, tier, rate, fee, limit_min, limit_max, min_balance, age_min, age_max "
            "FROM product_catalog WHERE active ORDER BY product")
        out: dict[str, list[dict]] = {}
        for row in cur.fetchall():
            out.setdefault(row["product"], []).append(row)
        return out


def load_kpi(month: str) -> dict[str, float]:
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute("SELECT product, multiplier FROM kpi_weights WHERE month=%s", (month,))
        return {r["product"]: float(r["multiplier"]) for r in cur.fetchall()}


def next_version(customer_id: int) -> int:
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute("SELECT COALESCE(MAX(version),0)+1 AS v FROM recommendations WHERE customer_id=%s", (customer_id,))
        return cur.fetchone()["v"]


def insert_score(run_id: int, customer_id: int, product: str, score: float, wver: str, as_of: date) -> None:
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            "INSERT INTO scores(customer_id, batch_run_id, product, score, weights_version, as_of_date) "
            "VALUES (%s,%s,%s,%s,%s,%s) ON CONFLICT (customer_id, product, batch_run_id) DO NOTHING",
            (customer_id, run_id, product, score, wver, as_of))


def insert_recommendation(run_id: int, rec: Recommendation) -> int:
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """INSERT INTO recommendations
               (customer_id, batch_run_id, version, source, product_rank1, score_rank1, hook1, explain1,
                slots_used1, product_rank2, score_rank2, hook2, explain2, slots_used2,
                rules_applied, weights_versions, input_snapshot, input_snapshot_hash)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id""",
            (rec.customer_id, run_id, rec.version, rec.source.value, rec.product_rank1, rec.score_rank1,
             rec.hook1, rec.explain1, json.dumps([s.model_dump() for s in rec.slots_used1]),
             rec.product_rank2, rec.score_rank2, rec.hook2, rec.explain2,
             json.dumps([s.model_dump() for s in rec.slots_used2]),
             rec.rules_applied, json.dumps(rec.weights_versions),
             json.dumps(rec.input_snapshot), rec.input_snapshot_hash))
        return cur.fetchone()["id"]


def insert_validator_log(run_id: int, customer_id: int, product: str, attempt: int,
                         pattern_group: str, reason: str, draft_hook: str) -> None:
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            "INSERT INTO validator_log(batch_run_id, customer_id, product, attempt, pattern_group, reason, draft_hook) "
            "VALUES (%s,%s,%s,%s,%s,%s,%s)",
            (run_id, customer_id, product, attempt, pattern_group, reason, draft_hook))
