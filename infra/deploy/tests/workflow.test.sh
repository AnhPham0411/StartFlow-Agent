#!/usr/bin/env bash
set -Eeuo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
workflow="$repo_root/.github/workflows/deploy.yml"

grep -Fq 'DROPLET_SSH_KNOWN_HOSTS' "$workflow"
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

printf 'standalone workflow static tests passed.\n'
