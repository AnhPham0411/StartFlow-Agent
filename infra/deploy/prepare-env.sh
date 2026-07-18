#!/usr/bin/env bash
set -Eeuo pipefail

output_env="${OUTPUT_ENV:-.env}"
output_ca="${OUTPUT_CA:-postgres-ca.crt}"
target_env="${TARGET_ENV:-dev}"
runtime_env="${STARTFLOW_RUNTIME_ENV:-}"

fail() {
  printf 'StartFlow env error: %s\n' "$1" >&2
  exit 2
}

[[ "$target_env" =~ ^(dev|prod)$ ]] || fail 'TARGET_ENV must be dev or prod.'
[[ -n "$runtime_env" ]] || fail 'STARTFLOW_RUNTIME_ENV is empty.'
mkdir -p "$(dirname "$output_env")" "$(dirname "$output_ca")"
umask 077
printf '%s\n' "$runtime_env" | sed 's/\r$//' > "$output_env"
chmod 600 "$output_env"

env_value() {
  local key="$1"
  sed -n "s/^${key}=//p" "$output_env" | tail -n 1
}

require_key() {
  local key="$1" value normalized
  value="$(env_value "$key")"
  [[ -n "$value" ]] || fail "missing required key $key."
  normalized="${value,,}"
  case "$normalized" in
    *'[redacted'*|*'<'*'>'*|*'change_me'*|*'change-me'*|*'changeme'*) fail "$key still contains a placeholder." ;;
  esac
}

while IFS= read -r line || [[ -n "$line" ]]; do
  [[ -z "$line" || "$line" == \#* ]] && continue
  [[ "$line" == *=* ]] || fail 'every non-comment line must use KEY=value.'
  key="${line%%=*}"
  [[ "$key" =~ ^[A-Z_][A-Z0-9_]*$ ]] || fail "invalid key $key."
done < "$output_env"

for key in \
  NODE_ENV DEPLOY_ENV APP_DOMAIN API_DOMAIN FRONTEND_PORT BACKEND_PORT STARTFLOW_NETWORK \
  DB_HOST DB_PORT DB_NAME DB_USER DB_PASSWORD AUTH_MODE KEYCLOAK_ISSUER KEYCLOAK_SECRET \
  CORS_ORIGINS INTERNAL_SERVICE_TOKEN \
  LLM_MODE QDRANT_URL QDRANT_API_KEY QDRANT_COLLECTION QDRANT_VECTOR_SIZE \
  DROPLET_HOST DROPLET_USER DROPLET_SSH_KNOWN_HOSTS; do
  require_key "$key"
done

for legacy_key in DATABASE_URL AI_DATABASE_URL; do
  [[ -z "$(env_value "$legacy_key")" ]] || fail "remove legacy key $legacy_key and use split DB_* fields."
done

[[ "$(env_value DEPLOY_ENV)" == "$target_env" ]] || fail 'DEPLOY_ENV must match TARGET_ENV.'
[[ "$(env_value NODE_ENV)" == 'production' ]] || fail 'deployed environments require NODE_ENV=production.'
[[ "$(env_value APP_DOMAIN)" =~ ^[A-Za-z0-9.-]+$ ]] || fail 'APP_DOMAIN is invalid.'
[[ "$(env_value API_DOMAIN)" =~ ^[A-Za-z0-9.-]+$ ]] || fail 'API_DOMAIN is invalid.'
[[ "$(env_value FRONTEND_PORT)" =~ ^[0-9]{2,5}$ ]] || fail 'FRONTEND_PORT is invalid.'
[[ "$(env_value BACKEND_PORT)" =~ ^[0-9]{2,5}$ ]] || fail 'BACKEND_PORT is invalid.'
(( 10#$(env_value FRONTEND_PORT) <= 65535 )) || fail 'FRONTEND_PORT is invalid.'
(( 10#$(env_value BACKEND_PORT) <= 65535 )) || fail 'BACKEND_PORT is invalid.'
[[ "$(env_value FRONTEND_PORT)" != "$(env_value BACKEND_PORT)" ]] || fail 'service ports must be distinct.'
[[ "$(env_value STARTFLOW_NETWORK)" =~ ^[A-Za-z0-9_.-]+$ ]] || fail 'STARTFLOW_NETWORK is invalid.'
[[ "$(env_value DROPLET_HOST)" =~ ^[A-Za-z0-9.-]+$ ]] || fail 'DROPLET_HOST is invalid.'
[[ "$(env_value DROPLET_USER)" =~ ^[A-Za-z_][A-Za-z0-9._-]*$ ]] || fail 'DROPLET_USER is invalid.'
[[ "$(env_value DB_HOST)" =~ ^[A-Za-z0-9.-]+$ ]] || fail 'DB_HOST is invalid.'
[[ "$(env_value DB_PORT)" =~ ^[0-9]{1,5}$ ]] || fail 'DB_PORT is invalid.'
(( 10#$(env_value DB_PORT) >= 1 && 10#$(env_value DB_PORT) <= 65535 )) || fail 'DB_PORT is invalid.'
[[ "$(env_value DB_NAME)" =~ ^[A-Za-z0-9_.-]+$ ]] || fail 'DB_NAME is invalid.'
[[ "$(env_value DB_USER)" =~ ^[A-Za-z0-9_.-]+$ ]] || fail 'DB_USER is invalid.'
[[ "$(env_value QDRANT_URL)" =~ ^https?://[^[:space:]]+$ ]] || fail 'QDRANT_URL is invalid.'
[[ "$(env_value QDRANT_COLLECTION)" =~ ^[A-Za-z0-9_.-]+$ ]] || fail 'QDRANT_COLLECTION is invalid.'
[[ "$(env_value QDRANT_VECTOR_SIZE)" =~ ^[0-9]{1,4}$ ]] || fail 'QDRANT_VECTOR_SIZE is invalid.'
(( 10#$(env_value QDRANT_VECTOR_SIZE) >= 1 && 10#$(env_value QDRANT_VECTOR_SIZE) <= 4096 )) || fail 'QDRANT_VECTOR_SIZE is invalid.'

llm_mode="$(env_value LLM_MODE)"
[[ "$llm_mode" == 'mock' || "$llm_mode" == 'openai-compatible' ]] || fail 'LLM_MODE is invalid.'
[[ "$llm_mode" != 'openai-compatible' ]] || require_key LLM_API_KEY

if [[ "$target_env" == 'prod' ]]; then
  [[ "$(env_value AUTH_MODE)" == 'keycloak' ]] || fail 'production AUTH_MODE must be keycloak.'
  [[ "$llm_mode" == 'openai-compatible' ]] || fail 'production LLM_MODE must be openai-compatible.'
fi

postgres_ca_cert_base64="${POSTGRES_CA_CERT_BASE64:-$(env_value POSTGRES_CA_CERT_BASE64)}"
if [[ -n "$postgres_ca_cert_base64" ]]; then
  printf '%s' "$postgres_ca_cert_base64" | base64 --decode > "$output_ca"
  chmod 600 "$output_ca"
  [[ -s "$output_ca" ]] || fail 'decoded PostgreSQL CA certificate is empty.'
  printf '\nPOSTGRES_CA_CERT_PATH=./postgres-ca.crt\n' >> "$output_env"
elif [[ "$(env_value DB_SSL_ROOT_CERT)" == '/run/secrets/postgres-ca.crt' ]]; then
  fail 'POSTGRES_CA_CERT_BASE64 is required when DB_SSL_ROOT_CERT uses the mounted CA path.'
fi
sed -i '/^POSTGRES_CA_CERT_BASE64=/d' "$output_env"

printf 'Validated standalone StartFlow %s runtime environment.\n' "$target_env"
