from __future__ import annotations

import hmac
from asyncio import Lock
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Header, HTTPException, Request, status

from src.api.runner import execute_run
from src.api.runtime import Runtime
from src.models.contracts import StartRunRequest, StartRunResponse

router = APIRouter(tags=["runs"])
_accepted_keys: dict[str, StartRunResponse] = {}
_accepted_keys_lock = Lock()


@router.post("/runs", response_model=StartRunResponse, status_code=status.HTTP_202_ACCEPTED)
async def start_run(
    payload: StartRunRequest,
    background_tasks: BackgroundTasks,
    request: Request,
    x_internal_service_token: Annotated[str, Header(alias="X-Internal-Service-Token")],
    idempotency_key: Annotated[
        str | None, Header(alias="Idempotency-Key", min_length=8, max_length=200)
    ] = None,
    x_correlation_id: Annotated[UUID | None, Header(alias="X-Correlation-Id")] = None,
) -> StartRunResponse:
    runtime: Runtime = request.app.state.runtime
    expected = runtime.settings.internal_service_token.get_secret_value()
    if not hmac.compare_digest(x_internal_service_token, expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid service token"
        )
    effective_key = idempotency_key or f"start-run:{payload.run_id}"
    if payload.correlation_id is None and x_correlation_id is not None:
        payload = payload.model_copy(update={"correlation_id": x_correlation_id})
    async with _accepted_keys_lock:
        existing = _accepted_keys.get(effective_key)
        if existing:
            if existing.run_id != payload.run_id:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="idempotency key is already bound to another run",
                )
            return existing
        accepted = StartRunResponse(run_id=payload.run_id)
        _accepted_keys[effective_key] = accepted
    background_tasks.add_task(execute_run, runtime, payload)
    return accepted
