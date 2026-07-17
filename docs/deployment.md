# Deployment độc lập trên shared droplet

## Phạm vi

StartFlow chỉ dùng chung máy chủ vật lý với các ứng dụng khác. Repository này tự sở hữu GitHub Actions workflow, Docker images, release script, Nginx templates và rollback của mình; không checkout, gọi hoặc sửa repository deployment nào khác.

PostgreSQL 18 và Keycloak tiếp tục là external dependencies được cung cấp qua env. Workflow StartFlow không provision, restart hoặc thay đổi vòng đời của hai dịch vụ đó.

## Cách ly trên droplet

Mỗi môi trường phải dùng namespace riêng:

| Tài nguyên      | Giá trị khuyến nghị                                                                                  |
| --------------- | ---------------------------------------------------------------------------------------------------- |
| Release root    | `/opt/startflow-agent/dev`, `/opt/startflow-agent/prod` hoặc root riêng qua `STARTFLOW_DROPLET_ROOT` |
| Compose project | `startflow-dev`, `startflow-prod`                                                                    |
| Docker network  | `startflow-dev`, `startflow-prod`                                                                    |
| Container names | `startflow-frontend-*`, `startflow-backend-*`, `startflow-ai-*`                                      |
| Host ports      | cặp port riêng, ví dụ `3100/3101`                                                                    |
| Nginx sites     | `startflow-<env>-frontend.conf`, `startflow-<env>-backend.conf`                                      |
| Domains         | app/API subdomain riêng của StartFlow                                                                |

Không dùng port, container name, Compose project hoặc Nginx site của ứng dụng đang có trên droplet.

## GitHub configuration

Tạo GitHub Environments `development` và `production`, sau đó cấu hình:

| Secret/variable                   | Nội dung                                                                     |
| --------------------------------- | ---------------------------------------------------------------------------- |
| `STARTFLOW_ENV`                   | toàn bộ runtime `KEY=value`, dựa trên `.env.production.example`              |
| `DROPLET_HOST`                    | hostname/IP của shared droplet                                               |
| `DROPLET_USER`                    | SSH deploy user                                                              |
| `SSH_PRIVATE_KEY`                 | private key deploy                                                           |
| `DROPLET_SSH_KNOWN_HOSTS`         | verified host-key line lấy từ kênh tin cậy                                   |
| `POSTGRES_TLS_CA_BASE64`          | CA certificate base64 khi dùng `verify-ca`/`verify-full`                     |
| Variable `STARTFLOW_DROPLET_ROOT` | tùy chọn theo từng GitHub Environment; mặc định `/opt/startflow-agent/<env>` |

`STARTFLOW_ENV` phải có `DEPLOY_ENV`, `APP_DOMAIN`, `API_DOMAIN`, port riêng, `STARTFLOW_NETWORK`, database URLs, Keycloak config, LLM config và internal token. Runtime secret không được chứa placeholder. Dùng cùng tên secret ở hai GitHub Environments; mỗi environment lưu giá trị riêng.

## Pipeline độc lập

1. Push `dev` hoặc `main` chạy CI; deploy workflow chỉ tiếp tục khi CI của đúng commit thành công.
2. Workflow tự validate `infra/deploy`, build ba image theo commit SHA và tạo release bundle.
3. Bundle được chuyển qua strict SSH tới release root riêng của StartFlow.
4. Remote script kiểm tra Keycloak discovery và Docker network riêng.
5. Chạy `backend-migrate`, sau đó `ai-migrate` và idempotent knowledge seed.
6. Start ba StartFlow containers và chờ backend `/ready`, frontend `/api/health`.
7. Render Nginx config riêng, chạy `nginx -t`, reload và cập nhật symlink release.
8. Nếu application không ready, chỉ các StartFlow containers được phục hồi về release trước. Database migration vẫn forward-only.

## Droplet prerequisites

- Docker Engine, Docker Compose v2, curl và Nginx.
- Deploy user có quyền Docker và quyền `sudo` giới hạn để cài/reload Nginx config.
- Hai domain đã trỏ DNS tới droplet.
- Certbot/TLS certificate đã có tại `/etc/letsencrypt/live/<domain>/`; deploy fail-closed nếu thiếu certificate/key.
- Host ports đã được kiểm tra không xung đột.
- Droplet được PostgreSQL/Keycloak cho phép kết nối.

## Kích hoạt

Push vào `dev` deploy environment `development`; push vào `main` deploy `production`. Có thể chạy `workflow_dispatch` để thử thủ công trên branch đã chọn; branch khác `main` luôn dùng environment development.

Trước lần đầu deploy, review domain/port, SSH known-hosts, DB grants/TLS, Keycloak redirect URI/web origin và backup/migration policy.
