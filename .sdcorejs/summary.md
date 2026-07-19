---
generated_at: 2026-07-19T07:45:00+07:00
git_head: e3b260d2ff870d16f7d40d96af47cfbdd724e281
branch: feat/angular-core-ui-migration
tracks: [angular, nestjs, test, generic]
generator: sdcorejs-explore
---

# Project Summary - StartFlow-Agent

## What this project is

StartFlow là demo hackathon đánh giá tín dụng bằng multi-agent. Planner chia hồ sơ cho Credit, Compliance và Operations; Synthesizer hội tụ kết quả, lưu timeline/evidence và dừng tại human approval khi cần. UI chỉ dùng dữ liệu demo, không dùng PII thật.

## Current stack

- Monorepo pnpm 10, Node 22, TypeScript 5.9.
- Frontend đã được thay toàn bộ bằng Angular 20 standalone/strict và `@sdcorejs/angular` 20.1.2; React, Next.js và Vitest frontend cũ đã bị loại bỏ.
- Backend giữ nguyên NestJS, Prisma/PostgreSQL, JWT/role guards và các module cases/runs/events/approvals/knowledge.
- AI service giữ nguyên FastAPI/LangGraph, ba specialist agents, Synthesizer, tools và external Qdrant RAG.
- Shared vocabulary tiếp tục dùng Zod schemas/types trong `packages/contracts/src/schemas.ts`.
- Runtime gồm ba application containers; PostgreSQL và Keycloak là external dependencies.

## Frontend architecture

- `frontend/src/main.ts` bootstrap Angular bằng typed build environment đã được Angular CLI chọn.
- `frontend/src/app/app.config.ts` cấu hình Core UI, auth, permission, router và HTTP.
- `frontend/src/environments/` chứa contract cùng cấu hình `local`, hosted `development` và `production`; `APP_ENVIRONMENT` là DI boundary cho API, SSE và Keycloak.
- `frontend/src/app/core/auth/` sở hữu Keycloak PKCE, mock development-only, roles và permissions.
- `frontend/src/app/core/api/` sở hữu REST client, response normalization, schema validation và typed errors.
- `frontend/src/app/core/streaming/` sở hữu bearer fetch-stream SSE, `Last-Event-ID`, dedup và bounded reconnect.
- `frontend/src/app/layout/` dùng Core `SdLayout`/tab router và navigation theo quyền.
- `frontend/src/app/features/` chứa dashboard, cases list/intake/detail, run workspace/approval, comparison và knowledge ingest.
- `frontend/src/app/shared/a11y/` chứa compatibility repair cho accessibility còn thiếu ở Core form controls.
- Mỗi màn hình chính có semantic `h1`; knowledge drawer có dialog semantics, focus trap, Escape và focus restoration.

## Runtime and delivery

- `frontend/Dockerfile` build Angular bằng một trong `local|development|production` và chạy bằng unprivileged Nginx; cả hai base image được pin digest.
- Frontend không đọc `.env` và không tạo `app-config.json` lúc container start; public config thay đổi chỉ có hiệu lực sau khi build lại.
- `frontend/nginx.conf` phục vụ SPA fallback, `/health`, security headers/CSP và trả `404` cho đường dẫn runtime config đã ngừng dùng.
- `docker-compose*.yml`, `.github/workflows/deploy.yml` và `infra/deploy/` đã được cập nhật cho Angular/Nginx.
- Hướng dẫn chạy/deploy nằm trong `START.md`, `ReadMe.md` và `docs/deployment.md`.

## Preserved contracts and decisions

- Backend endpoint/payload/shared contracts không thay đổi.
- Common portal routes được cấp cho analyst/approver/admin theo approved spec; approval chỉ cho approver, knowledge chỉ cho admin.
- `STARTFLOW_RUN_START` được kiểm tra ở cả UI và handler; production auth luôn là Keycloak.
- Backend hiện có role guard cũ không cho admin gọi một số analyst endpoints; đây là mismatch tồn tại sẵn và chưa sửa vì backend nằm ngoài phạm vi migration.
- SSE luôn hiển thị persisted events trước, sau đó merge live events mà không xóa hoặc nhân đôi timeline.

## Verification snapshot

- Workspace lint, typecheck, test và build đều pass.
- Angular: 107/107 tests; backend: 10 suites/19 tests; contracts: 3 tests; static contracts: 2 tests.
- Playwright critical journeys: 2/2 pass.
- Ba Angular build và bundle scan pass; mỗi bundle chứa đúng public endpoint theo configuration.
- Docker image build và unprivileged container smoke pass: `/health=200`, deep route `200`, `/app-config.json=404`.
- Dev/prod Compose config, Nginx syntax và ba standalone deployment suites pass.
- Production dependency audit không có high/critical; còn một moderate transitive `uuid` qua Core UI/ExcelJS.

## Approved artifacts

- Spec: `.sdcorejs/specs/angular/2026-07-18-22-44-angular-core-ui-frontend-migration.md`.
- Plan: `.sdcorejs/plans/angular/2026-07-18-22-50-angular-core-ui-frontend-migration.md`.
- Environment plan: `.sdcorejs/plans/angular/2026-07-19-angular-build-environments.md`.
- Demo-first NBA spec: `.sdcorejs/specs/fullstack/2026-07-19-07-43-demo-first-nba.md`.
- Demo-first NBA plan: `.sdcorejs/plans/fullstack/2026-07-19-07-43-demo-first-nba.md`.
- Implementation branch: `feat/angular-core-ui-migration`.

## Known follow-up context

- In-app Browser không có browser session khả dụng, nên visual/keyboard manual QA chưa được thực hiện bằng connector; automated component/E2E gates đã pass.
- Core UI vẫn có hạn chế upstream ở mobile navigation semantics; application-level repairs đã xử lý form controls và knowledge drawer.
- Build còn cảnh báo CommonJS từ các dependency bắc cầu của Core UI (ExcelJS, PrismJS, fuzzysort, extend).
- Hosted development và production hiện dùng chung public API/Keycloak endpoints đã được xác nhận; chưa thêm UAT/QC vì chưa có endpoint/pipeline tương ứng.
- Angular migration/CSP fix đã được commit, push lên `dev` và deploy thành công tại commit `e3b260d`.
- `frontend/public/logo.png` là untracked user asset phát hiện tại preflight; giữ nguyên và không đưa vào phạm vi NBA nếu user không yêu cầu.

## Freshness

Refreshed from commit `e3b260d` on `feat/angular-core-ui-migration` trước khi thực thi demo-first NBA plan.

## Merged dev capabilities

- Backend giữ NBA assessment/profile seed, integration-client token validation và role `sale`/`manager` từ `origin/dev`.
- AI service giữ external Qdrant repository, database runtime settings và health/readiness checks mới.
- `dev` deploy độc lập dưới `/opt/startflow-agent/dev` bằng `STARTFLOW_DEV` và `SSH_PRIVATE_KEY_DEV`; `main` dùng production secrets tương ứng.
- Runtime `.env`, database credentials, private keys và generated certificates vẫn untracked; Prisma/SQLAlchemy DSN được tạo từ split `DB_*` bên trong process.
- React-only Sales Copilot pages không được giữ vì Angular 20 là frontend runtime duy nhất; port UI đó sang Angular là phạm vi riêng.
