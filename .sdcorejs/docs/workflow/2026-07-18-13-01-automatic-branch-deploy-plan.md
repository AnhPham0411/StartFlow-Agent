# Plan - Automatic branch-aware deployment - 2026-07-18 13:01

## Scope

Replace the default-branch-dependent `workflow_run` chain with a local reusable deploy workflow called by CI after every required job succeeds. Preserve manual dispatch, branch-to-environment mapping, current secret names, and the standalone droplet deployment implementation.

## Execution context

- Track: workflow
- Target root kind: target-project
- Stack profile: general
- Coverage approach: TDD
- Parallel candidates: no; the workflow caller, callee, and contract test form one small ordered change

```yaml
plan_context:
  source: sdcorejs-plan
  contract_id: workflow-automatic-branch-deploy-v1
  requirement_id: req-workflow-automatic-branch-deploy-20260718
  approved_spec_path: .sdcorejs/specs/workflow/2026-07-18-13-00-automatic-branch-deploy.md
  approved_spec_hash: 064eb289318d015d6804084c5299366b406fb23a2c35f0216f2f5b23a094de7c
  approved_plan_path: .sdcorejs/plans/workflow/2026-07-18-13-04-automatic-branch-deploy.md
  approved_plan_hash: 0af080184421664fe5519528991816fc9fd04460c09f4fc1b6d146774ec6cc78
  supersedes: null
  target_root: C:/Users/nghiatt15_onemount/Documents/StartFlow-Agent
  target_root_kind: target-project
  track: workflow
  stack_profile: general
  task_count: 6
  phase_count: 3
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
  generated_artifacts: []
  docs_artifacts:
    - .sdcorejs/docs/workflow/2026-07-18-12-59-automatic-branch-deploy-spec.md
    - .sdcorejs/specs/workflow/2026-07-18-13-00-automatic-branch-deploy.md
    - .sdcorejs/docs/workflow/2026-07-18-13-01-automatic-branch-deploy-plan.md
    - .sdcorejs/plans/workflow/2026-07-18-13-01-automatic-branch-deploy.md
  dependency_changes:
    required: false
    packages: []
    approval_required: false
  env_changes:
    required: false
    files: []
    approval_required: false
  migration_changes:
    required: false
    description: null
    approval_required: false
  verification_strategy:
    package_manager: pnpm
    scripts_detected:
      - name: format:check
      - name: lint
      - name: typecheck
      - name: test
      - name: build
    commands_planned:
      - command_or_script: bash infra/deploy/tests/workflow.test.sh
        reason: prove reusable-workflow wiring, CI dependency gates, branch mapping, and secret contract
      - command_or_script: pnpm format:check
        reason: validate YAML, Bash, and Markdown formatting
      - command_or_script: pnpm lint
        reason: retain workspace static quality
      - command_or_script: pnpm typecheck
        reason: retain TypeScript contracts
      - command_or_script: pnpm test
        reason: run the complete existing regression suite
      - command_or_script: pnpm build
        reason: retain production build readiness
      - command_or_script: docker compose --env-file .env.example config --quiet
        reason: retain standalone deployment Compose validity
    commands_skipped:
      - command_or_probe: actionlint
        reason: not installed and no new dependency or downloaded probe is approved
      - command_or_probe: local Docker image build
        reason: Docker daemon is unavailable; GitHub Actions remains the manual post-push criterion
    focused_checks:
      - workflow contract test fails before implementation and passes afterward
      - deploy workflow contains workflow_call and workflow_dispatch but no workflow_run
      - CI deploy caller needs every required CI job and is push-only
    broad_checks:
      - pnpm quality, test, and build scripts
      - Compose configuration
      - GitHub Actions run after push
  parallel_candidates:
    allowed: false
    units: []
    shared_files:
      - path: .github/workflows/ci.yml
        coordination_strategy: sequential
      - path: .github/workflows/deploy.yml
        coordination_strategy: sequential
      - path: infra/deploy/tests/workflow.test.sh
        coordination_strategy: sequential
    conflict_risks:
      - caller and callee expressions must be changed in lock-step
  finish_tail:
    docs_before_final_branch_ready: true
    branch_ready_final_gate: true
  approval:
    approved: true
    approved_at: 2026-07-18T13:04:07+07:00
  change_control:
    revision: 1
    supersedes: null
    change_reason: null
```

## Tasks

### Phase 1 - Preflight and RED contract

1. VERIFY `git status`, branch, HEAD, staged/unstaged/untracked files, and the approved allowed/prohibited path boundary before edits.
2. EDIT `infra/deploy/tests/workflow.test.sh` - add failing assertions for `workflow_call`, removal of `workflow_run`, full CI `needs`, push-only deployment, branch mapping, manual dispatch, and current secret names; run it to capture RED.

### Phase 2 - Workflow implementation

3. EDIT `.github/workflows/deploy.yml` - expose the existing deployment implementation through `workflow_call`, retain `workflow_dispatch`, validate target/release inputs, and map environments/secrets without legacy names.
4. EDIT `.github/workflows/ci.yml` - add the final push-only reusable-workflow caller with explicit `needs` on all CI jobs, branch target mapping, release SHA, and inherited secrets.

### Phase 3 - Verification and delivery

5. VERIFY `infra/deploy/tests/workflow.test.sh`, formatting, lint, typecheck, complete tests, build, Compose config, secret scan, and final diff hygiene; record unavailable Docker/actionlint probes as skipped rather than passed.
6. VERIFY branch-ready, create one scoped Conventional Commit, push only `dev`, then manually observe that the same commit's CI calls `Deploy development` using the new workflow.

## Acceptance mapping

- AC-001 -> tasks 2, 4, 5, 6
- AC-002 -> tasks 2, 3, 4, 5
- AC-003 -> tasks 2, 4, 5
- AC-004 -> tasks 2, 3, 4, 5
- AC-005 -> tasks 2, 3, 5
- AC-006 -> tasks 2, 3, 5
- AC-007 -> tasks 5, 6

## Verification

- `bash infra/deploy/tests/workflow.test.sh`
- `pnpm format:check`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- `docker compose --env-file .env.example config --quiet`
- Manual: confirm the pushed `dev` commit runs `Deploy development` only after all CI jobs succeed.
