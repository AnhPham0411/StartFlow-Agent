#!/bin/sh
set -eu

if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
  if [ -z "${AI_DATABASE_URL:-}" ]; then
    echo "AI_DATABASE_URL is required when RUN_MIGRATIONS=true" >&2
    exit 1
  fi
  alembic upgrade head
fi

exec "$@"
