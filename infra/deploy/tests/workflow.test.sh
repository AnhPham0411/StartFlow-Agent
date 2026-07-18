#!/usr/bin/env bash
set -Eeuo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
workflow="$repo_root/.github/workflows/deploy.yml"
ci_workflow="$repo_root/.github/workflows/ci.yml"

grep -Fq 'workflow_call:' "$workflow"
grep -Fq 'workflow_dispatch:' "$workflow"
if grep -Fq 'workflow_run:' "$workflow"; then
  echo 'Deploy must use the caller branch workflow, not workflow_run from the default branch.' >&2
  exit 1
fi
grep -Fq 'target_env:' "$workflow"
grep -Fq 'release_sha:' "$workflow"
grep -Fq "github.ref_name == 'main' && 'prod' || 'dev'" "$workflow"
grep -Fq 'dev:dev|main:prod)' "$workflow"

grep -Fq 'uses: ./.github/workflows/deploy.yml' "$ci_workflow"
grep -Fq 'needs: [node, python, e2e, docker, secret-safety, deployment-assets]' "$ci_workflow"
grep -Fq "if: github.event_name == 'push'" "$ci_workflow"
grep -Fq 'release_sha: ${{ github.sha }}' "$ci_workflow"
grep -Fq 'secrets: inherit' "$ci_workflow"

grep -Fq 'DROPLET_SSH_KNOWN_HOSTS' "$workflow"
grep -Fq 'secrets.STARTFLOW_DEV' "$workflow"
grep -Fq 'secrets.SSH_PRIVATE_KEY_DEV' "$workflow"
grep -Fq 'env_value DROPLET_HOST' "$workflow"
grep -Fq "'/^DROPLET_HOST=/d'" "$workflow"
grep -Fq 'startflow-backend:$IMAGE_TAG' "$workflow"
grep -Fq 'infra/deploy/prepare-env.sh' "$workflow"
grep -Fq 'infra/deploy/deploy.sh' "$workflow"
grep -Fq 'STARTFLOW_DROPLET_ROOT' "$workflow"
grep -Fq 'DROPLET_PATH=%s/%s' "$workflow"

if grep -Fq 'devops-config' "$workflow"; then
  echo 'StartFlow deploy must be self-contained.' >&2
  exit 1
fi

if grep -Fq 'ssh-keyscan' "$workflow"; then
  echo 'Workflow must not trust ssh-keyscan output at deploy time.' >&2
  exit 1
fi

for old_secret in \
  'secrets.STARTFLOW_ENV }}' \
  'secrets.SSH_PRIVATE_KEY }}' \
  'secrets.DROPLET_HOST' \
  'secrets.DROPLET_USER' \
  'secrets.DROPLET_SSH_KNOWN_HOSTS' \
  'secrets.POSTGRES_TLS_CA_BASE64'; do
  if grep -Fq "$old_secret" "$workflow"; then
    echo "Workflow still references obsolete secret: $old_secret" >&2
    exit 1
  fi
done

printf 'standalone workflow static tests passed.\n'
