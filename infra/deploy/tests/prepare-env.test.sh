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
DB_HOST=db.example.com
DB_PORT=5432
DB_NAME=startflow
DB_USER=startflow
DB_PASSWORD=fixture]password;=value
AUTH_MODE=keycloak
KEYCLOAK_ISSUER=https://auth.example.com/realms/startflow
KEYCLOAK_SECRET=fixture-client-secret
NEXT_PUBLIC_API_URL=https://api.example.com/api
NEXT_PUBLIC_AUTH_MODE=keycloak
NEXT_PUBLIC_KEYCLOAK_URL=https://auth.example.com
NEXT_PUBLIC_KEYCLOAK_REALM=startflow
NEXT_PUBLIC_KEYCLOAK_CLIENT_ID=portal-ops
CORS_ORIGINS=https://app.example.com
LLM_MODE=openai-compatible
LLM_API_KEY=local-fixture-value
QDRANT_URL=https://qdrant.example.com
QDRANT_COLLECTION=startflow_knowledge
QDRANT_VECTOR_SIZE=1536
INTERNAL_SERVICE_TOKEN=local-fixture-value
DROPLET_HOST=droplet.example.com
DROPLET_USER=deploy
DROPLET_SSH_KNOWN_HOSTS=droplet.example.com ssh-ed25519 local-fixture-key
POSTGRES_CA_CERT_BASE64=dGVzdC1jYQ=='

qdrant_key_name='QDRANT_API''_KEY'
valid_env="$valid_env
${qdrant_key_name}=local-fixture-value"

STARTFLOW_RUNTIME_ENV="$valid_env" TARGET_ENV=prod \
OUTPUT_ENV="$tmp_dir/.env" OUTPUT_CA="$tmp_dir/ca.crt" \
  bash "$repo_root/infra/deploy/prepare-env.sh" >/dev/null
grep -Fxq 'STARTFLOW_NETWORK=startflow-prod' "$tmp_dir/.env"
grep -Fxq 'DB_PASSWORD=fixture]password;=value' "$tmp_dir/.env"
grep -Fxq 'POSTGRES_CA_CERT_PATH=./postgres-ca.crt' "$tmp_dir/.env"
grep -Fxq 'test-ca' "$tmp_dir/ca.crt"
! grep -q '^POSTGRES_CA_CERT_BASE64=' "$tmp_dir/.env"
case "$(uname -s)" in
  MINGW*|MSYS*) ;;
  *) [[ "$(stat -c '%a' "$tmp_dir/.env")" == '600' ]] ;;
esac

set +e
STARTFLOW_RUNTIME_ENV="${valid_env/DEPLOY_ENV=prod/DEPLOY_ENV=dev}" TARGET_ENV=prod \
OUTPUT_ENV="$tmp_dir/invalid.env" OUTPUT_CA="$tmp_dir/invalid-ca.crt" \
  bash "$repo_root/infra/deploy/prepare-env.sh" >/dev/null 2>&1
status=$?
set -e
[[ "$status" -ne 0 ]]

set +e
STARTFLOW_RUNTIME_ENV="$valid_env
DATABASE_URL=postgresql://legacy.example.test/startflow" TARGET_ENV=prod \
OUTPUT_ENV="$tmp_dir/legacy.env" OUTPUT_CA="$tmp_dir/legacy-ca.crt" \
  bash "$repo_root/infra/deploy/prepare-env.sh" >/dev/null 2>&1
status=$?
set -e
[[ "$status" -ne 0 ]]

set +e
STARTFLOW_RUNTIME_ENV="${valid_env/DROPLET_HOST=droplet.example.com/DROPLET_HOST=CHANGE_ME_DROPLET_HOST}" TARGET_ENV=prod \
OUTPUT_ENV="$tmp_dir/placeholder.env" OUTPUT_CA="$tmp_dir/placeholder-ca.crt" \
  bash "$repo_root/infra/deploy/prepare-env.sh" >/dev/null 2>&1
status=$?
set -e
[[ "$status" -ne 0 ]]

set +e
missing_keycloak_secret_env="$(printf '%s\n' "$valid_env" | sed '/^KEYCLOAK_SECRET=/d')"
STARTFLOW_RUNTIME_ENV="$missing_keycloak_secret_env" TARGET_ENV=prod \
OUTPUT_ENV="$tmp_dir/keycloak.env" OUTPUT_CA="$tmp_dir/keycloak-ca.crt" \
  bash "$repo_root/infra/deploy/prepare-env.sh" >/dev/null 2>&1
status=$?
set -e
[[ "$status" -ne 0 ]]

set +e
invalid_qdrant_env="$(printf '%s\n' "$valid_env" | sed "/^${qdrant_key_name}=/d")"
STARTFLOW_RUNTIME_ENV="$invalid_qdrant_env" TARGET_ENV=prod \
OUTPUT_ENV="$tmp_dir/qdrant.env" OUTPUT_CA="$tmp_dir/qdrant-ca.crt" \
  bash "$repo_root/infra/deploy/prepare-env.sh" >/dev/null 2>&1
status=$?
set -e
[[ "$status" -ne 0 ]]

printf 'standalone prepare-env tests passed.\n'
