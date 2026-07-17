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

printf 'standalone deploy static tests passed.\n'
