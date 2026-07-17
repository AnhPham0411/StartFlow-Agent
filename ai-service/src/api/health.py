from __future__ import annotations

from fastapi import APIRouter, Request, Response, status

from src.api.runtime import Runtime

router = APIRouter(tags=["health"])


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "startflow-ai-service"}


@router.get("/ready")
async def ready(request: Request, response: Response) -> dict[str, object]:
    runtime: Runtime = request.app.state.runtime
    checks: dict[str, object] = {"configuration": True}
    if runtime.repository:
        checks["postgresAndPgvector"] = await runtime.repository.ready()
    else:
        checks["postgresAndPgvector"] = "not-configured-seed-mode"
    is_ready = checks["postgresAndPgvector"] is not False
    if not is_ready:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return {"status": "ready" if is_ready else "not-ready", "checks": checks}
