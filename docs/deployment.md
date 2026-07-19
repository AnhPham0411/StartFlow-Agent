# Deployment độc lập trên shared droplet

## Phạm vi

StartFlow chỉ dùng chung máy chủ vật lý với các ứng dụng khác. Repository này tự sở hữu GitHub Actions workflow, Docker images, release script, Nginx templates và rollback; không checkout, gọi hoặc sửa repository deployment nào khác.

PostgreSQL 18, Keycloak và Qdrant tiếp tục là external dependencies được cung cấp qua env. Workflow StartFlow không provision, restart hoặc thay đổi vòng đời của các dịch vụ đó.

## Cách ly trên droplet

Mỗi môi trường phải dùng namespace riêng:

| Tài nguyên      | Giá trị khuyến nghị                                                                                  |
| --------------- | ---------------------------------------------------------------------------------------------------- |
| Release root    | `/opt/startflow-agent/dev`, `/opt/startflow-agent/prod` hoặc root riêng qua `STARTFLOW_DROPLET_ROOT` |
| Compose project | `startflow-dev`, `startflow-prod`                                                                    |
| Docker network  | `startflow-dev`, `startflow-prod`                                                                    |
| Container names | `startflow-frontend-*`, `startflow-backend-*`, `startflow-ai-*`                                      |
| Host ports      | DEV `3200/3201`, PROD `3300/3301`; không xung đột với app khác                                       |
| Nginx sites     | `startflow-<env>-frontend.conf`, `startflow-<env>-backend.conf`                                      |
| Domains         | app/API subdomain riêng của StartFlow                                                                |

Frontend container tự chạy Nginx non-root ở port `3000`; Nginx trên host chỉ terminate TLS và reverse proxy tới host port riêng của environment. Không dùng port, container name, Compose project hoặc Nginx site của ứng dụng khác.

## GitHub configuration

Tạo GitHub Environment `development`, sau đó cấu hình đúng hai secrets:

| Secret/variable                   | Nội dung                                                                       |
| --------------------------------- | ------------------------------------------------------------------------------ |
| `STARTFLOW_DEV`                   | runtime và deploy metadata dạng multiline `KEY=value`, dựa trên `.env.example` |
| `SSH_PRIVATE_KEY_DEV`             | private key của SSH deploy user                                                |
| Variable `STARTFLOW_DROPLET_ROOT` | tùy chọn; workflow tự dùng namespace `/opt/startflow-agent/dev`                |

`STARTFLOW_DEV` phải có toàn bộ runtime keys cùng `DROPLET_HOST`, `DROPLET_USER` và một verified OpenSSH known-host line trong `DROPLET_SSH_KNOWN_HOSTS`. Nếu PostgreSQL dùng CA riêng, thêm `POSTGRES_CA_CERT_BASE64` ngay trong secret này. Workflow validate các giá trị, export metadata cho SSH rồi loại chúng khỏi runtime `.env` trước khi upload.

PostgreSQL được cấu hình bằng `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_SSL_MODE` và `DB_SSL_ROOT_CERT`. Không đặt `DATABASE_URL` hoặc `AI_DATABASE_URL` trong GitHub secret; backend và AI service tự tạo DSN đã URL-encode trong process runtime.

Qdrant được cấu hình bằng `QDRANT_URL`, `QDRANT_API_KEY`, `QDRANT_COLLECTION` và `QDRANT_VECTOR_SIZE`. Service `ai-seed` tạo collection nếu chưa có, kiểm tra cosine/vector size rồi nạp knowledge seed theo cách idempotent. Các giá trị này phải nằm trong `STARTFLOW_DEV`/`STARTFLOW_PROD`; StartFlow không tạo Qdrant container trên droplet.

Không cần tạo các secrets rời `DROPLET_HOST`, `DROPLET_USER`, `DROPLET_SSH_KNOWN_HOSTS` hoặc `POSTGRES_TLS_CA_BASE64`. Production được giữ tách biệt và chỉ dùng `STARTFLOW_PROD` cùng `SSH_PRIVATE_KEY_PROD` khi deploy branch `main`; workflow không fallback sang dev secrets.

## Frontend build environment

Frontend dùng typed Angular environments:

| Configuration | Source file                                           | Use case                            |
| ------------- | ----------------------------------------------------- | ----------------------------------- |
| `local`       | `frontend/src/environments/environment.ts`            | Local API + deterministic mock auth |
| `development` | `frontend/src/environments/environment.development.ts` | Hosted development + Keycloak       |
| `production`  | `frontend/src/environments/environment.production.ts`  | Production API + Keycloak           |

Workflow chọn `development` cho branch `dev` và `production` cho `main`, sau đó truyền `STARTFLOW_BUILD_CONFIGURATION` vào Docker build. Compose local mặc định build cấu hình `local`; production overlay ép `production`.

Các giá trị này đều xuất hiện trong browser bundle. Không đặt client secret, database URL, LLM key hoặc `INTERNAL_SERVICE_TOKEN` vào environment Angular. Đổi public frontend config yêu cầu build lại frontend image; `.env` chỉ còn phục vụ backend, AI service, Compose ports/domains và deployment secrets.

## Pipeline độc lập

1. Push `dev` hoặc `main` chạy CI; deploy workflow chỉ tiếp tục khi CI của đúng commit thành công.
2. Workflow validate shell/static deployment tests và build ba immutable image theo commit SHA.
3. Bundle gồm images, Compose, validated env, deploy script và host Nginx templates được chuyển qua strict SSH tới release root riêng.
4. Remote script kiểm tra Keycloak discovery, Docker Compose config và Docker network riêng.
5. Chạy `backend-migrate`, `ai-migrate`, rồi seed profile backend trước khi thay container. Khi `STARTFLOW_ENABLE_IDENTITY_SEED=true`, deploy tiếp tục đồng bộ 30 identity/role sang Keycloak bằng service account; mật khẩu tạm chỉ lấy từ runtime secret và không được ghi log.
6. Start ba StartFlow containers và chờ backend `/ready`, frontend Nginx `/health`.
7. Render host Nginx config, chạy `nginx -t`, reload, xác minh route TLS và cập nhật symlink release.
8. Chạy knowledge `ai-seed` idempotent với timeout; lỗi Qdrant được cảnh báo nhưng không làm website/API đã healthy bị rollback.
9. Nếu application không ready trước khi cập nhật symlink, chỉ các StartFlow containers được phục hồi về release trước. Database migration vẫn forward-only.

## Droplet prerequisites

- Docker Engine, Docker Compose v2, curl và Nginx.
- Deploy user có quyền Docker và quyền `sudo` giới hạn để cài/reload Nginx config.
- Hai domain đã trỏ DNS tới droplet.
- Certbot và webroot `/var/www/html` phải có sẵn; deploy tái sử dụng certificate hiện có hoặc yêu cầu certificate mới rồi fail closed nếu không thể cấp.
- Host ports đã được kiểm tra không xung đột.
- Droplet được PostgreSQL/Keycloak/Qdrant cho phép kết nối.

## Kiểm tra trước khi phát hành

```bash
bash -n infra/deploy/prepare-env.sh
bash -n infra/deploy/deploy.sh
bash infra/deploy/tests/prepare-env.test.sh
bash infra/deploy/tests/deploy.test.sh
bash infra/deploy/tests/workflow.test.sh
STARTFLOW_ENV_FILE=.env.example docker compose --env-file .env.example config --quiet
STARTFLOW_ENV_FILE=.env.production.example docker compose --env-file .env.production.example -f docker-compose.yml -f docker-compose.prod.yml config --quiet
```

Container smoke cần xác nhận `GET /health` trả `200` và mở trực tiếp `/runs/<id>` trả Angular shell.

## Kích hoạt

Push vào `dev` deploy environment `development`; push vào `main` deploy `production`. Có thể chạy `workflow_dispatch` để thử thủ công trên branch đã chọn; branch khác `main` luôn dùng environment development.

Trước lần đầu deploy, review domain/port, SSH known-hosts, DB grants/TLS, Qdrant URL/API key/collection, Keycloak redirect URI/web origin và backup/migration policy.
