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
Browser / Next.js :3000
        │ REST + authenticated SSE
        ▼
NestJS API :3001 ───────► PostgreSQL 18 có sẵn
        │ internal token        (app data + audit)
        ▼
FastAPI + LangGraph :8000 ─► Planner / Credit / Compliance / Operations / Synthesizer
        │                    └► calculator, mock KYC/AML, checklist, RAG
        └──────────────────► PostgreSQL 18 + pgvector có sẵn

Browser ── Authorization Code + PKCE ──► Keycloak có sẵn
```

Repository chỉ chạy ba application containers: `frontend`, `backend`, `ai-service`. Docker Compose và deploy workflow không provision hoặc restart PostgreSQL/Keycloak.

## Cấu trúc

```text
backend/             NestJS, Prisma, JWT/JWKS, SSE, approval/audit
frontend/            Next.js App Router, Keycloak PKCE, decision workspace
ai-service/          FastAPI, LangGraph, tools, RAG, Alembic
packages/contracts/  Zod + JSON Schema public contracts
knowledge/seed/      chính sách demo không chứa dữ liệu khách hàng
infra/keycloak/      realm/client/roles template cho Keycloak có sẵn
infra/deploy/        standalone deploy scripts, tests và Nginx templates
product/             PRD, stories, acceptance criteria, UAT
design/              flow, UI spec và wireframe
test/                contract tests và Playwright journey
docs/                kiến trúc, security, deploy và demo script
```

## Chạy nhanh

Yêu cầu Node.js 22, pnpm 10, Docker Compose và quyền truy cập PostgreSQL 18/Keycloak có sẵn.

```powershell
Copy-Item .env.example .env
# Điền các biến DB_* và credential thật vào .env; không commit file này.

pnpm install --frozen-lockfile
docker compose build
docker compose run --rm backend-migrate
docker compose run --rm ai-migrate
docker compose up -d backend ai-service frontend
```

Mở `http://localhost:3200`. API readiness ở `http://localhost:3201/ready`; AI readiness được kiểm tra nội bộ tại `http://ai-service:8000/ready`.

Không có tài khoản mặc định trong repository. Tạo/gán user với role `analyst`, `approver` hoặc `admin` trong Keycloak hiện hữu. Hướng dẫn chi tiết nằm ở [START.md](START.md).

## Lệnh kiểm tra

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
docker compose --env-file .env.example config --quiet
```

Python quality/tests được khóa bằng `ai-service/uv.lock` và chạy trong CI qua `uv`. Playwright e2e dùng auth/API mock ở browser boundary, không ghi dữ liệu vào PostgreSQL/Keycloak có sẵn.

## Deploy

Push `dev` hoặc `main` chạy CI rồi kích hoạt workflow độc lập `.github/workflows/deploy.yml` ngay trong repository này khi CI thành công. Workflow build ba image theo commit SHA, dùng strict SSH known hosts, triển khai vào `/opt/startflow-agent/<env>`, chạy Prisma/Alembic migration trước khi thay container, health-check và chỉ rollback các container StartFlow nếu application không ready.

Xem [deployment](docs/deployment.md) để cấu hình GitHub Environment/secrets, port, domain và release path riêng trên shared droplet.

## Tài liệu

- [Kiến trúc và data flow](docs/architecture.md)
- [Kịch bản demo tối đa 10 phút](docs/demo-script.md)
- [Nguồn dữ liệu demo](docs/data-sources.md)
- [Security model](docs/security.md)
- [Deployment](docs/deployment.md)
- [Product acceptance criteria](product/acceptance-criteria/startflow-credit-assessment.md)
