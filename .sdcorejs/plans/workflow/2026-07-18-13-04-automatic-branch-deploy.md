---
name: automatic-branch-deploy
description: Implement branch-aware deployment as a reusable workflow called after CI.
approvedAt: 2026-07-18T13:04:07+07:00
approvedBy: nghiatt15@onemount.com
track: workflow
sourceSpecPath: .sdcorejs/specs/workflow/2026-07-18-13-00-automatic-branch-deploy.md
taskCount: 6
phaseCount: 3
target_root_kind: target-project
stack_profile: general
approved_spec_hash: 064eb289318d015d6804084c5299366b406fb23a2c35f0216f2f5b23a094de7c
allowed_paths:
  - .github/workflows/ci.yml
  - .github/workflows/deploy.yml
  - infra/deploy/tests/workflow.test.sh
  - .sdcorejs/docs/workflow/**
  - .sdcorejs/specs/workflow/**
  - .sdcorejs/plans/workflow/**
prohibited_paths:
  - .env
  - .env.*
  - backend/**
  - frontend/**
  - ai-service/**
  - docker-compose.yml
  - docker-compose.prod.yml
  - infra/deploy/deploy.sh
  - infra/deploy/nginx/**
  - package.json
  - pnpm-lock.yaml
  - C:/Users/nghiatt15_onemount/Documents/github-local-solution/devops-config/**
dependency_changes:
  required: false
  approval_required: false
env_changes:
  required: false
  approval_required: false
migration_changes:
  required: false
  approval_required: false
approved_plan_hash: 0af080184421664fe5519528991816fc9fd04460c09f4fc1b6d146774ec6cc78
supersedes: null
change_control:
  revision: 1
  supersedes: null
  change_reason: null
---

# Automatic branch-aware deployment - Approved Plan

> Snapshot of what the user approved at the `sdcorejs-plan` gate. Do not edit by hand; re-author through `sdcorejs-plan` if the contract changes.

## Approved contract

### Scope

Replace the default-branch-dependent `workflow_run` chain with a local reusable deploy workflow called by CI after every required job succeeds. Preserve manual dispatch, branch-to-environment mapping, current secret names, and the standalone droplet deployment implementation.

### Execution context

- Track: workflow
- Target root kind: target-project
- Stack profile: general
- Coverage approach: TDD
- Parallel candidates: no; the workflow caller, callee, and contract test form one small ordered change

### Write boundaries

- Allowed: `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`, `infra/deploy/tests/workflow.test.sh`, and this workflow's `.sdcorejs` spec/plan artifacts.
- Prohibited: runtime env files, application code, Compose files, `infra/deploy/deploy.sh`, Nginx templates, package manifests/lockfiles, and `devops-config`.
- Dependencies, environment files, and migrations: no changes.

### Tasks

#### Phase 1 - Preflight and RED contract

1. VERIFY `git status`, branch, HEAD, staged/unstaged/untracked files, and the approved allowed/prohibited path boundary before edits.
2. EDIT `infra/deploy/tests/workflow.test.sh` - add failing assertions for `workflow_call`, removal of `workflow_run`, full CI `needs`, push-only deployment, branch mapping, manual dispatch, and current secret names; run it to capture RED.

#### Phase 2 - Workflow implementation

3. EDIT `.github/workflows/deploy.yml` - expose the existing deployment implementation through `workflow_call`, retain `workflow_dispatch`, validate target/release inputs, and map environments/secrets without legacy names.
4. EDIT `.github/workflows/ci.yml` - add the final push-only reusable-workflow caller with explicit `needs` on all CI jobs, branch target mapping, release SHA, and inherited secrets.

#### Phase 3 - Verification and delivery

5. VERIFY `infra/deploy/tests/workflow.test.sh`, formatting, lint, typecheck, complete tests, build, Compose config, secret scan, and final diff hygiene; record unavailable Docker/actionlint probes as skipped rather than passed.
6. VERIFY branch-ready, create one scoped Conventional Commit, push only `dev`, then manually observe that the same commit's CI calls `Deploy development` using the new workflow.

### Acceptance mapping

- AC-001 -> tasks 2, 4, 5, 6
- AC-002 -> tasks 2, 3, 4, 5
- AC-003 -> tasks 2, 4, 5
- AC-004 -> tasks 2, 3, 4, 5
- AC-005 -> tasks 2, 3, 5
- AC-006 -> tasks 2, 3, 5
- AC-007 -> tasks 5, 6

### Verification

- `bash infra/deploy/tests/workflow.test.sh`
- `pnpm format:check`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- `docker compose --env-file .env.example config --quiet`
- Manual: confirm the pushed `dev` commit runs `Deploy development` only after all CI jobs succeed.
- Skipped when unavailable: `actionlint` and local Docker image build; neither may be reported as passed.

## Decisions captured during review

- Approved as drafted; execution remains sequential because caller, callee, and contract assertions must change in lock-step.

## Skill provenance

sdcorejs-plan (approved on attempt 1 / 3)
