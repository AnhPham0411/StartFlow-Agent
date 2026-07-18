# StartFlow Agent

StartFlow là MVP hackathon đánh giá hồ sơ vay doanh nghiệp bằng một workflow AI đa tác nhân có thể quan sát và kiểm soát. Planner phân rã công việc cho ba chuyên gia `CREDIT`, `COMPLIANCE`, `OPERATIONS`; Synthesizer hợp nhất kết quả, nêu xung đột và đưa hành động nhạy cảm qua bước phê duyệt của con người.

> Dữ liệu, chính sách và điểm rubric trong repository chỉ phục vụ demo. Hệ thống không tự phê duyệt khoản vay và không kết nối dữ liệu khách hàng thật.

## Điểm nổi bật cho hackathon

- Multi-agent thật: Planner → ba specialist → Synthesizer, không phải router chọn một chatbot.
- Tool calls và RAG có citation theo document/section/chunk; public event không chứa chain-of-thought.
- Timeline SSE được lưu trong PostgreSQL, có sequence, idempotency và resume bằng `Last-Event-ID`.
- `approver` mới được approve/reject; optimistic concurrency chỉ cho tạo một action ticket.
- So sánh `SINGLE`/`MULTI` trên cùng immutable snapshot với sáu metric cố định. Metric demo được gắn `DETERMINISTIC_DEMO_RUBRIC`.
- LLM mock deterministic giúp demo vẫn chạy khi không có API key.

## Kiến trúc

```text
Browser / Angular 20 + @sdcorejs/angular
        │ static assets + runtime public config
        ▼
Unprivileged Nginx :3000
        │ REST + authenticated SSE
        ▼
NestJS API :3001 ─────────► PostgreSQL 18 có sẵn
        │ internal token        (app data + audit)
        ▼
FastAPI + LangGraph :8000 ─► Planner / Credit / Compliance / Operations / Synthesizer
        │                    └► calculator, mock KYC/AML, checklist, RAG
        └──────────────────► Qdrant có sẵn (knowledge chunks + embeddings)

Browser ── Authorization Code + PKCE ──► Keycloak có sẵn
```

Repository chỉ chạy ba application containers: `frontend`, `backend`, `ai-service`. Docker Compose và deploy workflow không provision hoặc restart PostgreSQL, Keycloak hay Qdrant.

## Cấu trúc

```text
backend/             NestJS, Prisma, JWT/JWKS, SSE, approval/audit
frontend/            Angular 20 standalone, Core UI, Keycloak PKCE, REST/SSE
ai-service/          FastAPI, LangGraph, tools, RAG, Alembic
packages/contracts/  Zod + JSON Schema public contracts
knowledge/seed/      chính sách demo không chứa dữ liệu khách hàng
infra/keycloak/      realm/client/roles template cho Keycloak có sẵn
infra/deploy/        standalone deploy scripts, tests và host Nginx templates
product/             PRD, stories, acceptance criteria, UAT
design/              flow, UI spec và wireframe
test/                contract tests và Playwright journey
docs/                kiến trúc, security, deploy và demo script
```

## Chạy local bằng Docker Compose

Yêu cầu Node.js 22, pnpm 10, Docker Compose và quyền truy cập PostgreSQL 18/Keycloak/Qdrant có sẵn.

```powershell
Copy-Item .env.example .env
# Điền các biến DB_*, QDRANT_* và credential thật vào .env; không commit file này.

pnpm install --frozen-lockfile
docker compose build
docker compose run --rm backend-migrate
docker compose run --rm ai-migrate
docker compose up -d backend ai-service frontend
```

Mở `http://localhost:3200`. Frontend Nginx health ở `http://localhost:3200/health`; API readiness ở `http://localhost:3201/ready`; AI readiness được kiểm tra nội bộ tại `http://ai-service:8000/ready`.

Không có tài khoản mặc định trong repository. Tạo/gán user với role `analyst`, `approver` hoặc `admin` trong Keycloak hiện hữu. Hướng dẫn chi tiết nằm ở [START.md](START.md).

## Phát triển và kiểm tra

Sau khi cài dependency, các lệnh frontend chuẩn là:

```powershell
pnpm --filter @startflow/frontend dev
pnpm --filter @startflow/frontend lint
pnpm --filter @startflow/frontend typecheck
pnpm --filter @startflow/frontend test
pnpm --filter @startflow/frontend build
```

Các gate toàn workspace:

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
$env:STARTFLOW_ENV_FILE='.env.example'
docker compose --env-file .env.example config --quiet
Remove-Item Env:STARTFLOW_ENV_FILE
```

Python quality/tests được khóa bằng `ai-service/uv.lock` và chạy trong CI qua `uv`. Playwright e2e dùng auth/API mock ở browser boundary, không ghi dữ liệu vào PostgreSQL/Keycloak có sẵn.

## Angular environments

Frontend dùng `frontend/src/environments/environment*.ts` và Angular `fileReplacements`. Local chạy API `localhost` với mock auth; hosted development và production dùng Keycloak/public API config được đóng vào bundle lúc build. `.env` chỉ dành cho backend, AI và Compose; server secrets không được đưa vào Angular environments. Nginx non-root phục vụ SPA trên port `3000`, fallback deep link về `index.html` và cung cấp `/health`.

## Deploy

Push `dev` hoặc `main` chạy CI rồi kích hoạt `.github/workflows/deploy.yml` khi đúng commit đã pass. Workflow build ba image theo commit SHA, dùng strict SSH known hosts, triển khai vào `/opt/startflow-agent/<env>`, chạy Prisma/Alembic migration trước khi thay container, kiểm tra readiness và chỉ rollback các container StartFlow nếu application không sẵn sàng.

Xem [deployment](docs/deployment.md) để cấu hình GitHub Environment/secrets, Angular build environment, port, domain và release path riêng trên shared droplet.

## Tài liệu

- [Kiến trúc và data flow](docs/architecture.md)
- [Kịch bản demo tối đa 10 phút](docs/demo-script.md)
- [Nguồn dữ liệu demo](docs/data-sources.md)
- [Security model](docs/security.md)
- [Deployment](docs/deployment.md)
- [Product acceptance criteria](product/acceptance-criteria/startflow-credit-assessment.md)
