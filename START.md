# Khởi động StartFlow

Hướng dẫn này chạy ba ứng dụng StartFlow bằng Docker và kết nối tới PostgreSQL 18, Keycloak và Qdrant mà bạn đã có. StartFlow không cài hoặc điều khiển các dịch vụ đó.

## 1. Chuẩn bị

- Cài Docker Desktop và bảo đảm `docker compose version` chạy được.
- PostgreSQL 18 phải cho phép droplet/máy local kết nối và có database/user cho StartFlow.
- Keycloak phải có realm, public browser client, integration client và các role `analyst`, `approver`, `admin`, `sale`, `manager` như `infra/keycloak/realm.example.json`.
- Qdrant phải cho phép droplet/máy local kết nối và có API key phù hợp.
- Nếu dùng LLM thật, chuẩn bị API key. Với demo có thể giữ `LLM_MODE=mock`.

## 2. Tạo env local

Trong PowerShell tại thư mục repository:

```powershell
Copy-Item .env.example .env
notepad .env
```

Thay toàn bộ placeholder `[REDACTED_REQUIRED]`. Tối thiểu cần kiểm tra:

- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`;
- `QDRANT_URL`, `QDRANT_API_KEY`, `QDRANT_COLLECTION`, `QDRANT_VECTOR_SIZE`;
- `KEYCLOAK_URL`, `KEYCLOAK_ISSUER`, `KEYCLOAK_REALM`, `KEYCLOAK_SECRET`;
- `INTERNAL_SERVICE_TOKEN` dài tối thiểu 16 ký tự.

Angular không đọc file `.env`. API URL và public Keycloak config nằm trong `frontend/src/environments/` và được chọn khi build. Không đặt client secret, internal token, database URL hoặc API key trong các file đó. Không commit `.env`, certificate hoặc API key.

## 3. Build, migrate và chạy

```powershell
docker compose build
docker compose run --rm backend-migrate
docker compose run --rm ai-migrate
docker compose up -d backend ai-service frontend
```

`ai-migrate` chỉ nâng schema. Nếu muốn nạp lại ba knowledge seed demo theo cách idempotent:

```powershell
docker compose run --rm ai-service python -m src.rag.ingest
```

## 4. Kiểm tra

```powershell
Invoke-RestMethod http://localhost:3201/health
Invoke-RestMethod http://localhost:3201/ready
Invoke-RestMethod http://localhost:3200/health
docker compose ps
```

Sau đó mở `http://localhost:3200`. Build local dùng mock user demo; repository không chứa username/password mặc định. Mở trực tiếp một deep link như `/cases` hoặc `/comparisons` vẫn trả Angular shell nhờ SPA fallback của Nginx.

## 5. Phát triển frontend từ source

Docker Compose mặc định build Angular configuration `local`. Để chạy Angular dev server và các quality checks:

```powershell
pnpm install --frozen-lockfile
pnpm --filter @startflow/frontend dev
pnpm --filter @startflow/frontend lint
pnpm --filter @startflow/frontend typecheck
pnpm --filter @startflow/frontend test
```

`pnpm --filter @startflow/frontend dev` dùng `environment.ts` (local API + mock auth). Để kiểm tra hosted development/production config, dùng lần lượt `build:development` hoặc `build:production`; public frontend config thay đổi chỉ có hiệu lực sau khi build lại.

## Sự cố thường gặp

- `401`: kiểm tra issuer/audience/client mapper trong Keycloak và đăng nhập lại.
- `403`: user thiếu `analyst`, `approver` hoặc `admin` cho thao tác đang dùng.
- Backend `/ready` lỗi: kiểm tra các biến `DB_*`, TLS và AI service.
- AI `/ready` lỗi: kiểm tra Alembic/PostgreSQL cùng `QDRANT_*`, quyền collection và kết nối Qdrant.
- Frontend container không healthy: xem `docker compose logs frontend` và kiểm tra image đã build đúng Angular configuration.
- Browser gọi sai API: sửa file tương ứng trong `frontend/src/environments/`, build lại frontend image rồi recreate container.
- Deep link trả 404: xác nhận request đi tới frontend Nginx container và `frontend/nginx.conf` đang được dùng.
- Port bị chiếm: đổi `FRONTEND_PORT`/`BACKEND_PORT` trong `.env`.

Để dừng ba application containers:

```powershell
docker compose down
```

Lệnh này không tác động PostgreSQL, Keycloak hoặc Qdrant vì chúng không nằm trong Compose.
