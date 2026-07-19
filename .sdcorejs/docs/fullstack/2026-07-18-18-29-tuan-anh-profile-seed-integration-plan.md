# Plan - Tích hợp Sales Copilot và seed profile - 2026-07-18 18:29

## Scope

Tích hợp có chọn lọc code Sales Copilot/NBA từ `origin/tuan-anh` trên nền `dev`, giữ Keycloak, PostgreSQL và Qdrant hiện tại làm chuẩn. Đọc Supabase cũ một lần trong local process, chuyển allowlisted demo profile bundle thành seed TypeScript idempotent và tự chạy seed sau Prisma migration trong deploy `dev`.

## Execution context

- Track: `fullstack`
- Target root kind: `target-project`
- Stack profile: `plain-nextjs + plain-nestjs + general`
- Coverage approach: TDD cho schema/seed/auth/service/deploy contract; post-hoc regression cho UI được port.
- Parallel candidates: không; schema, snapshot seed, backend contract, frontend types và deploy order phụ thuộc chặt, và user chưa yêu cầu phân công sub-agent.

```yaml
plan_context:
  source: sdcorejs-plan
  contract_id: startflow-tuan-anh-integration-v1
  requirement_id: startflow-tuan-anh-integration
  approved_spec_path: .sdcorejs/specs/fullstack/2026-07-18-18-26-tuan-anh-profile-seed-integration.md
  approved_spec_hash: ae52351a0845803662434d455aa4d232a86cddaa41f7b19e769755e74f2cfb09
  approved_plan_path: .sdcorejs/plans/fullstack/2026-07-18-18-34-tuan-anh-profile-seed-integration.md
  approved_plan_hash: d91a17f300ec493363ba5f0916360e8d9e063c55a9bb34dc4bd2b10963fec719
  supersedes: null
  target_root: C:/Users/nghiatt15_onemount/Documents/StartFlow-Agent
  target_root_kind: target-project
  track: fullstack
  stack_profile: plain-nextjs + plain-nestjs + general
  task_count: 12
  phase_count: 6
  allowed_paths:
    - backend/package.json
    - backend/prisma/**
    - backend/src/**
    - backend/test/**
    - frontend/app/**
    - frontend/src/**
    - frontend/tests/**
    - ai-service/src/**
    - ai-service/tests/**
    - packages/contracts/src/**
    - packages/contracts/test/**
    - docker-compose.prod.yml
    - infra/deploy/deploy.sh
    - infra/deploy/tests/**
    - docs/BUILD_SPEC.md
    - docs/prd.md
    - .sdcorejs/docs/fullstack/**
    - .sdcorejs/specs/fullstack/**
    - .sdcorejs/plans/fullstack/**
  prohibited_paths:
    - C:/Users/nghiatt15_onemount/Documents/github-local-solution/devops-config/**
    - .env
    - .env.*.local
    - apps/ai/**
    - ai.log
    - docs/DEV_PREVIEW.md
    - docs/schema_v1_1.sql
    - docs/migrations/**
    - node_modules/**
    - backend/dist/**
    - frontend/.next/**
    - any file containing credential values or raw source payload outside the approved seed allowlist
  generated_artifacts:
    - backend/node_modules/.prisma/**
    - backend/dist/**
    - frontend/.next/**
    - temporary source export under the OS temporary directory; delete after seed generation
  docs_artifacts:
    - .sdcorejs/docs/fullstack/2026-07-18-18-20-tuan-anh-profile-seed-integration-spec.md
    - .sdcorejs/specs/fullstack/2026-07-18-18-26-tuan-anh-profile-seed-integration.md
    - .sdcorejs/docs/fullstack/2026-07-18-18-29-tuan-anh-profile-seed-integration-plan.md
    - approved plan snapshot created only after approval
    - docs/BUILD_SPEC.md
    - docs/prd.md
  dependency_changes:
    required: false
    packages: []
    approval_required: false
  package_manifest_changes:
    required: true
    files:
      - backend/package.json
    description: Add a profile seed script only; do not add dependencies or modify pnpm-lock.yaml.
    approval_required: true
  env_changes:
    required: false
    files: []
    approval_required: false
  migration_changes:
    required: true
    description: Add forward-only Prisma schema/migration for the allowlisted Sales Copilot profile bundle without pgvector.
    approval_required: true
  verification_strategy:
    package_manager: pnpm
    scripts_detected:
      - name: ci:prepare
      - name: format:check
      - name: lint
      - name: typecheck
      - name: test
      - name: test:e2e
      - name: build
      - name: prisma:generate
      - name: prisma:migrate:deploy
    commands_planned:
      - command_or_script: pnpm ci:prepare
        reason: Build shared contracts and regenerate Prisma client for the expanded schema.
      - command_or_script: pnpm format:check
        reason: Verify repository formatting without rewriting after implementation.
      - command_or_script: pnpm lint
        reason: Run detected TypeScript/ESLint quality checks across workspaces.
      - command_or_script: pnpm typecheck
        reason: Verify backend/frontend/shared type contracts.
      - command_or_script: pnpm test
        reason: Run detected contracts, backend and frontend regression suites.
      - command_or_script: pnpm build
        reason: Build production artifacts for all Node workspaces.
      - command_or_script: pnpm test:e2e
        reason: Exercise critical authenticated UI journeys when the existing browser runtime is available.
      - command_or_script: uv run ruff check . && uv run mypy src && uv run pytest
        reason: Match the Python CI quality and test gates from the existing workflow.
      - command_or_script: docker compose --env-file .env.example config --quiet
        reason: Validate the production service/seed composition contract without starting infrastructure.
      - command_or_script: bash infra/deploy/tests/prepare-env.test.sh && bash infra/deploy/tests/deploy.test.sh && bash infra/deploy/tests/workflow.test.sh
        reason: Verify env validation and migration-seed-rollout order using the existing CI contract tests.
      - command_or_script: git diff --check
        reason: Detect whitespace and patch integrity issues before ship review.
    commands_skipped:
      - command_or_probe: local docker compose build
        reason: Run only when the local Docker daemon is available; GitHub CI already owns the mandatory image build.
      - command_or_probe: direct mutation of the target database before deploy
        reason: Target writes must occur through the approved migration/seed deployment path with rollback-safe ordering.
    focused_checks:
      - Source schema/count/read-only export audit without printing the legacy DSN.
      - Generated seed scan for credentials, auth records and non-allowlisted sensitive fields.
      - Seed twice against an isolated test schema with identical counts/checksum and no delete/truncate.
      - Keycloak token role remains authoritative when application profile metadata disagrees.
      - Deploy contract asserts migration then seed then rollout, with seed failure stopping rollout.
    broad_checks:
      - Full Node and Python CI-equivalent quality gates.
      - Production build and Compose configuration.
      - Live frontend/backend health, Keycloak SSO and NBA page smoke after GitHub Actions deploy.
      - Source snapshot manifest and target count/checksum reconciliation.
  parallel_candidates:
    allowed: false
    units: []
    shared_files:
      - path: backend/prisma/schema.prisma and backend/prisma/profile-seed.ts
        coordination_strategy: sequential
      - path: packages/contracts/src/** and backend/frontend API types
        coordination_strategy: lock-step
      - path: docker-compose.prod.yml and infra/deploy/deploy.sh
        coordination_strategy: lock-step
      - path: frontend/src/auth/** and backend/src/modules/auth/**
        coordination_strategy: lock-step
    conflict_risks:
      - Ported NBA code may assume the source schema or database role is an auth role.
      - Snapshot seed and migration can diverge if generated before final schema mapping.
      - Dev deployment can replace healthy containers if seed ordering is implemented after rollout.
  finish_tail:
    docs_before_final_branch_ready: true
    branch_ready_final_gate: true
  approval:
    approved: true
    approved_at: 2026-07-18T18:34:04+07:00
  change_control:
    revision: 1
    supersedes: null
    change_reason: null
```

## Tasks

### Phase 1 - Preflight và snapshot nguồn an toàn

1. COMMAND `git status --short`, staged/unstaged diffstat, untracked files, current branch/HEAD, `git fetch origin tuan-anh`, allowed/prohibited path audit - xác nhận working tree chỉ có spec/plan artifacts thuộc scope, branch `dev` đúng HEAD và không chạm unrelated user changes; nếu có dirty file ngoài scope thì dừng theo ba lựa chọn của execution preflight.
2. COMMAND local read-only exporter với input credential đọc trong memory từ Git object `origin/tuan-anh` và output tạm ngoài repository - kiểm tra source schema/count, chỉ xuất allowlisted demo tables/columns theo FK order, loại auth/secrets/`rag_cases`, không in DSN/raw payload và xóa file tạm sau khi tạo seed.

### Phase 2 - Schema và seed theo TDD

3. CREATE `backend/test/profile-seed.spec.ts`; EDIT `backend/prisma/schema.prisma`; CREATE `backend/prisma/migrations/20260718190000_sales_copilot_profile_bundle/migration.sql` - viết RED tests cho mapping, FK, Keycloak-owned roles, no-delete/idempotency; tạo schema/migration forward-only cho profile bundle cần thiết mà không pgvector.
4. CREATE `backend/prisma/profile-seed.ts`; EDIT `backend/package.json` - sinh một seed TypeScript tự chứa snapshot demo đã allowlist, upsert transaction theo stable keys, ghi manifest version/checksum/count, không delete/truncate; chạy hai lần trên isolated schema để chuyển test từ RED sang GREEN.

### Phase 3 - Sanitized integration backend, frontend và AI

5. CREATE `backend/src/modules/nba/**`; EDIT `backend/src/app.module.ts`, `backend/src/modules/auth/**`, `backend/src/common/types/request-context.ts`, `backend/test/jwt-auth.guard.spec.ts`; CREATE/EDIT focused NBA tests - port có chọn lọc API/assessment/policy, thay source-specific raw assumptions bằng Prisma schema đích, map Keycloak identity sang profile metadata và tuyệt đối không lấy DB role làm auth authority.
6. CREATE `frontend/app/nba/**`, `frontend/src/features/nba/**`, `frontend/src/lib/nba-assessment.types.ts`; EDIT `frontend/app/page.tsx`, `frontend/app/dashboard/page.tsx`, `frontend/app/layout.tsx`, `frontend/app/globals.css`, `frontend/src/auth/auth-context.tsx`, `frontend/src/components/layout/app-shell.tsx`, `frontend/src/lib/api-client.ts`; CREATE/EDIT frontend NBA/auth tests - port UI Sales Copilot, giữ Keycloak access token/silent SSO và loại mock role switcher khỏi runtime deploy.
7. EDIT `packages/contracts/src/**`, `ai-service/src/api/**`, `ai-service/src/core/**`, `ai-service/src/graph/**`; CREATE/EDIT focused contract/Python tests - chỉ port các contract/orchestration cần cho NBA và tương thích AI service hiện tại; không import `apps/ai`, hardcoded migration script, Supabase runtime hoặc pgvector.

### Phase 4 - Deploy-time migration và seed

8. EDIT `docker-compose.prod.yml`, `infra/deploy/deploy.sh`, `infra/deploy/tests/deploy.test.sh` - thêm one-off backend profile seed service và bắt buộc thứ tự `backend-migrate -> profile-seed -> rollout`; seed fail thì job fail trước khi thay containers healthy; giữ AI/Qdrant seed policy hiện tại độc lập.
9. CREATE `docs/BUILD_SPEC.md`, `docs/prd.md` from the safe, relevant branch content - ghi chuẩn Keycloak/PostgreSQL/Qdrant và one-time seed, loại Supabase runtime instructions, credential và duplicate schema SQL; hoàn tất execution evidence trước final readiness.

### Phase 5 - Verification, review và branch readiness

10. COMMAND focused seed/auth/NBA/deploy tests, `pnpm ci:prepare`, `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, Python CI commands, Compose config, deploy contract tests và `pnpm test:e2e` khi runtime cho phép - sửa finding theo repair loop cho tới khi pass hoặc báo blocker cụ thể.
11. COMMAND secret/PII/Supabase/pgvector scan, full diff review, migration/seed dry-run evidence, `git diff --check` và verify-before-done/branch-ready - xác nhận không có source credential, `apps/ai`, `ai.log`, Supabase runtime, unrelated file hay write-producing step còn lại sau gate.

### Phase 6 - Commit, push, deploy và live reconciliation

12. COMMAND scoped commit trên `dev`, push `origin/dev`, theo dõi GitHub Actions deploy và chạy read-only live checks - xác nhận frontend/backend HTTP 200, Keycloak login/silent SSO, NBA route/API, container health, migration/seed manifest và source-snapshot/target counts/checksum; không sửa source sau final branch-ready.

## Acceptance mapping

- AC-001 -> tasks 1, 5-7, 11-12.
- AC-002 -> tasks 1-2, 7, 9, 11.
- AC-003 -> tasks 3, 5-6, 10-12.
- AC-004 -> tasks 3, 7-8, 10.
- AC-005 -> tasks 2, 4, 11.
- AC-006 -> tasks 3-4, 10.
- AC-007 -> tasks 2, 4, 8, 11-12.
- AC-008 -> tasks 8, 10, 12.
- AC-009 -> tasks 2, 8-9, 11-12.
- AC-010 -> tasks 3, 7, 10-11.
- AC-011 -> tasks 3-5, 10, 12.
- AC-012 -> tasks 5-6, 10, 12.
- AC-013 -> tasks 10-11.
- AC-014 -> task 12.

## Verification

- Focused: seed mapping/idempotency/checksum, Keycloak role authority, NBA service/controller/UI and deploy-order tests.
- Node: `pnpm ci:prepare`, `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm test:e2e` khi browser runtime sẵn sàng.
- Python: `uv run ruff check .`, `uv run mypy src`, `uv run pytest` trong `ai-service`.
- Deployment: `docker compose --env-file .env.example config --quiet` và ba Bash tests dưới `infra/deploy/tests`.
- Security: scan diff/generated seed cho credential, auth data, raw source payload, Supabase runtime, pgvector, `apps/ai` và `ai.log`.
- Manual/live: GitHub Actions deploy `dev`, HTTP health, Keycloak SSO, NBA UI/API, container status và seed manifest/count/checksum reconciliation.
