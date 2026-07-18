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
  local key="$1" value
  value="$(env_value "$key")"
  [[ -n "$value" ]] || fail "missing required key $key."
  case "$value" in
    *'[REDACTED'*|*'<'*'>'*|*'changeme'*) fail "$key still contains a placeholder." ;;
  esac
}

while IFS= read -r line || [[ -n "$line" ]]; do
  [[ -z "$line" || "$line" == \#* ]] && continue
  [[ "$line" == *=* ]] || fail 'every non-comment line must use KEY=value.'
  key="${line%%=*}"
  [[ "$key" =~ ^[A-Z_][A-Z0-9_]*$ ]] || fail "invalid key $key."
done < "$output_env"

for key in \
  DEPLOY_ENV APP_DOMAIN API_DOMAIN FRONTEND_PORT BACKEND_PORT STARTFLOW_NETWORK \
  DATABASE_URL AI_DATABASE_URL KEYCLOAK_ISSUER KEYCLOAK_AUDIENCE \
  CORS_ORIGINS INTERNAL_SERVICE_TOKEN; do
  require_key "$key"
done

[[ "$(env_value DEPLOY_ENV)" == "$target_env" ]] || fail 'DEPLOY_ENV must match TARGET_ENV.'
[[ "$(env_value APP_DOMAIN)" =~ ^[A-Za-z0-9.-]+$ ]] || fail 'APP_DOMAIN is invalid.'
[[ "$(env_value API_DOMAIN)" =~ ^[A-Za-z0-9.-]+$ ]] || fail 'API_DOMAIN is invalid.'
[[ "$(env_value FRONTEND_PORT)" =~ ^[0-9]{2,5}$ ]] || fail 'FRONTEND_PORT is invalid.'
[[ "$(env_value BACKEND_PORT)" =~ ^[0-9]{2,5}$ ]] || fail 'BACKEND_PORT is invalid.'
[[ "$(env_value STARTFLOW_NETWORK)" =~ ^[A-Za-z0-9_.-]+$ ]] || fail 'STARTFLOW_NETWORK is invalid.'
if [[ "$target_env" == 'prod' ]]; then
  [[ "$(env_value AUTH_MODE)" == 'keycloak' ]] || fail 'production AUTH_MODE must be keycloak.'
  [[ "$(env_value LLM_MODE)" == 'openai-compatible' ]] || fail 'production LLM_MODE must be openai-compatible.'
  require_key LLM_API_KEY
fi

if [[ -n "${POSTGRES_CA_CERT_BASE64:-}" ]]; then
  printf '%s' "$POSTGRES_CA_CERT_BASE64" | base64 --decode > "$output_ca"
  chmod 600 "$output_ca"
  [[ -s "$output_ca" ]] || fail 'decoded PostgreSQL CA certificate is empty.'
  printf '\nPOSTGRES_CA_CERT_PATH=./postgres-ca.crt\n' >> "$output_env"
elif [[ "$(env_value DB_SSL_ROOT_CERT)" == '/run/secrets/postgres-ca.crt' ]]; then
  fail 'POSTGRES_CA_CERT_BASE64 is required when DB_SSL_ROOT_CERT uses the mounted CA path.'
fi

printf 'Validated standalone StartFlow %s runtime environment.\n' "$target_env"
