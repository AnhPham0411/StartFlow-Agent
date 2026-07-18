"""SHB NBA Engine — FastAPI entrypoint (apps/ai).

Chạy: uv run uvicorn src.main:app --reload --port 8000
"""

from __future__ import annotations

from fastapi import FastAPI

from src.api.routes import router
from src.core.config import get_settings

from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="SHB NBA Engine", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/ready")
def ready() -> dict:
    """Sẵn sàng khi có cấu hình DB (không mở kết nối để tránh chậm health-check)."""
    return {"status": "ready", "db_configured": get_settings().database_url is not None}
