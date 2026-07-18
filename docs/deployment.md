# Deployment độc lập trên shared droplet

## Phạm vi

StartFlow chỉ dùng chung máy chủ vật lý với các ứng dụng khác. Repository này tự sở hữu GitHub Actions workflow, Docker images, release script, Nginx templates và rollback; không checkout, gọi hoặc sửa repository deployment nào khác.

PostgreSQL 18 và Keycloak tiếp tục là external dependencies được cung cấp qua env. Workflow StartFlow không provision, restart hoặc thay đổi vòng đời của hai dịch vụ đó.

## Cách ly trên droplet

Mỗi môi trường phải dùng namespace riêng:

| Tài nguyên       | Giá trị khuyến nghị                                                                                  |
| ---------------- | ---------------------------------------------------------------------------------------------------- |
| Release root     | `/opt/startflow-agent/dev`, `/opt/startflow-agent/prod` hoặc root riêng qua `STARTFLOW_DROPLET_ROOT` |
| Compose project  | `startflow-dev`, `startflow-prod`                                                                    |
| Docker network   | `startflow-dev`, `startflow-prod`                                                                    |
| Container names  | `startflow-frontend-*`, `startflow-backend-*`, `startflow-ai-*`                                      |
| Host ports       | cặp port riêng, ví dụ `3100/3101`                                                                    |
| Host Nginx sites | `startflow-<env>-frontend.conf`, `startflow-<env>-backend.conf`                                      |
| Domains          | app/API subdomain riêng của StartFlow                                                                |

Frontend container tự chạy Nginx non-root ở port `3000`; Nginx trên host chỉ terminate TLS và reverse proxy tới host port riêng của environment. Không dùng port, container name, Compose project hoặc Nginx site của ứng dụng khác.

## GitHub configuration

Tạo GitHub Environments `development` và `production`, sau đó cấu hình:

| Secret/variable                   | Nội dung                                                              |
| --------------------------------- | --------------------------------------------------------------------- |
| `STARTFLOW_ENV`                   | toàn bộ runtime `KEY=value`, dựa trên `.env.production.example`       |
| `DROPLET_HOST`                    | hostname/IP của shared droplet                                        |
| `DROPLET_USER`                    | SSH deploy user                                                       |
| `SSH_PRIVATE_KEY`                 | private key deploy                                                    |
| `DROPLET_SSH_KNOWN_HOSTS`         | verified host-key line lấy từ kênh tin cậy                            |
| `POSTGRES_TLS_CA_BASE64`          | CA certificate base64 khi dùng `verify-ca`/`verify-full`              |
| Variable `STARTFLOW_DROPLET_ROOT` | tùy chọn theo từng environment; mặc định `/opt/startflow-agent/<env>` |

`STARTFLOW_ENV` phải có `DEPLOY_ENV`, `APP_DOMAIN`, `API_DOMAIN`, port riêng, `STARTFLOW_NETWORK`, database URLs, Keycloak backend config, LLM config và internal token. Runtime secret không được chứa placeholder. Dùng cùng tên secret ở hai GitHub Environments; mỗi environment lưu giá trị riêng.

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
5. Chạy `backend-migrate`, sau đó `ai-migrate` và idempotent knowledge seed.
6. Start ba StartFlow containers và chờ backend `/ready`, frontend Nginx `/health`.
7. Render host Nginx config, chạy `nginx -t`, reload và cập nhật symlink release.
8. Nếu application không ready, chỉ các StartFlow containers được phục hồi về release trước. Database migration vẫn forward-only.

## Droplet prerequisites

- Docker Engine, Docker Compose v2, curl và Nginx.
- Deploy user có quyền Docker và quyền `sudo` giới hạn để cài/reload Nginx config.
- Hai domain đã trỏ DNS tới droplet.
- Certbot/TLS certificate đã có tại `/etc/letsencrypt/live/<domain>/`; deploy fail closed nếu thiếu certificate/key.
- Host ports đã được kiểm tra không xung đột.
- Droplet được PostgreSQL/Keycloak cho phép kết nối.

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

Trước lần đầu deploy, review domain/port, SSH known-hosts, DB grants/TLS, Keycloak redirect URI/web origin và backup/migration policy.
