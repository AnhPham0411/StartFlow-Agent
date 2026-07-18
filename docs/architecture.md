# Kiến trúc StartFlow

## Bối cảnh và quyết định

StartFlow tách web, application API và AI orchestration thành ba service để mỗi phần có contract và failure boundary rõ. PostgreSQL 18, Keycloak và Qdrant là dependency có sẵn và chỉ được tham chiếu qua env.

| Component         | Trách nhiệm                                                   | Entrypoint                          |
| ----------------- | ------------------------------------------------------------- | ----------------------------------- |
| Next.js           | UI role-aware, Keycloak PKCE, REST/SSE client                 | `frontend/app`, port 3000           |
| NestJS            | auth/roles, cases/snapshots, lifecycle, SSE, approvals, audit | `backend/src/main.ts`, port 3001    |
| FastAPI/LangGraph | planner, specialists, tools, RAG, synthesis                   | `ai-service/src/main.py`, port 8000 |
| PostgreSQL app DB | case, snapshot, run, event, approval, audit, comparison       | Prisma migrations                   |
| PostgreSQL AI DB  | ingestion jobs và evaluation results                          | Alembic migrations                  |
| Qdrant            | knowledge chunks, payload metadata và vector similarity       | external REST API                   |
| Keycloak          | browser login, JWT issuer/audience và realm roles             | external OIDC                       |

## Luồng đánh giá

1. Analyst tạo case demo; NestJS validate và lưu case.
2. Khi tạo run, backend đóng băng case vào `CaseSnapshot` kèm content hash.
3. Backend tạo `WorkflowRun` và gọi AI qua internal service token.
4. Planner tạo ba task `CREDIT`, `COMPLIANCE`, `OPERATIONS` cho mode `MULTI`.
5. Specialist dùng tool/RAG, phát public events đã lọc về callback NestJS.
6. NestJS lưu event theo sequence/idempotency và phát lại qua SSE.
7. Synthesizer hợp nhất findings thành `RECOMMEND`, `NEEDS_REVIEW` hoặc `BLOCKED`.
8. Hành động đề xuất chỉ tạo ticket sau quyết định của user role `approver`.

Mode `SINGLE` là baseline riêng trên cùng snapshot; nó không giả lập ba specialist. Comparison trả sáu metric demo và công khai `metricsSource`.

## Contract và dữ liệu

`packages/contracts` là canonical public vocabulary cho TypeScript và sinh JSON Schema để Python kiểm tra parity. Public event chỉ chứa plan, tool summary, citation, finding, status và decision; prompt nội bộ/scratchpad/chain-of-thought không thuộc contract.

Backend dùng hai uniqueness constraint quan trọng:

- `(run_id, sequence)` và `(run_id, idempotency_key)` cho event;
- một `Approval` và một `ActionTicket` trên mỗi run.

## Failure model

- `/health` chỉ chứng minh process sống; `/ready` kiểm tra dependency.
- Một specialist lỗi tạo kết quả `PARTIAL`, lane lỗi vẫn hiển thị và confidence không được tăng.
- Callback có retry/idempotency; SSE client resume từ event cuối.
- Migration deploy chạy trước khi thay long-running container; rollback application không rollback database migration.

## Trade-off hackathon

- Knowledge/demo rubric deterministic ưu tiên khả năng trình diễn lặp lại hơn đánh giá tín dụng thực.
- Qdrant có sẵn tách vector search khỏi PostgreSQL và loại bỏ yêu cầu cài extension pgvector.
- Background run endpoint trả `202`; UI quan sát tiến trình qua persisted events thay vì giữ HTTP request dài.
