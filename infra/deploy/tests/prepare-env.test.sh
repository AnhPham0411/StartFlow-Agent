#!/usr/bin/env bash
set -Eeuo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
tmp_dir="$(mktemp -d)"
trap 'rm -rf -- "$tmp_dir"' EXIT

valid_env='NODE_ENV=production
DEPLOY_ENV=prod
APP_DOMAIN=app.example.com
API_DOMAIN=api.example.com
FRONTEND_PORT=3100
BACKEND_PORT=3101
STARTFLOW_NETWORK=startflow-prod
DATABASE_URL=postgresql://db.example.com:5432/app
AI_DATABASE_URL=postgresql://db.example.com:5432/ai
AUTH_MODE=keycloak
KEYCLOAK_ISSUER=https://auth.example.com/realms/startflow
KEYCLOAK_AUDIENCE=startflow-api
NEXT_PUBLIC_API_URL=https://api.example.com/api
NEXT_PUBLIC_AUTH_MODE=keycloak
NEXT_PUBLIC_KEYCLOAK_URL=https://auth.example.com
NEXT_PUBLIC_KEYCLOAK_REALM=startflow
NEXT_PUBLIC_KEYCLOAK_CLIENT_ID=startflow-web
CORS_ORIGINS=https://app.example.com
LLM_MODE=openai-compatible
LLM_API_KEY=local-fixture-value
INTERNAL_SERVICE_TOKEN=local-fixture-value'

STARTFLOW_RUNTIME_ENV="$valid_env" TARGET_ENV=prod \
OUTPUT_ENV="$tmp_dir/.env" OUTPUT_CA="$tmp_dir/ca.crt" \
  bash "$repo_root/infra/deploy/prepare-env.sh" >/dev/null
grep -Fxq 'STARTFLOW_NETWORK=startflow-prod' "$tmp_dir/.env"
[[ "$(stat -c '%a' "$tmp_dir/.env")" == '600' ]]

set +e
STARTFLOW_RUNTIME_ENV="${valid_env/DEPLOY_ENV=prod/DEPLOY_ENV=dev}" TARGET_ENV=prod \
OUTPUT_ENV="$tmp_dir/invalid.env" OUTPUT_CA="$tmp_dir/invalid-ca.crt" \
  bash "$repo_root/infra/deploy/prepare-env.sh" >/dev/null 2>&1
status=$?
set -e
[[ "$status" -ne 0 ]]

printf 'standalone prepare-env tests passed.\n'
