# StartFlow scaffold và verification — 2026-07-17 18:12

## Yêu cầu

Scaffold ứng dụng hackathon đa tác nhân bằng Next.js, NestJS và Python AI service; kết nối PostgreSQL 18/Keycloak có sẵn qua env; đóng gói Docker và deploy độc lập bằng GitHub Actions trên cùng droplet với các ứng dụng khác.

## Đã thay đổi

- CREATE `frontend/` — dashboard Next.js App Router cho case, run timeline, approval, knowledge và comparison.
- CREATE `backend/` — NestJS API, Prisma model/migration, Keycloak JWT/role guards, SSE, audit và approval concurrency.
- CREATE `ai-service/` — FastAPI/LangGraph Planner, ba specialist agents, Synthesizer, RAG/pgvector, mock mode và callback có chữ ký.
- CREATE `packages/contracts/` — vocabulary và schema dùng chung cho case/run/event.
- CREATE `docker-compose.yml`, `docker-compose.prod.yml`, Dockerfiles và env examples — chỉ quản lý ba app services.
- CREATE `.github/workflows/ci.yml`, `.github/workflows/deploy.yml` — quality gates, E2E, image build và reusable deployment.
- CREATE `infra/deploy/` và `.github/workflows/deploy.yml` — standalone deploy, Nginx TLS, migrate-first, healthcheck và rollback container.
- CREATE `START.md`, `docs/`, `product/`, `design/`, `knowledge/seed/` — runbook, architecture, demo flow và dữ liệu mô phỏng.

## Quyết định

- PostgreSQL và Keycloak luôn là external dependencies; không provision hoặc restart từ Compose/deploy.
- Frontend dùng Keycloak Authorization Code + PKCE; backend enforce issuer/audience/roles.
- AI callback cần internal token, HMAC-SHA256 raw body và timestamp chống replay 5 phút.
- Mock mode deterministic là đường demo dự phòng; production LLM dùng endpoint tương thích OpenAI qua env.
- Migration chạy trước container rollout; image tag theo commit SHA; lỗi health phục hồi release containers trước, migration vẫn forward-only.

## Bằng chứng kiểm tra

- `pnpm install --frozen-lockfile --offline` — pass.
- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm build` — pass.
- `pnpm test` — pass: contracts 3, backend 19, frontend 9, static contracts 2.
- `pnpm test:e2e` với Chrome hệ thống — pass: 2 critical journeys.
- AI service — pass ở lượt kiểm tra trước khi dọn bootstrap environment: Ruff, mypy, compileall và 27 pytest tests.
- Docker Compose local/production `config --quiet` — pass.
- `git diff --check` cho StartFlow — pass.

## Review và repair

- Đã thêm HMAC callback verification/replay window, latest-run dashboard mapping, terminal SSE cleanup, readiness `/ready`, TLS fail-closed và focus trap dialog.
- Đã sửa root `pnpm test` vì filter cũ không match workspace; lệnh hiện chạy đủ contracts/backend/frontend.
- Không còn finding bắt buộc từ review code/architecture/security/performance/accessibility.

## Còn mở

- Docker daemon local đang tắt nên chưa build image tại máy này; CI có job build cả ba image.
- Chưa có runtime credentials nên chưa chạy readiness/migration với PostgreSQL/Keycloak thật hoặc live admin knowledge ingest.
- Chưa kích hoạt GitHub Actions deploy lên droplet và chưa thực hiện UAT demo tối đa 10 phút.
- Bash không có trên máy Windows này nên shell test của `infra/deploy` sẽ chạy trong Ubuntu GitHub runner.

## Product traceability

- Ledger: `.sdcorejs/docs/product/2026-07-17-17-20-startflow-credit-assessment.md`
- Kết quả: 19 AC có bằng chứng pass; AC-001, AC-002, AC-019 chờ môi trường thật; AC-023 và AC-024 là manual.

## Hành động tiếp theo

- Điền GitHub Environment secrets/runtime env từ `.env.production.example`.
- Xác nhận PostgreSQL 18 đã bật `vector`, chạy CI, sau đó deploy environment `development`.
- Chạy UAT checklist và kịch bản `docs/demo-script.md` trước buổi chấm.

## Skill provenance

`sdcorejs-solution-builder` → product/design/backend/frontend/test/docker/auth/documentation → review/repair-loop → `sdcorejs-ship`.
