# Security model

## Trust boundaries

- Browser dùng Keycloak Authorization Code + PKCE. Token nằm trong memory, không ghi `localStorage`/`sessionStorage`.
- NestJS xác thực JWT theo exact issuer/audience và map realm roles `analyst`, `approver`, `admin`.
- NestJS ↔ FastAPI dùng `X-Internal-Service-Token`; callback còn ký HMAC-SHA256 trên timestamp và raw body, với cửa sổ chống replay 5 phút.
- PostgreSQL và Keycloak là external dependencies; Compose/deploy không provision hoặc restart chúng.

## Authorization

| Hành động                      | Role       |
| ------------------------------ | ---------- |
| Tạo/xem case và run            | `analyst`  |
| Approve/reject proposed action | `approver` |
| List/ingest knowledge          | `admin`    |

UI ẩn action không đủ quyền để hỗ trợ trải nghiệm, nhưng API guard mới là lớp enforcement.

## AI safety

- Public contract cấm chain-of-thought/scratchpad; chỉ lưu summary, finding, tool output đã lọc và citation.
- LLM mode mock deterministic không cần API key. Production buộc `openai-compatible` và API key.
- Demo input bắt buộc `demoData=true`; không dùng dữ liệu khách hàng thật.
- Logging redaction che authorization, cookie, token, password và key phổ biến.
- Hành động nhạy cảm cần human approval; optimistic concurrency ngăn double-submit tạo hai ticket.
- NestJS kiểm tra callback signature bằng constant-time comparison; raw body không được log hoặc lưu như một trace nội bộ.

## Secret và deployment

- Chỉ commit `.env*.example`; runtime env, SSH key và PostgreSQL CA nằm trong GitHub Environment secrets.
- Deploy ghi env/certificate mode 600, dùng supplied `known_hosts`, không chạy `ssh-keyscan` để tự tin host mới.
- Image được tag theo commit SHA. Health failure phục hồi release container trước; migration là forward-only.

## Ngoài phạm vi MVP

Pen-test, HSM/KMS, mTLS nội bộ, policy-as-code, DLP, model red-teaming và production data retention chưa được triển khai trong scaffold hackathon.
