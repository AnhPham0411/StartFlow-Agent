# Kiến trúc StartFlow

## Bối cảnh và quyết định

StartFlow tách web, application API và AI orchestration thành ba service để mỗi phần có contract và failure boundary rõ. PostgreSQL 18 cùng Keycloak là dependency có sẵn và chỉ được tham chiếu qua env.

| Component                        | Trách nhiệm                                                       | Entrypoint                            |
| -------------------------------- | ----------------------------------------------------------------- | ------------------------------------- |
| Angular 20 + `@sdcorejs/angular` | Portal role-aware, Keycloak PKCE, REST/SSE client                 | `frontend/src/main.ts`                |
| Nginx unprivileged               | Phục vụ Angular static, SPA fallback và `/health`                 | container port `3000`                 |
| NestJS                           | auth/roles, cases/snapshots, lifecycle, SSE, approvals, audit     | `backend/src/main.ts`, port `3001`    |
| FastAPI/LangGraph                | planner, specialists, tools, RAG, synthesis                       | `ai-service/src/main.py`, port `8000` |
| PostgreSQL app DB                | case, snapshot, run, event, approval, audit, comparison           | Prisma migrations                     |
| PostgreSQL AI DB                 | knowledge documents/chunks/embeddings                             | Alembic migrations                    |
| Keycloak                         | browser login, JWT issuer/audience và realm roles                 | external OIDC                         |

Angular dùng standalone components, signals, OnPush và lazy feature routes. `@sdcorejs/angular` cung cấp layout, page, table, form, badge, loading, notify và confirmation controls; `@startflow/contracts` vẫn là public domain vocabulary dùng chung với backend.

## Frontend bootstrap và build environment

Angular chọn typed public configuration từ `frontend/src/environments/` khi build. `angular.json` dùng `fileReplacements` cho hosted development và production; cấu hình local giữ API `localhost` cùng mock auth phục vụ phát triển.

Các giá trị browser-visible gồm API base URL, auth mode, Keycloak origin, realm và public client ID. Chúng được đóng vào JavaScript bundle nên tuyệt đối không chứa client secret, database URL, internal token hoặc LLM key. Những secret/server settings đó vẫn được backend và AI service đọc từ process environment.

Build stage tạo `frontend/dist/startflow/browser` theo `STARTFLOW_BUILD_CONFIGURATION=local|development|production`; runtime stage chỉ chạy Nginx non-root trên port `3000`. Thay public frontend configuration cần build lại image tương ứng.

Nginx đặt `Cache-Control: no-store` cho `index.html`, cache immutable cho hashed assets, dùng `try_files` để mọi route Angular deep link quay về `index.html`, và trả `200` tại `/health` mà không phụ thuộc backend.

## Luồng đánh giá

1. Analyst tạo case demo; NestJS validate và lưu case.
2. Khi tạo run, backend đóng băng case vào `CaseSnapshot` kèm content hash.
3. Backend tạo `WorkflowRun` và gọi AI qua internal service token.
4. Planner tạo ba task `CREDIT`, `COMPLIANCE`, `OPERATIONS` cho mode `MULTI`.
5. Specialist dùng tool/RAG, phát public events đã lọc về callback NestJS.
6. NestJS lưu event theo sequence/idempotency và phát lại qua SSE.
7. Angular fetch-stream client gửi bearer token, resume bằng `Last-Event-ID` và loại event trùng.
8. Synthesizer hợp nhất findings thành `RECOMMEND`, `NEEDS_REVIEW` hoặc `BLOCKED`.
9. Hành động đề xuất chỉ tạo ticket sau quyết định của user role `approver`.

Mode `SINGLE` là baseline riêng trên cùng snapshot; nó không giả lập ba specialist. Comparison trả sáu metric demo và công khai `metricsSource`.

## Contract và dữ liệu

`packages/contracts` là canonical public vocabulary cho TypeScript và sinh JSON Schema để Python kiểm tra parity. Public event chỉ chứa plan, tool summary, citation, finding, status và decision; prompt nội bộ/scratchpad/chain-of-thought không thuộc contract.

Backend dùng hai uniqueness constraint quan trọng:

- `(run_id, sequence)` và `(run_id, idempotency_key)` cho event;
- một `Approval` và một `ActionTicket` trên mỗi run.

## Failure model

- Frontend Nginx `/health` chứng minh static runtime sống; backend `/health` kiểm tra process và `/ready` kiểm tra dependencies.
- Runtime config hoặc production auth không hợp lệ làm frontend container fail trước khi Nginx nhận traffic.
- Một specialist lỗi tạo kết quả `PARTIAL`; lane lỗi vẫn hiển thị và confidence không được tăng.
- Callback có retry/idempotency; SSE client resume từ event cuối và giữ persisted timeline khi reconnect.
- Migration deploy chạy trước khi thay long-running container; rollback application không rollback database migration.

## Trade-off hackathon

- Knowledge/demo rubric deterministic ưu tiên khả năng trình diễn lặp lại hơn đánh giá tín dụng thực.
- PostgreSQL/pgvector giảm số datastore phải vận hành trong 48 giờ.
- Background run endpoint trả `202`; UI quan sát tiến trình qua persisted events thay vì giữ HTTP request dài.
