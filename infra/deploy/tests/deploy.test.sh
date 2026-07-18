#!/usr/bin/env bash
set -Eeuo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
script="$repo_root/infra/deploy/deploy.sh"

bash -n "$script"

backend_migration_line="$(grep -n 'run --interactive=false --no-TTY --rm backend-migrate' "$script" | cut -d: -f1)"
ai_migration_line="$(grep -n 'run --interactive=false --no-TTY --rm ai-migrate' "$script" | cut -d: -f1)"
up_line="$(grep -n 'up -d backend ai-service frontend' "$script" | head -n 1 | cut -d: -f1)"
ai_seed_line="$(grep -n 'run --interactive=false --no-TTY --rm ai-seed' "$script" | cut -d: -f1)"

[[ "$backend_migration_line" -lt "$up_line" ]]
[[ "$ai_migration_line" -lt "$up_line" ]]
[[ "$ai_seed_line" -gt "$up_line" ]]
grep -Fq 'trap rollback EXIT' "$script"
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
grep -Fq '"service":"startflow-frontend"' "$script"
grep -Fq '"service":"startflow-backend"' "$script"
grep -Fq 'timeout --foreground --kill-after=10s 90s' "$script"
grep -Fq 'web services remain active' "$script"
[[ "$(grep -c 'run --interactive=false --no-TTY --rm' "$script")" -eq 3 ]]
if grep -Fq '"${compose[@]}" run --rm' "$script"; then
  printf 'Compose one-off services must not consume the streamed deploy script from stdin.\n' >&2
  exit 1
fi

compose="$repo_root/docker-compose.yml"
grep -Fq "urlopen('http://127.0.0.1:8000/health'" "$compose"
grep -Fq "command: ['alembic', 'upgrade', 'head']" "$compose"
grep -Fq 'ai-seed:' "$compose"
if grep -Fq 'alembic upgrade head && python -m src.rag.ingest' "$compose"; then
  printf 'AI seed must not be coupled to schema migration.\n' >&2
  exit 1
fi

frontend_nginx="$repo_root/infra/deploy/nginx/frontend.conf.template"
backend_nginx="$repo_root/infra/deploy/nginx/backend.conf.template"
grep -Fq 'X-Frame-Options "SAMEORIGIN"' "$frontend_nginx"
grep -Fq "Content-Security-Policy \"frame-ancestors 'self'\"" "$frontend_nginx"
grep -Fq 'X-Frame-Options "DENY"' "$backend_nginx"
if grep -Fq 'X-Frame-Options "DENY"' "$frontend_nginx"; then
  printf 'Frontend DENY blocks the same-origin Keycloak silent SSO iframe.\n' >&2
  exit 1
fi

printf 'standalone deploy static tests passed.\n'
