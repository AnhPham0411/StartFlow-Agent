# Spec - Automatic branch-aware deployment - 2026-07-18 12:59

```yaml
spec_context:
  source: sdcorejs-spec
  contract_id: workflow-automatic-branch-deploy-v1
  requirement_id: req-workflow-automatic-branch-deploy-20260718
  approved_spec_path: .sdcorejs/specs/workflow/2026-07-18-13-00-automatic-branch-deploy.md
  approved_spec_hash: 064eb289318d015d6804084c5299366b406fb23a2c35f0216f2f5b23a094de7c
  supersedes: null
  target_root: C:/Users/nghiatt15_onemount/Documents/StartFlow-Agent
  target_root_kind: target-project
  track: workflow
  stack_profile: general
  profile_confidence: high
  source_requirement_context: confirmed choice 1 in conversation
  acceptance_criteria_count: 7
  manual_criteria_count: 1
  non_goals:
    - modify devops-config or any other repository
    - provision PostgreSQL, Keycloak, DNS, TLS certificates, or droplet packages
  risks:
    - a push to dev will automatically deploy after CI passes
    - reusable workflow secret and environment propagation must remain explicit
  assumptions:
    - dev uses development with STARTFLOW_DEV and SSH_PRIVATE_KEY_DEV
    - main uses production with STARTFLOW_PROD and SSH_PRIVATE_KEY_PROD
  redaction_applied: true
  approval:
    approved: true
    approved_at: 2026-07-18T13:00:46+07:00
    approval_source: explicit-user-choice
  change_control:
    revision: 1
    supersedes: null
    change_reason: null
```

## Problem & Goals

`workflow_run` executes the deploy workflow definition from the default branch, so a successful CI run on `dev` can still use stale secret names and deployment logic from `main`. Deployment must use the workflow version from the same commit as the CI caller, start only after every required CI job passes, and automatically select the correct GitHub Environment and secret pair for `dev` or `main`.

## Non-goals

- Do not change application runtime code, Compose topology, database, authentication, DNS, or Nginx behavior.
- Do not edit or invoke `devops-config`.
- Do not add third-party deployment actions or new dependencies.

## Architecture

The existing CI workflow remains the push and pull-request entry point. On a branch push, a final `deploy` job waits for all quality, test, Docker, secret-safety, and deployment-asset jobs, then calls `.github/workflows/deploy.yml` as a local reusable workflow using `workflow_call` and `secrets: inherit`.

The reusable workflow receives the target environment and release SHA from CI. It maps `dev` to GitHub Environment `development` and `main` to `production`. `workflow_dispatch` remains available for an explicit manual run on a selected branch. Pull requests never call deployment.

## Stack profile and technology assumptions

- Track: workflow
- Stack profile: general
- Profile evidence: GitHub Actions workflows, Bash deployment scripts, pnpm monorepo
- Technology assumptions: local reusable workflows are resolved from the caller commit; existing repository secrets are inherited without persisting values

## File structure

- `.github/workflows/ci.yml` - add the branch-aware deploy caller after all required CI jobs.
- `.github/workflows/deploy.yml` - replace `workflow_run` with `workflow_call` while retaining manual dispatch.
- `infra/deploy/tests/workflow.test.sh` - lock branch mapping, dependency ordering, reusable-workflow wiring, and current secret names.

## Acceptance criteria

- AC-001 - A push to `dev` invokes deployment only after every required CI job succeeds and selects target `dev` with GitHub Environment `development`.
- AC-002 - A push to `main` invokes deployment only after every required CI job succeeds and selects target `prod` with GitHub Environment `production`.
- AC-003 - Pull-request CI never invokes deployment.
- AC-004 - The deploy implementation is called through a same-repository reusable workflow and no longer depends on `workflow_run` or the default-branch workflow definition.
- AC-005 - Development reads only `STARTFLOW_DEV` and `SSH_PRIVATE_KEY_DEV`; production reads only `STARTFLOW_PROD` and `SSH_PRIVATE_KEY_PROD`.
- AC-006 - `workflow_dispatch` remains available and deploys the explicitly selected branch with matching environment mapping.
- AC-007 - Automated workflow contract tests, YAML/Compose validation, and existing project quality checks pass; the resulting GitHub Actions deployment is manually verified after push. **Manual criterion:** observe the `Deploy development` job for the pushed `dev` commit.

## Risks & mitigations

- **Risk:** Deployment starts before a required quality gate finishes. -> **Mitigation:** enumerate every required CI job in `needs` and test the dependency contract.
- **Risk:** Secrets cross environments. -> **Mitigation:** keep target validation and mutually exclusive secret selection inside the reusable workflow; never write values into tracked files or logs.
- **Risk:** Manual dispatch deploys the wrong branch. -> **Mitigation:** derive release SHA and target from the selected dispatch ref and validate `dev`/`main` explicitly.

## Out of scope (deferred)

- Production deployment verification - defer until production secrets and a deliberate `main` release are approved.
- TLS certificate provisioning - defer to droplet bootstrap/operations because the current deploy remains fail-closed when certificates are absent.
