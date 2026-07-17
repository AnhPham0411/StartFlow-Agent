# Khởi động StartFlow

Hướng dẫn này chạy ba ứng dụng StartFlow bằng Docker và kết nối tới PostgreSQL 18/Keycloak mà bạn đã có. StartFlow không cài hoặc điều khiển hai dịch vụ đó.

## 1. Chuẩn bị

- Cài Docker Desktop và bảo đảm `docker compose version` chạy được.
- PostgreSQL 18 phải cho phép droplet/máy local kết nối và có hai database/user cho app và AI.
- Keycloak phải có realm, browser client và các role `analyst`, `approver`, `admin` như `infra/keycloak/realm.example.json`.
- Nếu dùng LLM thật, chuẩn bị API key. Với demo có thể giữ `LLM_MODE=mock`.

## 2. Tạo env local

Trong PowerShell tại thư mục repository:

```powershell
Copy-Item .env.example .env
notepad .env
```

Thay toàn bộ placeholder `[REDACTED_REQUIRED]`. Tối thiểu cần kiểm tra:

- `DATABASE_URL`, `AI_DATABASE_URL`;
- `KEYCLOAK_URL`, `KEYCLOAK_ISSUER`, realm/client/audience và các `NEXT_PUBLIC_KEYCLOAK_*`;
- `INTERNAL_SERVICE_TOKEN` dài tối thiểu 16 ký tự;
- `NEXT_PUBLIC_API_URL` trỏ tới URL backend mà browser truy cập được.

Không commit `.env`, certificate hoặc API key.

## 3. Build, migrate và chạy

```powershell
docker compose build
docker compose run --rm backend-migrate
docker compose run --rm ai-migrate
docker compose up -d backend ai-service frontend
```

`ai-migrate` cũng nạp idempotent ba knowledge seed demo. Nếu muốn nạp lại thủ công:

```powershell
docker compose run --rm ai-service python -m src.rag.ingest
```

## 4. Kiểm tra

```powershell
Invoke-RestMethod http://localhost:3001/health
Invoke-RestMethod http://localhost:3001/ready
Invoke-RestMethod http://localhost:3000/api/health
docker compose ps
```

Sau đó mở `http://localhost:3000` và đăng nhập bằng user đã được gán role trong Keycloak. Repository không chứa username/password mặc định.

## Sự cố thường gặp

- `401`: kiểm tra issuer/audience/client mapper trong Keycloak và đăng nhập lại.
- `403`: user thiếu `analyst`, `approver` hoặc `admin` cho thao tác đang dùng.
- Backend `/ready` lỗi: kiểm tra `DATABASE_URL`, TLS và AI service.
- AI `/ready` lỗi: kiểm tra `AI_DATABASE_URL`, Alembic migration và certificate PostgreSQL.
- Browser gọi sai API: `NEXT_PUBLIC_*` được đóng vào image lúc build; sửa env rồi build lại frontend.
- Port bị chiếm: đổi `FRONTEND_PORT`/`BACKEND_PORT` trong `.env`.

Để dừng ba application containers:

```powershell
docker compose down
```

Lệnh này không tác động PostgreSQL hoặc Keycloak vì chúng không nằm trong Compose.
