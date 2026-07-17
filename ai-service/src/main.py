from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from src.api.health import router as health_router
from src.api.knowledge import router as knowledge_router
from src.api.runs import router as runs_router
from src.api.runtime import build_runtime
from src.core.logging import configure_logging
from src.core.settings import get_settings


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    configure_logging(settings.log_level)
    app.state.runtime = build_runtime(settings)
    try:
        yield
    finally:
        await app.state.runtime.close()


def create_app() -> FastAPI:
    application = FastAPI(
        title="StartFlow AI Service",
        version="0.1.0",
        docs_url="/docs",
        openapi_url="/openapi.json",
        lifespan=lifespan,
    )
    application.include_router(health_router)
    application.include_router(runs_router)
    application.include_router(knowledge_router)
    return application


app = create_app()
