#!/usr/bin/env bash
set -Eeuo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
workflow="$repo_root/.github/workflows/deploy.yml"
dockerfile="$repo_root/frontend/Dockerfile"
nginx_config="$repo_root/frontend/nginx.conf"
frontend_proxy_config="$repo_root/infra/deploy/nginx/frontend.conf.template"
compose_file="$repo_root/docker-compose.yml"
angular_config="$repo_root/frontend/angular.json"
production_environment="$repo_root/frontend/src/environments/environment.production.ts"
root_dockerignore="$repo_root/.dockerignore"
readme="$repo_root/ReadMe.md"
deployment_docs="$repo_root/docs/deployment.md"

grep -Fq 'DROPLET_SSH_KNOWN_HOSTS' "$workflow"
grep -Fq 'startflow-backend:$IMAGE_TAG' "$workflow"
grep -Fq 'startflow-frontend:$IMAGE_TAG' "$workflow"
grep -Fq 'infra/deploy/prepare-env.sh' "$workflow"
grep -Fq 'infra/deploy/deploy.sh' "$workflow"
grep -Fq 'STARTFLOW_DROPLET_ROOT' "$workflow"
grep -Fq 'DROPLET_PATH=%s/%s' "$workflow"
grep -Fq "github.event.workflow_run.event == 'push'" "$workflow"
grep -Fq "github.event_name == 'workflow_run' &&" "$workflow"
grep -Fq 'github.event.workflow_run.head_repository.full_name == github.repository' "$workflow"
grep -Fq 'is_safe_absolute_path "$DROPLET_ROOT"' "$workflow"
grep -Fq 'is_safe_absolute_path "$droplet_path"' "$workflow"
grep -Fq 'is_safe_absolute_path "$DROPLET_PATH"' "$workflow"
grep -Fq 'umask 077' "$workflow"
grep -Fq 'chmod 600 .deploy/release.tar.gz' "$workflow"
grep -Fq 'install -d -m 700' "$workflow"
grep -Fq 'scp -p -o BatchMode=yes' "$workflow"
grep -Fq "chmod 600 '\$remote_archive'" "$workflow"
grep -Fq 'id: upload_release' "$workflow"
grep -Fq "always() && steps.upload_release.outcome == 'success'" "$workflow"
grep -Fq "rm -f -- '\$remote_archive'" "$workflow"

grep -Fq 'nginxinc/nginx-unprivileged:' "$dockerfile"
grep -Fq '/workspace/frontend/dist/startflow/browser/' "$dockerfile"
grep -Fq 'USER 101' "$dockerfile"
grep -Fq 'listen 3000;' "$nginx_config"
grep -Fq 'location = /health' "$nginx_config"
grep -Fq 'location = /app-config.json' "$nginx_config"
grep -A 2 -F 'location = /app-config.json' "$nginx_config" | grep -Fq 'return 404;'
grep -Fq 'try_files $uri $uri/ /index.html;' "$nginx_config"
grep -Fq 'location ~* "/[^/]+-[a-z0-9]{8,}' "$nginx_config"
grep -Fq 'Cache-Control "public, max-age=3600"' "$nginx_config"
grep -Fq 'Content-Security-Policy' "$nginx_config"
grep -Fq 'Content-Security-Policy' "$frontend_proxy_config"
grep -Fq 'src/environments/environment.production.ts' "$angular_config"
grep -Fq "apiUrl: 'https://startflow-api.cloudsolution.vn/api'" "$production_environment"
grep -Fq 'STARTFLOW_BUILD_CONFIGURATION' "$dockerfile"
if grep -Eq 'STARTFLOW_(API_URL|AUTH_MODE|KEYCLOAK_)' "$compose_file"; then
  echo 'Compose must not inject Angular public configuration at container startup.' >&2
  exit 1
fi
if grep -Fq 'app-config.json' "$dockerfile"; then
  echo 'Frontend image must not package a runtime app-config.json template or generator.' >&2
  exit 1
fi
grep -Fxq '**/.angular' "$root_dockerignore"
grep -Fxq '.deploy' "$root_dockerignore"
grep -Fxq '**/.env' "$root_dockerignore"
grep -Fxq '**/.env.*' "$root_dockerignore"
grep -Fxq '!.env.example' "$root_dockerignore"
grep -Fxq '!.env.production.example' "$root_dockerignore"
grep -Fxq '**/*.crt' "$root_dockerignore"
grep -Fxq '**/*.pem' "$root_dockerignore"
grep -Fxq '**/*.key' "$root_dockerignore"
grep -Fxq '**/*.p12' "$root_dockerignore"
grep -Fxq '**/*.pfx' "$root_dockerignore"
grep -Fq "\$env:STARTFLOW_ENV_FILE='.env.example'" "$readme"
grep -Fq 'STARTFLOW_ENV_FILE=.env.example docker compose --env-file .env.example config --quiet' "$deployment_docs"
grep -Fq 'STARTFLOW_ENV_FILE=.env.production.example docker compose --env-file .env.production.example -f docker-compose.yml -f docker-compose.prod.yml config --quiet' "$deployment_docs"

node_base="$(grep -m 1 '^FROM node:' "$dockerfile")"
[[ "$node_base" =~ ^FROM[[:space:]]node:22\.23\.1-alpine3\.24@sha256:[0-9a-f]{64}[[:space:]]AS[[:space:]]dependencies$ ]]
nginx_base="$(grep -m 1 '^FROM nginxinc/nginx-unprivileged:' "$dockerfile")"
[[ "$nginx_base" =~ @sha256:[0-9a-f]{64}[[:space:]]AS[[:space:]]runner$ ]]

owned_files=(
  "$workflow"
  "$dockerfile"
  "$repo_root/docker-compose.yml"
  "$repo_root/docker-compose.prod.yml"
  "$repo_root/.env.example"
  "$repo_root/.env.production.example"
  "$repo_root/infra/deploy/prepare-env.sh"
  "$repo_root/infra/deploy/deploy.sh"
)

retired_public_prefix='NEXT''_PUBLIC_'
if grep -Fq "$retired_public_prefix" "${owned_files[@]}"; then
  echo 'Angular deployment assets must not reference the retired frontend build variables.' >&2
  exit 1
fi

if grep -Eq 'STARTFLOW_(API_URL|AUTH_MODE|KEYCLOAK_)' "${owned_files[@]}"; then
  echo 'Deployment assets must not require retired frontend runtime variables.' >&2
  exit 1
fi

if grep -Fq 'devops-config' "$workflow"; then
  echo 'StartFlow deploy must be self-contained.' >&2
  exit 1
fi

if grep -Fq 'ssh-keyscan' "$workflow"; then
  echo 'Workflow must not trust ssh-keyscan output at deploy time.' >&2
  exit 1
fi

printf 'standalone Angular/Nginx workflow static tests passed.\n'
