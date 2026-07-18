#!/usr/bin/env bash
set -Eeuo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
script="$repo_root/infra/deploy/deploy.sh"

bash -n "$script"

backend_migration_line="$(grep -n 'run --rm backend-migrate' "$script" | cut -d: -f1)"
ai_migration_line="$(grep -n 'run --rm ai-migrate' "$script" | cut -d: -f1)"
up_line="$(grep -n 'up -d backend ai-service frontend' "$script" | head -n 1 | cut -d: -f1)"

[[ "$backend_migration_line" -lt "$up_line" ]]
[[ "$ai_migration_line" -lt "$up_line" ]]
grep -Fq 'trap rollback EXIT' "$script"
grep -Fq '/.well-known/openid-configuration' "$script"
grep -Fq 'Database migrations are forward-only' "$script"
grep -Fq 'startflow-$target_env' "$script"
grep -Fq 'sudo nginx -T' "$script"
grep -Fq '/etc/nginx/sites-enabled/*' "$script"
grep -Fq '/etc/nginx/conf.d/*.conf' "$script"
grep -Fq 'conflicting server name' "$script"
grep -Fq 'server_name $app_domain;' "$script"
grep -Fq 'proxy_pass http://127.0.0.1:$frontend_port;' "$script"
grep -Fq 'server_name $api_domain;' "$script"
grep -Fq 'proxy_pass http://127.0.0.1:$backend_port;' "$script"
grep -Fq -- '--resolve "$domain:443:127.0.0.1"' "$script"
grep -Fq 'verify_nginx_route frontend "$app_domain"' "$script"
grep -Fq 'verify_nginx_route backend "$api_domain"' "$script"
grep -Fq '"service":"startflow-frontend"' "$script"
grep -Fq '"service":"startflow-backend"' "$script"

printf 'standalone deploy static tests passed.\n'
