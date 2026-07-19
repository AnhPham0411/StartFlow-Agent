from __future__ import annotations

import hmac
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Header, HTTPException, Request, status

from src.api.runtime import Runtime
from src.nba.contracts import (
    NbaApiRunRequest,
    NbaBatchRun,
    NbaCanonicalStageEvent,
    NbaRunRequest,
    NbaRunResult,
    RunMode,
)

router = APIRouter(prefix="/internal/nba", tags=["internal-nba"])


def require_service_token(
    request: Request,
    x_internal_service_token: Annotated[str, Header(alias="X-Internal-Service-Token")],
) -> Runtime:
    runtime: Runtime = request.app.state.runtime
    expected = runtime.settings.internal_service_token.get_secret_value()
    if not hmac.compare_digest(x_internal_service_token, expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid service token"
        )
    return runtime


_STAGE_CODES = {
    "m1_etl": "M1",
    "ag1_extraction": "AG1",
    "m2_geo": "M2",
    "m3_profile": "M3",
    "m4_scoring": "M4",
    "m5_ranker": "M5",
    "m6_call_list": "M6",
    "ag2_ag6_scripting_m7": "M7",
    "m11_outcome": "M11",
    "m12_retrain": "M12",
    "m13_rag_writer": "M13",
}


def _adapt_request(
    payload: NbaApiRunRequest | NbaRunRequest, expected_kind: RunMode
) -> NbaRunRequest:
    if isinstance(payload, NbaRunRequest):
        customer_id = payload.customer_id
        if customer_id is None and expected_kind == RunMode.MINI and len(payload.customer_ids) == 1:
            customer_id = payload.customer_ids[0]
        return payload.model_copy(update={"mode": expected_kind, "customer_id": customer_id})
    if payload.kind != expected_kind:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="run kind does not match endpoint",
        )
    customer_ids = [payload.customer_id] if payload.customer_id is not None else []
    return NbaRunRequest(
        mode=payload.kind,
        customer_ids=customer_ids,
        demo_customers=payload.demo_customers,
        business_date=payload.business_date,
        customer_id=payload.customer_id,
        idempotency_key=payload.idempotency_key,
    )


def _canonical_response(run: NbaRunResult) -> NbaBatchRun:
    stages: list[NbaCanonicalStageEvent] = []
    for event in run.stages:
        stage_code = _STAGE_CODES.get(event.stage)
        if stage_code is None:
            continue
        canonical_status = "succeeded" if event.status == "completed" else event.status
        stages.append(
            NbaCanonicalStageEvent(
                run_id=run.run_id,
                stage=stage_code,
                status=canonical_status,
                attempt=event.attempt,
                started_at=None,
                completed_at=event.occurred_at,
                duration_ms=None,
                error_code=event.reason if event.status == "failed" else None,
                message=event.reason if event.status == "skipped" else None,
            )
        )
    run_status = "succeeded" if run.status == "completed" else run.status
    return NbaBatchRun(
        run_id=run.run_id,
        kind=run.mode,
        status=run_status,
        business_date=run.business_date,
        customer_id=run.customer_id,
        created_at=run.started_at,
        completed_at=run.finished_at,
        stages=stages,
    )


async def _execute(
    payload: NbaApiRunRequest | NbaRunRequest, mode: RunMode, runtime: Runtime
) -> NbaBatchRun:
    if not runtime.settings.nba_enabled:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="NBA disabled")
    effective = _adapt_request(payload, mode)
    if effective.demo_customers:
        if not runtime.settings.nba_demo_mode:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="demo customer snapshots are disabled",
            )
        runtime.nba_repository.add_customers(effective.demo_customers)
    run = await runtime.nba_orchestrator.run(effective)
    return _canonical_response(run)


@router.post("/runs/nightly", response_model=NbaBatchRun)
async def start_nightly_run(
    payload: NbaApiRunRequest | NbaRunRequest,
    request: Request,
    x_internal_service_token: Annotated[str, Header(alias="X-Internal-Service-Token")],
) -> NbaBatchRun:
    runtime = require_service_token(request, x_internal_service_token)
    return await _execute(payload, RunMode.NIGHTLY, runtime)


@router.post("/runs/mini", response_model=NbaBatchRun)
async def start_mini_run(
    payload: NbaApiRunRequest | NbaRunRequest,
    request: Request,
    x_internal_service_token: Annotated[str, Header(alias="X-Internal-Service-Token")],
) -> NbaBatchRun:
    runtime = require_service_token(request, x_internal_service_token)
    return await _execute(payload, RunMode.MINI, runtime)


@router.get("/runs/{run_id}", response_model=NbaBatchRun)
async def get_nba_run(
    run_id: UUID,
    request: Request,
    x_internal_service_token: Annotated[str, Header(alias="X-Internal-Service-Token")],
) -> NbaBatchRun:
    runtime = require_service_token(request, x_internal_service_token)
    run = await runtime.nba_repository.get_run(run_id)
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="NBA run not found")
    return _canonical_response(run)
