FROM ghcr.io/astral-sh/uv:0.11.29-python3.12-bookworm-slim AS builder

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy

WORKDIR /app
COPY ai-service/pyproject.toml ai-service/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY ai-service/src ./src
COPY ai-service/alembic.ini ./alembic.ini
COPY ai-service/alembic ./alembic
COPY ai-service/entrypoint.sh ./entrypoint.sh
COPY knowledge/seed ./knowledge/seed
RUN uv sync --frozen --no-dev
RUN chmod +x /app/entrypoint.sh

FROM python:3.12.11-slim-bookworm AS runtime

ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000

RUN groupadd --system --gid 10001 startflow \
    && useradd --system --uid 10001 --gid startflow --home-dir /app startflow

WORKDIR /app
COPY --from=builder --chown=startflow:startflow /app /app

USER startflow
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=3)"

ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
