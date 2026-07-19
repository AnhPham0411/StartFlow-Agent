---
name: nba-customer-identity-platform
description: Executable 32-task fullstack plan for NBA runtime, Customer 360, identity/branch management and demo operations.
approvedAt: "2026-07-19T08:53:45+07:00"
approvedBy: ghost.of.dark.peter@gmail.com
track: fullstack
sourceSpecPath: .sdcorejs/specs/fullstack/2026-07-19-08-53-nba-customer-identity-platform.md
taskCount: 32
phaseCount: 8
---

# NBA Customer & Identity Platform - Approved Plan

> Snapshot of what the user approved at the `sdcorejs-plan` gate. Do not edit by hand; re-author through `sdcorejs-plan` if the contract changes.

## Approved contract

### Scope

Implement the approved NBA M1-M13 processing contract, expose Customer 360 and Operations Center through Angular Core UI, and introduce branch/account management with ADMIN/MANAGER/EMPLOYEE scoping. Preserve the 500-customer/30-user seed and current demo-first capability while replacing static recommendation-only behavior with auditable nightly and mini pipeline execution.

### Execution context

- Track: fullstack (Angular, NestJS, Python/FastAPI, PostgreSQL, Keycloak, Playwright).
- Coverage: RED-first TDD for domain rules, validators, transactions and security; test-as-you-build for Angular UI.
- Parallel candidates: after shared contracts and additive migrations, Customer UI, identity module and Python pipeline may progress independently. Shared schema, auth files, routes and layout must be serialized to avoid conflicts.
- Safety: refresh HEAD/diff before implementation because another process may have changed the shared workspace; preserve unrelated user work.

## Tasks

### Phase 0 - Contract reconciliation and baseline

1. VERIFY source artifacts `MASTER_PLAN v2.1`, `PRD_NGHIEP_VU v1.0`, `FULL_SPEC v3.0` against `C:\Users\Admin\Downloads\AGENT_SPEC.md` - freeze E1-E10, R1-R12, C5 regex/templates and local model selection before domain code.
2. COMMAND `git status --short --branch`, `git log`, scoped tests and current API smoke - refresh the baseline after concurrent work and record conflicts rather than overwriting them.
3. CREATE `docs/nba/business-rules.md` - durable decision ledger for formulas, thresholds, compliance patterns, PII boundary and demo/live deviations.

### Phase 1 - Shared contracts, database and seed foundation

4. CREATE `packages/contracts/src/nba.schemas.ts`; EDIT `packages/contracts/src/index.ts`, `packages/contracts/src/schemas.ts`, `packages/contracts/src/generate-json-schema.ts`; CREATE contract specs - expose canonical roles and NBA/customer/batch/stage/model contracts with generated JSON Schema.
5. CREATE `backend/prisma/migrations/20260719104500_identity_branch_rbac/migration.sql`; EDIT `backend/prisma/schema.prisma` - add branches, employee role, branch/keycloak/active user fields, backfill existing users and enforce role/branch invariants without changing user IDs.
6. CREATE `backend/prisma/migrations/20260719110000_nba_pipeline_runtime/migration.sql` - add batch stages/events, RAG cases, compliance templates, config versions, model artifacts, empty-recommendation support, idempotency and concurrency indexes; verify pgvector capability.
7. EDIT `backend/prisma/profile-seed.ts`, `backend/package.json`, `docker-compose.prod.yml`, `infra/deploy/deploy.sh`; CREATE `backend/scripts/seed-keycloak-identities.ts` - seed 10 branches/30 transformed users and optionally provision Keycloak identities from runtime secrets.
8. CREATE `backend/test/identity-migration.spec.ts`, `backend/test/nba-runtime-migration.spec.ts`, and real-PostgreSQL harness - verify constraints, append-only triggers, partial unique indexes, idempotent seed and concurrent version allocation.

### Phase 2 - Identity, branch management and RBAC

9. EDIT `infra/keycloak/realm.example.json`, `infra/keycloak/README.md`, `.env.example`, `.env.production.example`, `backend/src/config/env.validation.ts` - declare employee/manager/admin roles and a least-privilege Keycloak service account without secrets.
10. CREATE `backend/src/modules/identity/identity.module.ts`, `identity.controller.ts`, `identity.service.ts`, `keycloak-admin.client.ts`, DTOs and mappers; EDIT `backend/src/app.module.ts` - implement branch/account list/create/update/deactivate, enable/disable and temporary-password reset with compensation and audit.
11. EDIT `backend/src/modules/auth/jwt-auth.guard.ts`, `roles.guard.ts`, `roles.decorator.ts`, `backend/src/common/types/request-context.ts` - resolve Keycloak subject to active local profile, enforce effective three-level hierarchy and carry branch scope fail-closed.
12. EDIT controllers under `backend/src/modules/{cases,runs,events,approvals,knowledge,nba}` and NBA scope helpers - map employee to operator actions, manager to branch/approval actions and admin to global actions while retaining temporary legacy aliases.
13. CREATE `frontend/src/app/core/api/identity-api.service.ts`, `identity.models.ts`, `frontend/src/app/features/administration/branches/*`, `frontend/src/app/features/administration/accounts/*`; EDIT routes/layout/permission map - add Core UI branch/account management and manager read-only team view.
14. CREATE `backend/test/identity.service.spec.ts`, `backend/test/keycloak-admin.client.spec.ts`, Angular identity/permission specs and Playwright role-scope cases - cover cross-system rollback, last-admin protection, branch isolation and direct-route denial.

### Phase 3 - Customer 360 and role-aware sales workspace

15. CREATE `backend/src/modules/nba/customers/nba-customers.controller.ts`, `nba-customers.service.ts`, DTOs and tests; EDIT `backend/src/modules/nba/nba.module.ts` - provide scoped server-side pagination, filters, overview, transactions summary, timeline, recommendations and assessment without N+1 queries.
16. CREATE `frontend/src/app/core/api/customer-api.service.ts`, `customer.models.ts`, `frontend/src/app/features/customers/list/*`, `frontend/src/app/features/customers/detail/*` - build Customer list and Customer 360 with financial windows, products, tags/geo, versions, staleness, notes, feedback and audit.
17. EDIT `frontend/src/app/app.routes.ts`, `frontend/src/app/layout/main-layout.component.ts`, permission tests and legacy NBA detail navigation - add `/customers`, `/customers/:customerId`, dedicated Customer menu and backward-compatible route handling.
18. CREATE focused backend/Angular/Playwright customer tests - verify all 500 customers are paginated for admin, branch/assignment scope is enforced and customers without recommendations still render useful empty states.

### Phase 4 - NBA nightly pipeline M1-M8

19. CREATE `ai-service/src/nba/config.py`, `contracts.py`, `repository.py`, `orchestrator.py`, `stages/base.py`, `ai-service/src/api/nba.py`; EDIT `ai-service/src/main.py`, settings and dependencies; CREATE NestJS pipeline client/scheduler/controller - establish internal authenticated run execution, stage retry, timeout and audit events.
20. CREATE `ai-service/src/nba/stages/etl.py`, `geo.py`, `profile.py` and tests - implement M1, deterministic/direct M2 path and M3 versioned merge with NULL and reproducibility guarantees.
21. CREATE `ai-service/src/nba/stages/scoring.py`, `ranker.py`, `call_list.py` and tests - implement M4 vectorized scoring, M5 ordered R1-R12/Top-N and M6 cost gate with performance assertions.
22. CREATE `ai-service/src/nba/stages/extraction.py`, `ai-service/src/nba/clients/local_llm.py`, extraction prompts and tests - implement AG1 preprocessing, strict tagging, output guard, customer aggregation, QA sampling and taxonomy retirement without raw-PII logs.
23. CREATE `ai-service/src/nba/stages/scripting.py`, `validator.py`, `ai-service/src/nba/tools/{catalog,calculators,rag}.py`, domain prompts/templates and tests - implement AG2-AG6 shared engine, tool-owned numbers, self-check, M7 three-layer validation and deterministic fallback.
24. CREATE `ai-service/src/nba/stages/sink.py` and integration tests - implement M8 append-only insert with advisory transaction lock, SHA-256 snapshot, rules/model versions and atomic no-partial behavior.

### Phase 5 - Staleness, mini-pipeline and learning loop

25. EDIT `backend/src/modules/nba/nba.service.ts`; CREATE mini-pipeline controller/service and tests - complete M9 product-aware staleness below 300 ms and M10 big-transaction simulation/customer-only append version with production demo guard.
26. CREATE `ai-service/src/nba/stages/outcome.py` and tests - implement M11 idempotent 30-day outcome join without treating feedback checkbox as label.
27. CREATE `ai-service/src/nba/stages/retrain.py`, `rag_writer.py`, model artifact repository and tests - implement deterministic holdout logistic training, four promotion gates, atomic production flip and masked won/lost RAG cases.

### Phase 6 - Operations Center and show-off demo

28. CREATE `backend/src/modules/nba/operations/*` and `backend/src/modules/nba/admin/*` - expose dashboard, batches/stages, validator logs, tag QA, models/retrain, RAG, catalog, KPI, call-list, geo, config and audit under manager/admin scopes.
29. CREATE Angular pages under `frontend/src/app/features/nba/operations/{batches,compliance,tag-qa,models,rag,audit}` and `frontend/src/app/features/nba/admin/{call-lists,kpi,catalog,geo,parameters}`; EDIT routes/menu/permissions - deliver role-aware Core UI operations without a heavy chart dependency.
30. EDIT `frontend/src/app/features/dashboard/*`; CREATE demo scenario service/components and E2E fixture - provide curated Customer 360 -> big transaction -> live stage lane -> before/after recommendation -> explain/audit -> feedback journey with reliable demo/live badges.

### Phase 7 - Verification, migration rollout and deployment

31. COMMAND full contracts/backend/Python/frontend/E2E/security/performance suite, Docker build, migration/seed replay and `git diff --check` - repair scoped findings until all acceptance gates pass or report a concrete blocker.
32. EDIT deployment docs/env workflow as required; COMMAND additive migration -> profile seed -> identity seed -> backend/AI with scheduler off -> mini canary -> frontend -> smoke -> enable nightly - deploy behind `IDENTITY_ENFORCEMENT_MODE` and NBA feature flags, then verify live RBAC, PII boundary, stage trace and rollback path.

## Acceptance mapping

- AC1-AC9 (three roles, branch/account management, Keycloak and seed) -> tasks 4-14, 31-32.
- AC10 (500-customer Customer 360) -> tasks 15-18, 29-32.
- AC11-AC16 (nightly M1-M8, validation, append-only recommendation) -> tasks 19-24, 28-32.
- AC17 (staleness and mini-run) -> tasks 25, 28-32.
- AC18 (outcome, retrain and RAG) -> tasks 26-29, 31-32.
- AC19 (role-aware Angular and direct-route denial) -> tasks 11-18, 29-32.
- AC20 (show-off demo journey) -> tasks 19-30, 31-32.

## Verification

- `corepack pnpm --filter @startflow/contracts test`
- `corepack pnpm --filter @startflow/backend prisma:generate`
- `corepack pnpm --filter @startflow/backend test`
- `corepack pnpm --filter @startflow/backend build`
- `uv run --project ai-service pytest`
- `uv run --project ai-service ruff check ai-service/src ai-service/tests`
- `uv run --project ai-service mypy ai-service/src`
- `corepack pnpm --filter @startflow/frontend lint`
- `corepack pnpm --filter @startflow/frontend test`
- `corepack pnpm --filter @startflow/frontend build:production`
- `corepack pnpm test:e2e`
- `docker compose build`
- `git diff --check`
- Manual: login as seeded ADMIN/MANAGER/EMPLOYEE, verify branch isolation and account disable; execute the complete Customer 360 mini-pipeline demo; inspect browser console, audit trace, recommendation versions and health/readiness endpoints.

## Decisions captured during review

- Expanded the original NBA draft with a dedicated Customer menu and Customer 360.
- Added role-aware Operations Center and a repeatable demo journey.
- Added branch/account management with exactly three effective roles.
- Chose global ADMIN without branch; MANAGER/EMPLOYEE require exactly one branch.
- Preserved 30 existing user IDs and transformed their role/branch data instead of replacing the profile bundle.
- Keycloak remains authentication source; PostgreSQL is authoritative for active operational scope.

## Skill provenance

sdcorejs-plan (approved on revision 2 / 3)
