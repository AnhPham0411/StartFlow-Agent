---
name: angular-core-ui-frontend-migration
description: Kế hoạch 32 task để thay toàn bộ frontend StartFlow bằng Angular 20 và @sdcorejs/angular, giữ nguyên backend/API.
approvedAt: 2026-07-18T22:50:06.7966687+07:00
approvedBy: ghost.of.dark.peter@gmail.com
track: angular
sourceSpecPath: .sdcorejs/specs/angular/2026-07-18-22-44-angular-core-ui-frontend-migration.md
taskCount: 32
phaseCount: 8
---

# Angular Core UI Frontend Migration - Approved Plan

> Snapshot of what the user approved at the `sdcorejs-plan` gate. Do not edit by hand; re-author through `sdcorejs-plan` if the contract changes.

## Approved contract

# Implementation Plan - Angular Core UI Frontend Migration - 2026-07-18 22:46

## Scope

Thay toàn bộ `frontend/` Next.js/React bằng Angular 20 + `@sdcorejs/angular`, giữ nguyên 7 route, backend API, shared contracts, Keycloak roles, REST/SSE behavior và port public `3000`. Đồng thời cập nhật test, Docker/Nginx, CI/deploy, env examples và tài liệu để frontend Angular có thể thay thế trực tiếp bản hiện tại.

Nguồn contract đã duyệt: `.sdcorejs/specs/angular/2026-07-18-22-44-angular-core-ui-frontend-migration.md`.

## Execution context

- Track: `angular`.
- Coverage approach: hybrid TDD - RED-first cho auth/permission, API normalization, SSE và approval concurrency; component tests ngay sau từng UI feature.
- Architecture: standalone-first, signals, OnPush, lazy routes, Core UI controls/layout, không NgRx.
- Parallel candidates: có. Sau khi foundation/core hoàn tất, Dashboard/Cases, Run, Comparison/Knowledge và deployment assets có thể tách thành các workstream độc lập; cleanup và full verification vẫn tuần tự.
- Path conflicts checked:
  - Các path `frontend/angular.json`, `frontend/tsconfig.app.json`, `frontend/tsconfig.spec.json`, `frontend/src/main.ts`, `frontend/src/index.html`, `frontend/src/styles.scss`, `frontend/src/app/**`, `frontend/nginx.conf`, `frontend/docker-entrypoint.d/**` chưa tồn tại và an toàn để CREATE.
  - Các path được đánh dấu EDIT đều đang tồn tại.
  - React/Next paths được đánh dấu DELETE đều đang tồn tại; chỉ xóa sau khi Angular feature parity và focused tests đã đạt.

## Tasks

### Phase 1 - Angular toolchain and bootstrap

1. EDIT `frontend/package.json` - thay Next/React/Vitest dependencies và scripts bằng Angular 20, Angular ESLint, Jasmine/Karma, `@sdcorejs/angular` v20, RxJS và các peer dependency đúng major; giữ `name: @startflow/frontend` và scripts `dev`, `build`, `lint`, `test`, `typecheck` tương thích root workspace.
2. EDIT `frontend/tsconfig.json`, `frontend/eslint.config.mjs` - chuyển compiler/lint rules sang Angular strict templates, TypeScript strict, standalone component conventions và ignore output `dist/coverage`.
3. CREATE `frontend/angular.json`, `frontend/tsconfig.app.json`, `frontend/tsconfig.spec.json`, `frontend/karma.conf.cjs` - khai báo build/serve/test/lint targets, copy `public/`, budgets và production optimizations.
4. CREATE `frontend/src/main.ts`, `frontend/src/index.html`, `frontend/src/app/app.component.ts`, `frontend/src/app/app.config.ts`, `frontend/src/app/app.routes.ts` - bootstrap standalone app, đăng ký HTTP/router/Core UI/Keycloak/permission providers, lazy routes, default redirect và not-found.
5. CREATE `frontend/src/app/core/config/runtime-config.model.ts`, `frontend/src/app/core/config/runtime-config.service.ts`, `frontend/src/app/core/config/runtime-config.service.spec.ts` - viết RED tests rồi hiện thực việc tải/validate public config trước auth; production fail closed khi thiếu Keycloak config hoặc dùng mock auth.

### Phase 2 - TDD core: auth, permissions, API and SSE

6. CREATE `frontend/src/app/core/auth/permission-map.spec.ts`, `frontend/src/app/core/auth/roles.spec.ts` - RED tests cho merge realm/client roles, bỏ role lạ và mapping permission của analyst/approver/admin theo approved spec.
7. CREATE `frontend/src/app/core/auth/roles.ts`, `frontend/src/app/core/auth/permission-map.ts`, `frontend/src/app/core/auth/keycloak.configuration.ts`, `frontend/src/app/core/auth/auth.configuration.ts`, `frontend/src/app/core/auth/permission.configuration.ts`, `frontend/src/app/core/auth/auth-state.service.ts` - hiện thực Core UI Keycloak PKCE, mock-dev guard, token/profile state, `SD_PERMISSION_CONFIGURATION`, forbidden handling và logout.
8. CREATE `frontend/src/app/core/api/normalizers.spec.ts`, `frontend/src/app/core/api/startflow-api.service.spec.ts` - RED tests cho envelope/collection normalization, missing optional fields, auth header, error mapping và endpoint/payload parity.
9. CREATE `frontend/src/app/core/api/models.ts`, `frontend/src/app/core/api/normalizers.ts`, `frontend/src/app/core/api/startflow-api.service.ts` - chuyển models và API client hiện tại sang Angular HttpClient, tái sử dụng `@startflow/contracts`, giữ nguyên endpoint và approval `expectedVersion`.
10. CREATE `frontend/src/app/core/streaming/run-event-stream.service.spec.ts` - RED tests cho Authorization header, `Last-Event-ID`, parser, reconnect, abort, terminal close và dedup theo `id/sequence`.
11. CREATE `frontend/src/app/core/streaming/run-event-stream.service.ts` - hiện thực injectable fetch-stream SSE service và connection state, làm xanh toàn bộ tests của task 10.
12. CREATE `frontend/src/app/shared/formatters.spec.ts`, `frontend/src/app/shared/status-presentation.spec.ts`, `frontend/src/app/shared/formatters.ts`, `frontend/src/app/shared/status-presentation.ts` - chuyển currency/date/percent và status label/tone thành pure helpers có test, giữ đầy đủ nhãn tiếng Việt.

### Phase 3 - Core UI shell and shared states

13. CREATE `frontend/src/app/layout/layout.configuration.ts`, `frontend/src/app/layout/main-layout.component.ts`, `frontend/src/app/layout/main-layout.component.html`, `frontend/src/app/layout/main-layout.component.spec.ts` - dựng `SdLayoutComponent` + `SdTabRouterOutletComponent`, menu theo permission, profile/logout và active navigation cho các route hiện tại.
14. CREATE `frontend/src/app/shared/states/loading-state.component.ts`, `frontend/src/app/shared/states/empty-state.component.ts`, `frontend/src/app/shared/states/error-state.component.ts`, `frontend/src/app/shared/states/forbidden.component.ts`, `frontend/src/app/shared/states/not-found.component.ts`, `frontend/src/styles.scss` - trạng thái dùng Core UI, accessible copy, focus behavior và lớp layout responsive tối thiểu; không tái tạo control có sẵn.

### Phase 4 - Dashboard and case workflow

15. CREATE `frontend/src/app/features/dashboard/dashboard.component.ts`, `frontend/src/app/features/dashboard/dashboard.component.html`, `frontend/src/app/features/dashboard/dashboard.component.spec.ts` - dựng `SdPage` dashboard, 4 KPI, recent-run `SdTable`, next-action queue và loading/empty/error tests.
16. CREATE `frontend/src/app/features/cases/list/case-list.component.ts`, `frontend/src/app/features/cases/list/case-list.component.html`, `frontend/src/app/features/cases/list/case-list.component.spec.ts` - danh sách hồ sơ bằng `SdTable`, tìm tên/mã, status/amount/run count, route actions và states.
17. CREATE `frontend/src/app/features/cases/intake/case-intake.component.ts`, `frontend/src/app/features/cases/intake/case-intake.component.html`, `frontend/src/app/features/cases/intake/case-intake.component.scss`, `frontend/src/app/features/cases/intake/case-intake.component.spec.ts` - form Core UI theo ba section, fixture demo, sticky summary, `caseInputSchema` errors và create navigation.
18. CREATE `frontend/src/app/features/cases/detail/case-detail.component.ts`, `frontend/src/app/features/cases/detail/case-detail.component.html`, `frontend/src/app/features/cases/detail/case-detail.component.spec.ts` - snapshot tài chính/tài liệu, run-history `SdTable`, start-run action và API/error parity.

### Phase 5 - Multi-agent run and approval gate

19. CREATE `frontend/src/app/features/runs/run.facade.spec.ts` - RED tests cho initial REST load, persisted event merge, live SSE merge/dedup, terminal/approval reload, reconnect state và partial failure derivation.
20. CREATE `frontend/src/app/features/runs/run.facade.ts`, `frontend/src/app/features/runs/run-workspace.component.ts`, `frontend/src/app/features/runs/run-workspace.component.html`, `frontend/src/app/features/runs/run-workspace.component.scss`, `frontend/src/app/features/runs/run-workspace.component.spec.ts` - hiện thực planner strip, three-lane workspace, decision rail, responsive convergence layout và facade integration.
21. CREATE `frontend/src/app/features/runs/approval-panel.component.ts`, `frontend/src/app/features/runs/approval-panel.component.html`, `frontend/src/app/features/runs/approval-panel.component.spec.ts` - TDD reason validation, approver permission, Core UI confirm, optimistic version, success notify và `409` reload guidance.
22. CREATE `frontend/src/app/features/runs/agent-lane.component.ts`, `frontend/src/app/features/runs/timeline.component.ts`, `frontend/src/app/features/runs/evidence-panel.component.ts`, `frontend/src/app/features/runs/run-presenters.spec.ts` - tách agent/tool/citation/timeline presentation, tabs, accessible labels và partial/failed states.

### Phase 6 - Comparison and knowledge admin

23. CREATE `frontend/src/app/features/comparisons/comparison.component.ts`, `frontend/src/app/features/comparisons/comparison.component.html`, `frontend/src/app/features/comparisons/comparison.component.scss`, `frontend/src/app/features/comparisons/comparison.component.spec.ts` - case selector, six-metric `SdTable`, labeled horizontal comparison bars, run links và loading/error states.
24. CREATE `frontend/src/app/features/knowledge/knowledge.component.ts`, `frontend/src/app/features/knowledge/knowledge.component.html`, `frontend/src/app/features/knowledge/knowledge.component.spec.ts`, `frontend/src/app/features/knowledge/ingest-drawer.component.ts`, `frontend/src/app/features/knowledge/ingest-drawer.component.html`, `frontend/src/app/features/knowledge/ingest-drawer.component.spec.ts` - admin-only document table, `SdSideDrawer` ingest form, validation và notify feedback.

### Phase 7 - Static runtime, environment and deployment migration

25. EDIT `frontend/Dockerfile`, `frontend/.dockerignore`; CREATE `frontend/nginx.conf`, `frontend/public/app-config.template.json`, `frontend/docker-entrypoint.d/40-startflow-config.sh` - multi-stage Angular build, unprivileged Nginx port `3000`, SPA fallback, `/health`, safe public runtime config generation và no-secret guardrails.
26. EDIT `docker-compose.yml`, `docker-compose.prod.yml`, `.env.example`, `.env.production.example` - đổi frontend healthcheck sang `/health`, bỏ build args `NEXT_PUBLIC_*`, truyền `STARTFLOW_*` runtime variables và giữ ports/container/network hiện tại.
27. EDIT `.github/workflows/deploy.yml`, `infra/deploy/prepare-env.sh`, `infra/deploy/deploy.sh`, `infra/deploy/tests/prepare-env.test.sh`, `infra/deploy/tests/deploy.test.sh`, `infra/deploy/tests/workflow.test.sh` - đổi image build/runtime env contract, validation và readiness checks sang Angular/Nginx mà không thay ownership deployment.

### Phase 8 - Parity, cleanup, documentation and full verification

28. EDIT `test/e2e/specs/hackathon-critical.spec.ts`, `test/e2e/playwright.config.ts` - giữ hai critical journeys, cập nhật Angular startup/selector theo `autoId` và accessible roles, vẫn mock cùng API payload.
29. DELETE `frontend/app/**`, `frontend/src/auth/**`, `frontend/src/components/**`, `frontend/src/features/**`, `frontend/src/lib/**`, `frontend/tests/**`, `frontend/next-env.d.ts`, `frontend/next.config.ts`, `frontend/vitest.config.ts`, `frontend/vitest.setup.ts` - loại bỏ React/Next/Vitest chỉ sau khi Angular focused tests và route parity đã pass; không xóa `frontend/src/app/**` mới.
30. EDIT `pnpm-lock.yaml`, `ReadMe.md`, `START.md`, `docs/architecture.md`, `docs/deployment.md` - cập nhật lockfile, stack map, local run, env names, `/health`, Docker/Nginx và loại bỏ mọi hướng dẫn Next.js.
31. RUN `pnpm install`; `pnpm format:check`; `pnpm --filter @startflow/frontend lint`; `pnpm --filter @startflow/frontend typecheck`; `pnpm --filter @startflow/frontend test`; `pnpm --filter @startflow/frontend build` - cập nhật dependency graph và hoàn tất focused Angular quality gates.
32. RUN full verification and mandatory finish chain - `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm test:e2e`, Compose config/image build và manual responsive smoke; sau đó thực hiện test review, code/architecture/security/accessibility review, repair loop nếu có finding, code documentation, Angular UI check, ship verify-before-done/branch-ready, auto-docs/task tracker và durable memory update theo Angular tail gate.

## Acceptance mapping

- AC1 -> tasks 1-4, 29-31.
- AC2 -> tasks 1, 4, 13-24.
- AC3 -> tasks 4, 13, 15-24, 28.
- AC4 -> tasks 4, 14.
- AC5 -> tasks 5-7, 31.
- AC6 -> tasks 5-7, 25-27.
- AC7 -> tasks 6-7, 13, 21, 24.
- AC8 -> task 15.
- AC9 -> task 16.
- AC10 -> task 17.
- AC11 -> task 18.
- AC12 -> tasks 19-22.
- AC13 -> tasks 10-11, 19-20.
- AC14 -> tasks 19-20, 22.
- AC15 -> task 21.
- AC16 -> task 23.
- AC17 -> task 24.
- AC18 -> tasks 13-24, 28, 32.
- AC19 -> tasks 14, 17, 20, 23-24, 32.
- AC20 -> tasks 5-12, 13, 15-24, 28, 31-32.
- AC21 -> tasks 25-27, 32.
- AC22 -> tasks 25-30, 32.
- AC23 -> tasks 31-32.
- AC24 -> tasks 8-11, 15-24, 31-32.

## Verification

### Focused TDD / Angular

- `pnpm --filter @startflow/frontend test`
- `pnpm --filter @startflow/frontend lint`
- `pnpm --filter @startflow/frontend typecheck`
- `pnpm --filter @startflow/frontend build`

### Workspace regression

- `pnpm format:check`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- `pnpm test:e2e`

### Runtime and deployment

- `docker compose --env-file .env.example config --quiet`
- `docker compose --env-file .env.production.example -f docker-compose.yml -f docker-compose.prod.yml config --quiet`
- `docker build --file frontend/Dockerfile --tag startflow-frontend:angular-local .`
- Linux/CI: `bash -n infra/deploy/prepare-env.sh && bash -n infra/deploy/deploy.sh`
- Linux/CI: `bash infra/deploy/tests/prepare-env.test.sh && bash infra/deploy/tests/deploy.test.sh && bash infra/deploy/tests/workflow.test.sh`
- Container smoke: `GET http://localhost:3000/health` trả `200` và direct navigation tới `/runs/smoke-run-id` trả Angular shell.

### Manual UI smoke

- Đăng nhập mock ở development và Keycloak-configured build; production mock config phải fail closed.
- Desktop/tablet/mobile: mở đủ 7 route, kiểm tra menu permission, keyboard focus và không có horizontal overflow ngoài data region được phép.
- Tạo fixture case -> mở case detail -> bắt đầu run -> quan sát Planner/3 agent lanes/timeline -> approver xác nhận decision.
- Chạy comparison và xác nhận đủ 6 metrics; admin mở Knowledge và ingest demo document; analyst/approver bị chặn rõ ràng ở Knowledge.
- Ngắt/reconnect SSE, xác nhận persisted timeline còn nguyên và event không lặp.

## Decisions captured during review

- Approved as drafted on the first plan approval attempt.

## Skill provenance

sdcorejs-plan (approved on attempt 1 / 3)
