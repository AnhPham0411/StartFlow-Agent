"""A0 Orchestrator — run_nightly() / run_mini().

Luồng: A1 ETL+profile → A2 scoring → (call list) A3 ranker → A5 scripting →
A6 validator → A7 sink recommendations (append-only, version+1, snapshot hash).
L7 fail-fast: lỗi stage sau retry → batch_runs.status='failed', không ghi nửa vời.
"""

from __future__ import annotations

import hashlib
import json
from datetime import date, timedelta

from src.batch import repository as repo
from src.core.config import get_settings
from src.core.db import fetch_all
from src.etl.engine import compute_features
from src.llm.provider import build_provider
from src.models.contracts import (
    CustomerTag,
    Profile,
    Recommendation,
    RunType,
    Score,
    ScriptResult,
    Slot,
)
from src.ranker.engine import rank
from src.ranker.rules import RankContext
from src.scoring.engine import score_all
from src.scripting.agents import DomainAgent
from src.scripting.contract import build_contract
from src.scripting.tools import catalog_lookup
from src.validator.engine import enforce


def _snapshot_hash(snapshot: dict) -> str:
    return hashlib.sha256(json.dumps(snapshot, sort_keys=True, default=str).encode()).hexdigest()


def _build_profiles(customers: list[dict], related: dict, as_of: date) -> list[Profile]:
    profiles: list[Profile] = []
    for c in customers:
        cid = c["id"]
        tags = related["tags"].get(cid, [])
        features = compute_features(
            customer=c,
            accounts=related["accounts"].get(cid, []),
            loans=related["loans"].get(cid, []),
            transactions=related["transactions"].get(cid, []),
            customer_tags=tags,
            as_of=as_of,
            held_products=[p["product"] for p in related.get("products", {}).get(cid, [])],
        )
        profiles.append(
            Profile(
                customer_id=cid,
                as_of_date=as_of,
                features=features,
                tags=[CustomerTag(tag=t["tag"], txn_count=t["txn_count"], avg_confidence=float(t["avg_confidence"]))
                      for t in tags],
            )
        )
    return profiles


def _held(customer_id: int) -> set:
    rows = fetch_all(
        "SELECT product, tier FROM customer_products WHERE customer_id=%s AND status='active'", (customer_id,))
    return {(r["product"], r["tier"]) for r in rows}


def _suppressed(customer_id: int) -> set:
    rows = fetch_all("SELECT product FROM v_active_suppressions WHERE customer_id=%s", (customer_id,))
    return {r["product"] for r in rows}


async def _script_product(agent: DomainAgent, run_id: int, profile: Profile, product: str,
                          score: float, rules: list[str], catalog: dict, cif_code: str):
    rows = catalog.get(product, [])
    slots = catalog_lookup(product, rows[0]) if rows else [Slot(key="ten_goi", value=product)]
    contract = build_contract(profile, product, score, rules, slots, cif_code)

    async def generate(attempt: int) -> ScriptResult:
        return await agent.run(contract)

    result, rejects = await enforce(generate, product, slots)
    for i, rej in enumerate(rejects, start=1):
        repo.insert_validator_log(
            run_id, profile.customer_id, product, i, rej.pattern_group, rej.reason, rej.draft_hook)
    return result, slots


async def run_nightly(as_of: date | None = None) -> dict:
    s = get_settings()
    as_of = as_of or date.today()
    run_id = repo.create_batch_run(RunType.NIGHTLY.value)
    try:
        customers = repo.load_customers()
        cids = [c["id"] for c in customers]
        related = repo.load_related(cids)
        profiles = _build_profiles(customers, related, as_of)

        # A2 — chấm điểm toàn bộ, ghi scores
        scores: list[Score] = score_all(profiles)
        by_customer_scores: dict[int, dict[str, float]] = {}
        for sc in scores:
            repo.insert_score(run_id, sc.customer_id, sc.product, sc.score, sc.weights_version, as_of)
            by_customer_scores.setdefault(sc.customer_id, {})[sc.product] = sc.score

        # A4 — chỉ call list T+1 mới đi tiếp A3→A7
        call_list = set(repo.load_call_list(as_of + timedelta(days=1)))
        catalog = repo.load_catalog()
        kpi = repo.load_kpi(as_of.strftime("%Y-%m"))
        cust_by_id = {c["id"]: c for c in customers}
        agent = DomainAgent(build_provider(s, role="scripting"))

        n_recs = 0
        for profile in profiles:
            if profile.customer_id not in call_list:
                continue  # ngoài list: dừng ở A3, điểm đã lưu (BI), không tốn token
            ctx = RankContext(
                customer_id=profile.customer_id,
                features=profile.features,
                base_scores=by_customer_scores.get(profile.customer_id, {}),
                cic_group=related["cic"].get(profile.customer_id, 1),
                held=_held(profile.customer_id),
                suppressed=_suppressed(profile.customer_id),
                kpi=kpi,
                catalog={p: rows[0] for p, rows in catalog.items()},
            )
            ranked = rank(ctx)
            if not ranked.ranked:
                continue
            cif_code = cust_by_id[profile.customer_id]["cif_code"]
            scripts = []
            for rp in ranked.ranked:
                result, slots = await _script_product(
                    agent, run_id, profile, rp.product, rp.final_score, rp.rules_applied, catalog, cif_code)
                scripts.append((rp, result))

            snapshot = {"features": profile.features, "tags": [t.tag for t in profile.tags]}
            top1, r1 = scripts[0]
            rec = Recommendation(
                customer_id=profile.customer_id,
                version=repo.next_version(profile.customer_id),
                source=RunType.NIGHTLY,
                product_rank1=top1.product, score_rank1=top1.final_score,
                hook1=r1.hook, explain1=r1.explain, slots_used1=r1.slots_used,
                rules_applied=ranked.rules_applied,
                weights_versions={p: "v0-default" for p in by_customer_scores.get(profile.customer_id, {})},
                input_snapshot=snapshot, input_snapshot_hash=_snapshot_hash(snapshot),
            )
            if len(scripts) > 1:
                top2, r2 = scripts[1]
                rec.product_rank2, rec.score_rank2 = top2.product, top2.final_score
                rec.hook2, rec.explain2, rec.slots_used2 = r2.hook, r2.explain, r2.slots_used
            repo.insert_recommendation(run_id, rec)
            n_recs += 1

        stats = {"n_customers": len(customers), "n_call_list": len(call_list), "n_recommendations": n_recs}
        repo.finish_batch_run(run_id, "done", stats)
        return {"run_id": run_id, "status": "done", "stats": stats}
    except Exception as error:
        repo.finish_batch_run(run_id, "failed", {"error": type(error).__name__, "detail": str(error)[:200]})
        raise


async def run_mini(customer_id: int, as_of: date | None = None) -> dict:
    """B5 trigger đột biến — chạy A1→A7 cho 1 khách, tạo version mới (không ghi đè)."""
    s = get_settings()
    as_of = as_of or date.today()
    run_id = repo.create_batch_run(RunType.MINI.value)
    try:
        customers = [c for c in repo.load_customers() if c["id"] == customer_id]
        if not customers:
            raise ValueError(f"customer {customer_id} không tồn tại")
        related = repo.load_related([customer_id])
        profile = _build_profiles(customers, related, as_of)[0]

        scores = score_all([profile])
        base = {}
        for sc in scores:
            repo.insert_score(run_id, sc.customer_id, sc.product, sc.score, sc.weights_version, as_of)
            base[sc.product] = sc.score

        catalog = repo.load_catalog()
        kpi = repo.load_kpi(as_of.strftime("%Y-%m"))
        ctx = RankContext(
            customer_id=customer_id, features=profile.features, base_scores=base,
            cic_group=related["cic"].get(customer_id, 1), held=_held(customer_id),
            suppressed=_suppressed(customer_id), kpi=kpi,
            catalog={p: rows[0] for p, rows in catalog.items()},
        )
        ranked = rank(ctx)
        if not ranked.ranked:
            repo.finish_batch_run(run_id, "done", {"n_recommendations": 0})
            return {"run_id": run_id, "status": "done", "new_version": None}

        agent = DomainAgent(build_provider(s, role="scripting"))
        cif_code = customers[0]["cif_code"]
        scripts = []
        for rp in ranked.ranked:
            result, _slots = await _script_product(
                agent, run_id, profile, rp.product, rp.final_score, rp.rules_applied, catalog, cif_code)
            scripts.append((rp, result))

        snapshot = {"features": profile.features, "tags": [t.tag for t in profile.tags]}
        version = repo.next_version(customer_id)
        top1, r1 = scripts[0]
        rec = Recommendation(
            customer_id=customer_id, version=version, source=RunType.MINI,
            product_rank1=top1.product, score_rank1=top1.final_score,
            hook1=r1.hook, explain1=r1.explain, slots_used1=r1.slots_used,
            rules_applied=ranked.rules_applied,
            weights_versions={p: "v0-default" for p in base},
            input_snapshot=snapshot, input_snapshot_hash=_snapshot_hash(snapshot),
        )
        if len(scripts) > 1:
            top2, r2 = scripts[1]
            rec.product_rank2, rec.score_rank2 = top2.product, top2.final_score
            rec.hook2, rec.explain2, rec.slots_used2 = r2.hook, r2.explain, r2.slots_used
        repo.insert_recommendation(run_id, rec)
        repo.finish_batch_run(run_id, "done", {"n_recommendations": 1})
        return {"run_id": run_id, "status": "done", "new_version": version}
    except Exception as error:
        repo.finish_batch_run(run_id, "failed", {"error": type(error).__name__, "detail": str(error)[:200]})
        raise
