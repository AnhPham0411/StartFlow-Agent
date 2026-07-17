# Living TODO — fullstack — StartFlow Agent

> Danh sách tiếp nối sau scaffold ngày 2026-07-17. `[ ]` đang mở, `[x]` hoàn tất, `[!]` bị chặn bởi môi trường.

## Now

- [ ] Cấu hình GitHub Environment với runtime env, domain, SSH known-hosts/key và PostgreSQL TLS.
- [ ] Chạy CI rồi deploy environment `development` lên app droplet.
- [ ] Chạy UAT checklist và demo journey trong tối đa 10 phút.

## Next

- [ ] Xác nhận PostgreSQL 18 có extension `vector` và quyền migration cho app/AI schemas.
- [ ] Chuyển sang LLM provider thật sau khi mock-mode demo đã ổn định.

## Later

- [ ] Bổ sung screenshot/recording của demo và kết quả CI/deploy vào hồ sơ hackathon.

## Blocked

- [!] Local Docker image build — Docker daemon trên máy hiện đang tắt; CI sẽ thực hiện build.
- [!] Live Keycloak/PostgreSQL verification — chưa có runtime credentials trong workspace.

## Done (last 7 days)

- [x] (2026-07-17) Scaffold Next.js, NestJS và FastAPI/LangGraph services.
- [x] (2026-07-17) Hoàn tất external Keycloak/PostgreSQL env contract, Docker Compose và GitHub Actions.
- [x] (2026-07-17) Chạy review/repair và toàn bộ verification khả dụng trên máy local.

## Stale

- Không có.
