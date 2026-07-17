---
name: startflow-hackathon-implementation
description: Kế hoạch đã duyệt để scaffold, kiểm thử và chuẩn bị CI/CD cho StartFlow multi-agent MVP.
approvedAt: "2026-07-17T16:25:57+07:00"
approvedBy: nghiatt15@onemount.com
track: fullstack
sourceSpecPath: .sdcorejs/specs/fullstack/2026-07-17-16-16-startflow-hackathon-multi-agent.md
taskCount: 23
phaseCount: 8
target_root_kind: target-project
stack_profile: general
approved_spec_hash: be8d968b1ff9f260f97681ab0f7d5f94105ed148c96c7f758cea849c92624453
allowed_paths:
  - C:/Users/nghiatt15_onemount/Documents/StartFlow-Agent/{backend,frontend,ai-service,packages,knowledge,infra,test,product,design,docs}/**
  - C:/Users/nghiatt15_onemount/Documents/StartFlow-Agent/{package.json,pnpm-workspace.yaml,pnpm-lock.yaml,tsconfig.base.json,.env.example,.env.production.example,docker-compose.yml,docker-compose.prod.yml,ReadMe.md,START.md}
  - C:/Users/nghiatt15_onemount/Documents/StartFlow-Agent/.github/workflows/{ci,deploy}.yml
  - C:/Users/nghiatt15_onemount/Documents/StartFlow-Agent/.sdcorejs/{docs,documentation,tasks,memories}/**
  - C:/Users/nghiatt15_onemount/Documents/github-local-solution/devops-config/.github/workflows/deploy-startflow-agent.yml
  - C:/Users/nghiatt15_onemount/Documents/github-local-solution/devops-config/{scripts,projects,tests}/**startflow-agent**
  - C:/Users/nghiatt15_onemount/Documents/github-local-solution/devops-config/README.md
prohibited_paths:
  - real .env files, secrets, credentials and certificates
  - StartFlow-Agent/.git/**, .claude/**, ai.log, generated/vendor/build output
  - StartFlow-Agent/.sdcorejs/specs/** and .sdcorejs/plans/**
  - devops-config enterprise-platform workflow/scripts/project files
  - remote droplet state and existing PostgreSQL/Keycloak lifecycle
dependency_changes:
  required: true
  approval_required: true
env_changes:
  required: true
  approval_required: true
migration_changes:
  required: true
  approval_required: true
approved_plan_hash: 93c696114a61fcade9974c04cfd845f0cb91cb4574c43b30759a3e2302fcfb84
supersedes: null
change_control:
  revision: 1
  supersedes: null
  change_reason: null
---

# StartFlow Hackathon Multi-Agent Implementation - Approved Plan

> Snapshot of what the user approved at the `sdcorejs-plan` gate. Do not edit by hand; re-author through `sdcorejs-plan` if the contract changes.

## Approved contract

# Plan - StartFlow Hackathon Multi-Agent Implementation - 2026-07-17 16:23

## Scope

Scaffold và kiểm chứng MVP đánh giá hồ sơ vay doanh nghiệp với Planner, Credit, Compliance và Operations Agent. Hệ thống gồm Next.js dashboard, NestJS API, FastAPI/LangGraph AI service, kết nối PostgreSQL 18 và Keycloak có sẵn qua env, chạy ba application containers và deploy qua reusable GitHub Actions của `devops-config`.

Kế hoạch không provision hoặc restart PostgreSQL/Keycloak, không tích hợp hệ thống ngân hàng thật và không kích hoạt actual droplet deployment khi chưa có GitHub Environment/secrets cùng quyền triển khai riêng.

## Execution context

- Track: `fullstack`.
- Target root kind: `target-project`.
- Stack profile: `general` greenfield; `backend/` và `frontend/` đã tồn tại nhưng trống.
- Coverage approach: TDD cho workflow/domain/security, component/integration tests trong lúc dựng UI và một e2e demo journey.
- Node package manager: `pnpm`, dựa trên `ReadMe.md` và local `pnpm 10.33.2`; không có package manifest/lockfile cũ.
- Python package manager: `uv` qua Docker/CI; local CLI hiện chưa có nên không dùng làm preflight local.
- Parallel candidates: có, sau khi foundation/contracts được khóa; mọi shared manifest, lockfile, Compose và contract file do parent/sequential owner quản lý.

```yaml
plan_context:
  source: sdcorejs-plan
  contract_id: SFA-20260717-001
  requirement_id: SF-HACKATHON-001
  approved_spec_path: .sdcorejs/specs/fullstack/2026-07-17-16-16-startflow-hackathon-multi-agent.md
  approved_spec_hash: be8d968b1ff9f260f97681ab0f7d5f94105ed148c96c7f758cea849c92624453
  approved_plan_path: .sdcorejs/plans/fullstack/2026-07-17-16-25-startflow-hackathon-implementation.md
  approved_plan_hash: 93c696114a61fcade9974c04cfd845f0cb91cb4574c43b30759a3e2302fcfb84
  supersedes: null
  target_root: C:/Users/nghiatt15_onemount/Documents/StartFlow-Agent
  target_root_kind: target-project
  track: fullstack
  stack_profile: general
  task_count: 23
  phase_count: 8
  allowed_paths:
    - C:/Users/nghiatt15_onemount/Documents/StartFlow-Agent/backend/**
    - C:/Users/nghiatt15_onemount/Documents/StartFlow-Agent/frontend/**
    - C:/Users/nghiatt15_onemount/Documents/StartFlow-Agent/ai-service/**
    - C:/Users/nghiatt15_onemount/Documents/StartFlow-Agent/packages/contracts/**
    - C:/Users/nghiatt15_onemount/Documents/StartFlow-Agent/knowledge/seed/**
    - C:/Users/nghiatt15_onemount/Documents/StartFlow-Agent/infra/keycloak/**
    - C:/Users/nghiatt15_onemount/Documents/StartFlow-Agent/test/**
    - C:/Users/nghiatt15_onemount/Documents/StartFlow-Agent/product/**
    - C:/Users/nghiatt15_onemount/Documents/StartFlow-Agent/design/**
    - C:/Users/nghiatt15_onemount/Documents/StartFlow-Agent/docs/**
    - C:/Users/nghiatt15_onemount/Documents/StartFlow-Agent/.sdcorejs/docs/**
    - C:/Users/nghiatt15_onemount/Documents/StartFlow-Agent/.sdcorejs/documentation/**
    - C:/Users/nghiatt15_onemount/Documents/StartFlow-Agent/.sdcorejs/tasks/**
    - C:/Users/nghiatt15_onemount/Documents/StartFlow-Agent/.sdcorejs/memories/**
    - C:/Users/nghiatt15_onemount/Documents/StartFlow-Agent/.github/workflows/ci.yml
    - C:/Users/nghiatt15_onemount/Documents/StartFlow-Agent/.github/workflows/deploy.yml
    - C:/Users/nghiatt15_onemount/Documents/StartFlow-Agent/package.json
    - C:/Users/nghiatt15_onemount/Documents/StartFlow-Agent/pnpm-workspace.yaml
    - C:/Users/nghiatt15_onemount/Documents/StartFlow-Agent/pnpm-lock.yaml
    - C:/Users/nghiatt15_onemount/Documents/StartFlow-Agent/tsconfig.base.json
    - C:/Users/nghiatt15_onemount/Documents/StartFlow-Agent/.editorconfig
    - C:/Users/nghiatt15_onemount/Documents/StartFlow-Agent/.prettierignore
    - C:/Users/nghiatt15_onemount/Documents/StartFlow-Agent/.prettierrc.json
    - C:/Users/nghiatt15_onemount/Documents/StartFlow-Agent/.dockerignore
    - C:/Users/nghiatt15_onemount/Documents/StartFlow-Agent/.gitignore
    - C:/Users/nghiatt15_onemount/Documents/StartFlow-Agent/.env.example
    - C:/Users/nghiatt15_onemount/Documents/StartFlow-Agent/.env.production.example
    - C:/Users/nghiatt15_onemount/Documents/StartFlow-Agent/docker-compose.yml
    - C:/Users/nghiatt15_onemount/Documents/StartFlow-Agent/docker-compose.prod.yml
    - C:/Users/nghiatt15_onemount/Documents/StartFlow-Agent/ReadMe.md
    - C:/Users/nghiatt15_onemount/Documents/StartFlow-Agent/START.md
    - C:/Users/nghiatt15_onemount/Documents/github-local-solution/devops-config/.github/workflows/deploy-startflow-agent.yml
    - C:/Users/nghiatt15_onemount/Documents/github-local-solution/devops-config/scripts/prepare-startflow-agent-env.sh
    - C:/Users/nghiatt15_onemount/Documents/github-local-solution/devops-config/scripts/deploy-startflow-agent.sh
    - C:/Users/nghiatt15_onemount/Documents/github-local-solution/devops-config/projects/startflow-agent/**
    - C:/Users/nghiatt15_onemount/Documents/github-local-solution/devops-config/tests/*startflow-agent*.test.sh
    - C:/Users/nghiatt15_onemount/Documents/github-local-solution/devops-config/README.md
  prohibited_paths:
    - C:/Users/nghiatt15_onemount/Documents/StartFlow-Agent/.env
    - C:/Users/nghiatt15_onemount/Documents/StartFlow-Agent/.env.local
    - C:/Users/nghiatt15_onemount/Documents/StartFlow-Agent/.env.production
    - C:/Users/nghiatt15_onemount/Documents/StartFlow-Agent/.git/**
    - C:/Users/nghiatt15_onemount/Documents/StartFlow-Agent/.sdcorejs/specs/**
    - C:/Users/nghiatt15_onemount/Documents/StartFlow-Agent/.sdcorejs/plans/**
    - C:/Users/nghiatt15_onemount/Documents/StartFlow-Agent/.claude/**
    - C:/Users/nghiatt15_onemount/Documents/StartFlow-Agent/ai.log
    - C:/Users/nghiatt15_onemount/Documents/StartFlow-Agent/node_modules/**
    - C:/Users/nghiatt15_onemount/Documents/StartFlow-Agent/.next/**
    - C:/Users/nghiatt15_onemount/Documents/StartFlow-Agent/dist/**
    - C:/Users/nghiatt15_onemount/Documents/StartFlow-Agent/coverage/**
    - C:/Users/nghiatt15_onemount/Documents/StartFlow-Agent/.venv/**
    - C:/Users/nghiatt15_onemount/Documents/github-local-solution/devops-config/.github/workflows/deploy-enterprise-platform.yml
    - C:/Users/nghiatt15_onemount/Documents/github-local-solution/devops-config/scripts/*enterprise-platform*.sh
    - C:/Users/nghiatt15_onemount/Documents/github-local-solution/devops-config/projects/enterprise-platform/**
    - real secret values, SSH private keys, database certificates, Keycloak passwords or LLM API keys
    - remote droplet state and lifecycle operations for existing PostgreSQL/Keycloak
  generated_artifacts:
    - pnpm-lock.yaml
    - ai-service/uv.lock
    - backend/prisma/migrations/**
    - ai-service/alembic/versions/**
    - backend/openapi/startflow-api.json
  docs_artifacts:
    - ReadMe.md
    - START.md
    - docs/**
    - product/**
    - design/**
    - .sdcorejs/docs/**
    - .sdcorejs/documentation/**
    - C:/Users/nghiatt15_onemount/Documents/github-local-solution/devops-config/README.md
  dependency_changes:
    required: true
    packages:
      - next, react, react-dom, keycloak-js, zod, recharts, lucide-react
      - @nestjs/common, @nestjs/core, @nestjs/platform-express, @nestjs/config, @nestjs/swagger, @nestjs/throttler
      - prisma, @prisma/client, jose, pino, class-validator, class-transformer
      - typescript, eslint, prettier, jest, vitest, @testing-library/react, @playwright/test
      - fastapi, uvicorn, langgraph, openai, pydantic-settings, sqlalchemy, asyncpg, pgvector, alembic, httpx
      - pytest, pytest-asyncio, ruff, mypy
    approval_required: true
  env_changes:
    required: true
    files:
      - .env.example
      - .env.production.example
      - projects/startflow-agent/.startflow-agent.env.dev.example
      - projects/startflow-agent/.startflow-agent.env.main.example
    approval_required: true
  migration_changes:
    required: true
    description: Prisma initial application schema and Alembic initial AI/RAG schema on existing PostgreSQL 18; no Keycloak migration and no database provisioning.
    approval_required: true
  verification_strategy:
    package_manager: pnpm
    scripts_detected: []
    commands_planned:
      - command_or_script: pnpm install --frozen-lockfile
        reason: verify the generated Node lockfile and workspace dependency graph after task 1 creates them
      - command_or_script: pnpm lint && pnpm typecheck && pnpm test && pnpm build
        reason: run scripts explicitly created in root/app manifests and prove TypeScript quality/build contracts
      - command_or_script: docker compose config && docker compose build
        reason: validate Compose interpolation and build the three application images without provisioning external services
      - command_or_script: docker compose run --rm ai-service uv run ruff check . && docker compose run --rm ai-service uv run pytest
        reason: verify the locked Python environment inside the application image because local uv is unavailable
      - command_or_script: pnpm test:e2e
        reason: execute the mock-mode hackathon journey after the e2e script is created
      - command_or_script: bash tests/prepare-startflow-agent-env.test.sh && bash tests/deploy-startflow-agent.test.sh && bash tests/workflow-deploy-startflow-agent.test.sh
        reason: verify reusable deploy scripts/workflow in devops-config without touching a droplet
      - command_or_script: git diff --check
        reason: check whitespace and patch integrity in both repositories
    commands_skipped:
      - command_or_probe: existing application scripts
        reason: no package.json, pyproject.toml or lockfiles exist before scaffold; scripts are contractually created by this plan
      - command_or_probe: local uv commands
        reason: uv CLI is unavailable locally; Docker/CI owns Python verification
      - command_or_probe: actual GitHub Actions droplet deployment
        reason: requires external secrets/domain and explicit release action; static tests and workflow validation run in this plan
    focused_checks:
      - Planner creates three specialist tasks and deterministic mock mode completes
      - Compliance hard-stop overrides positive credit result
      - SSE event ordering, resume and idempotency
      - Keycloak JWT issuer/audience/role enforcement
      - Approval concurrency creates one action ticket only
      - Retrieval returns grounded citations from demo knowledge
      - External PostgreSQL/Keycloak preflight fails before container replacement
    broad_checks:
      - Node/Python unit and integration suites
      - production builds for three application images
      - Docker Compose config/build and health smoke
      - Playwright demo journey
      - devops-config shell/workflow regression tests
      - final acceptance, documentation and branch-ready gates
  parallel_candidates:
    allowed: true
    units:
      - id: P2-BACKEND
        title: NestJS API and application persistence
        allowed_paths:
          - backend/**
        dependencies:
          - P1-FOUNDATION
      - id: P3-AI
        title: FastAPI/LangGraph orchestration, agents, tools and RAG
        allowed_paths:
          - ai-service/**
          - knowledge/seed/**
        dependencies:
          - P1-FOUNDATION
      - id: P4-FRONTEND
        title: Next.js dashboard and Keycloak/SSE integration
        allowed_paths:
          - frontend/**
        dependencies:
          - P1-FOUNDATION
      - id: P5-PRODUCT-DESIGN
        title: Product traceability, UX handoff and demo documentation
        allowed_paths:
          - product/**
          - design/**
          - docs/**
        dependencies:
          - P1-FOUNDATION
      - id: P7-DEVOPS
        title: Reusable deployment integration
        allowed_paths:
          - C:/Users/nghiatt15_onemount/Documents/github-local-solution/devops-config/**startflow-agent**
        dependencies:
          - P6-INTEGRATION
    shared_files:
      - path: package.json, pnpm-lock.yaml, pnpm-workspace.yaml
        coordination_strategy: parent-owned
      - path: packages/contracts/**
        coordination_strategy: sequential
      - path: .env*.example, docker-compose*.yml
        coordination_strategy: parent-owned
      - path: .github/workflows/** and devops-config/README.md
        coordination_strategy: lock-step
      - path: ReadMe.md, START.md and .sdcorejs/**
        coordination_strategy: parent-owned
    conflict_risks:
      - Backend/frontend/AI may diverge on run event and decision schemas if contracts are not frozen first.
      - Concurrent dependency installation may race on pnpm-lock.yaml.
      - DevOps implementation depends on final container names, health endpoints and env contract.
      - Both repositories currently use main branch; execution must not commit, push or deploy without a separate request.
  finish_tail:
    docs_before_final_branch_ready: true
    branch_ready_final_gate: true
  approval:
    approved: true
    approved_at: 2026-07-17T16:25:57+07:00
  change_control:
    revision: 1
    supersedes: null
    change_reason: null
```

## Working-tree preflight

Trước bất kỳ edit nào, execution phải chạy ở cả hai repositories:

- `git status --short`, current branch và current HEAD.
- staged diffstat, unstaged diffstat và danh sách untracked files.
- Đối chiếu `allowed_paths`/`prohibited_paths`; không chạm unrelated dirty files.
- Xác nhận StartFlow draft/approved spec/plan artifacts là thay đổi thuộc scope; checkpoint session là local ignored state.
- Nếu xuất hiện dirty file ngoài scope, dừng để người dùng chọn tiếp tục giới hạn, cho phép file cụ thể hoặc dọn/stash trước.

## Tasks

### Phase 1 - Foundation, contracts and external-service configuration

1. CREATE `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.editorconfig`, `.prettierrc.json`, `.prettierignore` - khởi tạo pnpm workspace, root scripts và convention chung; generate `pnpm-lock.yaml` duy nhất dưới parent ownership.
2. CREATE `packages/contracts/**` - định nghĩa Zod/API/event/decision schemas, fixtures và contract tests dùng chung cho Next.js/NestJS; xuất JSON Schema để Python contract tests đối chiếu.
3. CREATE `.env.example`, `.env.production.example`, `.dockerignore`; EDIT `.gitignore` - ghi external PostgreSQL/Keycloak/LLM/internal-callback env contract, redacted secret placeholders và ignore generated/local state.
4. CREATE `infra/keycloak/**` - cung cấp realm/client/roles template, reconciliation/check script và hướng dẫn áp dụng vào Keycloak có sẵn; không chứa user password và không quản lý Keycloak container.

### Phase 2 - NestJS API, persistence and human approval

5. CREATE `backend/package.json`, `backend/nest-cli.json`, `backend/tsconfig*.json`, `backend/src/{main,app.module}.ts`, `backend/src/modules/{health,auth}/**`, `backend/Dockerfile` - scaffold NestJS API, config validation, correlation/redaction, health/readiness và Keycloak JWT/JWKS role guards.
6. CREATE `backend/prisma/schema.prisma`, `backend/prisma/migrations/**`, `backend/prisma/seed.ts`, `backend/src/modules/cases/**` - TDD application schema, demo fixtures, case CRUD và immutable run snapshots trên PostgreSQL 18 có sẵn.
7. CREATE `backend/src/modules/{runs,events,internal-callback}/**` - TDD run lifecycle, internal service-token callback, monotonic/idempotent events, persisted timeline và resumable SSE.
8. CREATE `backend/src/modules/{approvals,action-tickets,audit}/**` - TDD role-protected approval/rejection, optimistic concurrency, single ticket creation và append-only audit/redaction.
9. CREATE `backend/src/modules/knowledge/**`, `backend/test/**`, `backend/openapi/**` - admin ingestion boundary, unit/integration/e2e API coverage và generated OpenAPI contract without external-service mutation.

### Phase 3 - FastAPI/LangGraph agents, tools and RAG

10. CREATE `ai-service/pyproject.toml`, `ai-service/uv.lock`, `ai-service/Dockerfile`, `ai-service/src/main.py`, `ai-service/src/core/**`, `ai-service/tests/test_health.py` - scaffold locked Python service, validated settings, structured/redacted logging và health/readiness.
11. CREATE `ai-service/src/graph/**`, `ai-service/src/models/**`, `ai-service/tests/{test_planner,test_synthesizer}.py` - RED-first Planner state graph, three specialist tasks, partial-failure handling, conflict matrix và final decision contract.
12. CREATE `ai-service/src/agents/**`, `ai-service/src/tools/**`, `ai-service/tests/{test_agents,test_tools,test_mock_mode}.py` - Credit/Compliance/Operations agents, deterministic calculator, mock KYC/AML, document checklist, proposed action và deterministic mock LLM mode.
13. CREATE `ai-service/src/rag/**`, `ai-service/alembic/**`, `knowledge/seed/**`, `ai-service/tests/test_retrieval.py` - PostgreSQL/pgvector knowledge schema, safe migrations, demo ingestion, domain retrieval và stable citations.
14. CREATE `ai-service/src/api/**`, `ai-service/src/clients/**`, `ai-service/tests/{test_runs_api,test_callback_client,test_contracts}.py` - run endpoint/background graph, signed/idempotent callbacks, retry/error mapping và TypeScript/Python contract parity.

### Phase 4 - Next.js dashboard and demo experience

15. CREATE `frontend/package.json`, `frontend/next.config.ts`, `frontend/tsconfig.json`, `frontend/app/{layout,page}.tsx`, `frontend/src/{auth,lib,components}/**`, `frontend/Dockerfile` - scaffold responsive Next.js App Router, brand tokens, Keycloak Authorization Code + PKCE, protected shell và typed API client.
16. CREATE `frontend/app/{dashboard,cases,cases/new,cases/[caseId]}/**`, `frontend/src/features/{dashboard,cases}/**` - dashboard metrics, case list/detail, validated intake form và two deterministic demo fixtures.
17. CREATE `frontend/app/runs/[runId]/**`, `frontend/src/features/runs/**` - planner/task visualization, agent cards, resumable SSE timeline, tool/citation panels, conflict/final decision và approver actions.
18. CREATE `frontend/app/{comparisons,knowledge}/**`, `frontend/src/features/{comparisons,knowledge}/**`, `frontend/tests/**` - single-vs-multi comparison, admin knowledge view, role-based UX, accessibility/component tests và critical route checks.

### Phase 5 - Product, design and hackathon narrative

19. CREATE `product/**`, `design/**`, `docs/{architecture,demo-script,data-sources,security,deployment}.md`; EDIT `ReadMe.md` - thay router tám chatbot bằng approved multi-agent narrative, user stories/AC/UAT, screen flow, text wireframes, traceability và demo tối đa 10 phút.

### Phase 6 - Container integration, smoke and run guide

20. CREATE `docker-compose.yml`, `docker-compose.prod.yml`, `test/e2e/**`, `START.md` - nối ba application containers với external dependency env, preflight PostgreSQL/Keycloak, health ordering, mock-mode smoke, Playwright journey và hướng dẫn chạy không provision hạ tầng.

### Phase 7 - CI/CD and shared droplet integration

21. CREATE `.github/workflows/ci.yml`, `.github/workflows/deploy.yml` - Node/Python/Docker CI, secret-free mock tests và caller workflow deploy theo branch/environment qua pinned reusable workflow reference.
22. CREATE `devops-config/.github/workflows/deploy-startflow-agent.yml`, `devops-config/scripts/{prepare,deploy}-startflow-agent.sh`, `devops-config/projects/startflow-agent/**`, `devops-config/tests/*startflow-agent*.test.sh`; EDIT `devops-config/README.md` - build/transfer ba images, mode-600 env, external dependency preflight, migrations, unique ports/network/Nginx, health rollback và static regression tests without touching enterprise-platform.

### Phase 8 - Verification, review, repair and delivery records

23. COMMAND both repositories within approved scope - generate/lock dependencies, run focused RED-GREEN suites, Node/Python lint/typecheck/tests/builds, Compose config/build/smoke, Playwright demo, devops shell/workflow tests, review and repair findings, refresh product/design/documentation/traceability, then run verify-before-done and final branch-ready with no writes afterward.

## Acceptance mapping

- AC-001 -> tasks 3-5, 10, 15, 20, 23.
- AC-002 to AC-003 -> tasks 4-5, 15, 18, 20, 23.
- AC-004 -> tasks 2, 6, 16, 23.
- AC-005 to AC-011 -> tasks 2, 7, 11-14, 17, 23.
- AC-012 -> tasks 2, 7, 14, 17, 23.
- AC-013 -> tasks 2, 13, 17, 23.
- AC-014 -> tasks 2-5, 8, 10, 14-15, 17, 23.
- AC-015 to AC-016 -> tasks 5, 8, 17, 23.
- AC-017 -> tasks 2, 7, 11-12, 14, 18, 23.
- AC-018 -> tasks 10-12, 14, 20-21, 23.
- AC-019 -> tasks 5, 9, 13-14, 18, 23.
- AC-020 -> tasks 2, 5-18, 20-23.
- AC-021 -> tasks 3-4, 20-23.
- AC-022 -> tasks 1-2, 5, 9-10, 14-15, 18, 21, 23.
- AC-023 `[Manual]` -> tasks 3-5, 10, 15, 20-23.
- AC-024 `[Manual]` -> tasks 6-20, 23.

## Verification

Sau khi tasks tương ứng đã tạo manifests/scripts:

- `pnpm install --frozen-lockfile`.
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
- `docker compose config && docker compose build`.
- `docker compose run --rm ai-service uv run ruff check .`.
- `docker compose run --rm ai-service uv run pytest`.
- `pnpm test:e2e` với mock mode và external-service test configuration.
- Trong `devops-config`: chạy ba shell regression test `*startflow-agent*.test.sh` bằng Bash.
- `git diff --check` và scoped diff review ở cả hai repositories.
- Manual: actual deploy chỉ được kích hoạt sau khi GitHub Environment có verified SSH host key, domain/TLS, external DB/Keycloak information và user yêu cầu triển khai.
- Final: product traceability, spec/plan hash consistency, acceptance evidence, verify-before-done và branch-ready là read-only gate cuối.


## Decisions captured during review

- (approved as drafted)

## Skill provenance

sdcorejs-plan (approved on attempt 1 / 3)
