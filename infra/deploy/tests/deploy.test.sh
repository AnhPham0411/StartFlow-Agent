#!/usr/bin/env bash
set -Eeuo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
script="$repo_root/infra/deploy/deploy.sh"
prod_compose="$repo_root/docker-compose.prod.yml"
backend_nginx="$repo_root/infra/deploy/nginx/backend.conf.template"
tmp_dir="$(mktemp -d)"
trap 'rm -rf -- "$tmp_dir"' EXIT

bash -n "$script"

backend_migration_line="$(grep -n 'run --interactive=false --no-TTY --rm backend-migrate' "$script" | cut -d: -f1)"
ai_migration_line="$(grep -n 'run --interactive=false --no-TTY --rm ai-migrate' "$script" | cut -d: -f1)"
profile_seed_line="$(grep -n 'run --interactive=false --no-TTY --rm backend-profile-seed' "$script" | cut -d: -f1)"
demo_seed_line="$(grep -n 'run --interactive=false --no-TTY --rm backend-demo-seed' "$script" | cut -d: -f1)"
identity_seed_line="$(grep -n 'run --interactive=false --no-TTY --rm backend-identity-seed' "$script" | cut -d: -f1)"
up_line="$(grep -n 'up -d backend ai-service frontend' "$script" | head -n 1 | cut -d: -f1)"
ai_seed_line="$(grep -n 'run --interactive=false --no-TTY --rm ai-seed' "$script" | cut -d: -f1)"

[[ "$backend_migration_line" -lt "$up_line" ]]
[[ "$ai_migration_line" -lt "$up_line" ]]
[[ "$backend_migration_line" -lt "$profile_seed_line" ]]
[[ "$profile_seed_line" -lt "$demo_seed_line" ]]
[[ "$demo_seed_line" -lt "$identity_seed_line" ]]
[[ "$profile_seed_line" -lt "$identity_seed_line" ]]
[[ "$identity_seed_line" -lt "$up_line" ]]
[[ "$profile_seed_line" -lt "$up_line" ]]
[[ "$ai_seed_line" -gt "$up_line" ]]
grep -Fq '/.well-known/openid-configuration' "$script"
grep -Fq 'Database migrations are forward-only' "$script"
grep -Fq 'startflow-$target_env' "$script"
grep -Fq 'frontend_port/health' "$script"
grep -Fq 'trap on_exit EXIT' "$script"
grep -Fq 'rm -f -- "$archive"' "$script"
grep -Fq 'realpath -m -- "$droplet_path"' "$script"
candidate_previous_line="$(grep -n 'candidate_previous_release=' "$script" | cut -d: -f1)"
trusted_previous_line="$(grep -n 'previous_release="$candidate_previous_release"' "$script" | cut -d: -f1)"
[[ -n "$candidate_previous_line" && -n "$trusted_previous_line" && "$candidate_previous_line" -lt "$trusted_previous_line" ]]

if [[ "$(grep -Fc 'ports: !override' "$prod_compose")" -ne 2 ]]; then
  echo 'Production Compose must replace both application port lists.' >&2
  exit 1
fi

compose_json="$tmp_dir/production-compose.json"
STARTFLOW_ENV_FILE="$repo_root/.env.production.example" \
POSTGRES_CA_CERT_PATH="$repo_root/.env.production.example" \
BACKEND_PORT=43211 \
FRONTEND_PORT=43210 \
  docker compose \
    --env-file "$repo_root/.env.production.example" \
    -f "$repo_root/docker-compose.yml" \
    -f "$prod_compose" \
    config --format json > "$compose_json"
python3 - "$compose_json" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as compose_file:
    compose = json.load(compose_file)

expected_ports = {
    "backend": {"published": "43211", "target": 3001},
    "frontend": {"published": "43210", "target": 3000},
}

for service_name, expected in expected_ports.items():
    ports = compose["services"][service_name].get("ports", [])
    assert len(ports) == 1, f"{service_name} must publish exactly one production port"
    assert ports[0].get("host_ip") == "127.0.0.1", (
        f"{service_name} production port must bind only to loopback"
    )
    assert str(ports[0].get("published")) == expected["published"], (
        f"{service_name} must publish the explicitly configured production port"
    )
    assert ports[0].get("target") == expected["target"], (
        f"{service_name} must target its application container port"
    )
PY

malicious_sha='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
set +e
path_output="$(DROPLET_PATH='/opt/startflow-agent/../../etc' RELEASE_SHA="$malicious_sha" TARGET_ENV=prod \
  bash "$script" 2>&1)"
status=$?
set -e
[[ "$status" -ne 0 ]]
grep -Fq 'DROPLET_PATH must not contain empty, dot, or dot-dot segments.' <<< "$path_output"

cleanup_root="$tmp_dir/cleanup-root"
cleanup_archive="$cleanup_root/release/release-$malicious_sha.tar.gz"
mkdir -p "$cleanup_root/release"
printf 'invalid archive fixture' > "$cleanup_archive"
set +e
DROPLET_PATH="$cleanup_root" RELEASE_SHA="$malicious_sha" TARGET_ENV=prod \
  bash "$script" >/dev/null 2>&1
status=$?
set -e
[[ "$status" -ne 0 ]]
[[ ! -e "$cleanup_archive" ]]

symlink_root="$tmp_dir/symlink-root"
outside_root="$tmp_dir/outside-root"
mkdir -p "$symlink_root/release" "$outside_root"
printf 'keep' > "$outside_root/sentinel"
if ln -s "$outside_root" "$symlink_root/releases" 2>/dev/null && [[ -L "$symlink_root/releases" ]]; then
  symlink_archive="$symlink_root/release/release-$malicious_sha.tar.gz"
  printf 'invalid archive fixture' > "$symlink_archive"
  set +e
  symlink_output="$(DROPLET_PATH="$symlink_root" RELEASE_SHA="$malicious_sha" TARGET_ENV=prod \
    bash "$script" 2>&1)"
  status=$?
  set -e
  [[ "$status" -ne 0 ]]
  grep -Fq 'release root must remain within DROPLET_PATH.' <<< "$symlink_output"
  [[ -f "$outside_root/sentinel" ]]
  [[ ! -e "$outside_root/$malicious_sha" ]]
  [[ ! -e "$symlink_archive" ]]
fi

sse_line="$(grep -n 'location ~ \^/api/runs/' "$backend_nginx" | head -n 1 | cut -d: -f1)"
default_line="$(grep -n 'location / {' "$backend_nginx" | head -n 1 | cut -d: -f1)"
[[ -n "$sse_line" && "$sse_line" -lt "$default_line" ]]
sse_block="$(sed -n "${sse_line},$((sse_line + 14))p" "$backend_nginx")"
grep -Fq 'proxy_read_timeout 1h;' <<< "$sse_block"
grep -Fq 'proxy_buffering off;' <<< "$sse_block"
grep -Fq 'proxy_cache off;' <<< "$sse_block"
grep -Fq 'proxy_set_header Connection "";' <<< "$sse_block"
if grep -Fq 'Upgrade' <<< "$sse_block"; then
  echo 'SSE proxy must not use WebSocket upgrade headers.' >&2
  exit 1
fi

retired_health_path='frontend_port/api''/health'
if grep -Fq "$retired_health_path" "$script"; then
  echo 'Frontend readiness must use the Nginx /health endpoint.' >&2
  exit 1
fi

grep -Fq '/.well-known/openid-configuration' "$script"
grep -Fq 'Database migrations are forward-only' "$script"
grep -Fq 'startflow-$target_env' "$script"
grep -Fq 'sudo nginx -T' "$script"
grep -Fq 'ensure_tls_certificate "$domain"' "$script"
grep -Fq -- '--webroot-path /var/www/html' "$script"
grep -Fq -- '--cert-name "$domain"' "$script"
grep -Fq '/etc/nginx/sites-enabled/*' "$script"
grep -Fq '/etc/nginx/conf.d/*.conf' "$script"
grep -Fq 'conflicting server name' "$script"
grep -Fq 'server_name $app_domain;' "$script"
grep -Fq 'proxy_pass http://127.0.0.1:$frontend_port;' "$script"
grep -Fq 'server_name $api_domain;' "$script"
grep -Fq 'proxy_pass http://127.0.0.1:$backend_port;' "$script"
grep -Fq -- '--resolve "$domain:443:127.0.0.1"' "$script"
grep -Fq 'for attempt in $(seq 1 10)' "$script"
grep -Fq 'verify_nginx_route frontend "$app_domain"' "$script"
grep -Fq 'verify_nginx_route backend "$api_domain"' "$script"
grep -Fq "verify_nginx_route frontend \"\$app_domain\" '/health' 'ok'" "$script"
grep -Fq '"service":"startflow-backend"' "$script"
grep -Fq 'timeout --foreground --kill-after=10s 90s' "$script"
grep -Fq 'web services remain active' "$script"
[[ "$(grep -c 'run --interactive=false --no-TTY --rm' "$script")" -eq 6 ]]
if grep -Fq '"${compose[@]}" run --rm' "$script"; then
  printf 'Compose one-off services must not consume the streamed deploy script from stdin.\n' >&2
  exit 1
fi

compose="$repo_root/docker-compose.yml"
compose_prod="$repo_root/docker-compose.prod.yml"
grep -Fq "urlopen('http://127.0.0.1:8000/health'" "$compose"
grep -Fq "command: ['alembic', 'upgrade', 'head']" "$compose"
grep -Fq 'backend-profile-seed:' "$compose_prod"
grep -Fq "command: ['pnpm', '--filter', '@startflow/backend', 'profile:seed']" "$compose_prod"
grep -Fq 'backend-demo-seed:' "$compose_prod"
grep -Fq "command: ['pnpm', '--filter', '@startflow/backend', 'prisma:seed']" "$compose_prod"
grep -Fq 'backend-identity-seed:' "$compose_prod"
grep -Fq "command: ['pnpm', '--filter', '@startflow/backend', 'identity:seed']" "$compose_prod"
grep -Fq 'STARTFLOW_ENABLE_IDENTITY_SEED' "$script"
grep -Fq 'ai-seed:' "$compose"
if grep -Fq 'alembic upgrade head && python -m src.rag.ingest' "$compose"; then
  printf 'AI seed must not be coupled to schema migration.\n' >&2
  exit 1
fi

frontend_nginx="$repo_root/infra/deploy/nginx/frontend.conf.template"
backend_nginx="$repo_root/infra/deploy/nginx/backend.conf.template"
grep -Fq 'X-Frame-Options "SAMEORIGIN"' "$frontend_nginx"
grep -Fq "frame-ancestors 'self'" "$frontend_nginx"
grep -Fq 'X-Frame-Options "DENY"' "$backend_nginx"
if grep -Fq 'X-Frame-Options "DENY"' "$frontend_nginx"; then
  printf 'Frontend DENY blocks the same-origin Keycloak silent SSO iframe.\n' >&2
  exit 1
fi

printf 'standalone deploy static tests passed.\n'
