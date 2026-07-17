# Deployment lên shared droplet

## Phạm vi

StartFlow dùng cùng droplet application do `devops-config` quản lý nhưng có Compose project, container name, port và release directory riêng. Workflow không sửa các file `enterprise-platform` và không quản lý PostgreSQL/Keycloak.

## GitHub configuration

Tạo GitHub Environments tương ứng `development` và `production`, rồi cấu hình secrets ở repository/organization:

| Secret                                    | Nội dung                                                                                          |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `DEVOPS_CONFIG_TOKEN`                     | token đọc private `devops-config` nếu `github.token` không đủ quyền                               |
| `STARTFLOW_ENV_DEV`, `STARTFLOW_ENV_MAIN` | toàn bộ runtime `KEY=value`, dựa trên env examples trong `devops-config/projects/startflow-agent` |
| `DROPLET_HOST_DEV/MAIN`                   | host application droplet                                                                          |
| `DROPLET_USER_DEV/MAIN`                   | SSH deploy user                                                                                   |
| `SSH_PRIVATE_KEY_DEV/MAIN`                | private key deploy                                                                                |
| `DROPLET_SSH_KNOWN_HOSTS_DEV/MAIN`        | verified host key line, lấy qua kênh tin cậy                                                      |
| `POSTGRES_TLS_CA_BASE64_DEV/MAIN`         | CA certificate base64 khi dùng `verify-ca`/`verify-full`                                          |

`STARTFLOW_ENV_*` cần `APP_DOMAIN`, `API_DOMAIN`, hai port không xung đột, `STARTFLOW_NETWORK`, database URLs, Keycloak config, LLM config và internal token. Không dùng placeholder trong runtime secret.

## Pipeline

1. CI chạy lint/typecheck/unit/Python/Playwright/Compose build.
2. Push `dev` hoặc `main` gọi `.github/workflows/deploy.yml`.
3. Reusable workflow validate env, build ba image theo 12 ký tự đầu commit SHA và chuyển bundle qua strict SSH.
4. Remote script tải image, preflight Keycloak discovery và giữ env mode 600.
5. Chạy `backend-migrate`, sau đó `ai-migrate` và idempotent knowledge seed.
6. Start ba service và chờ backend `/ready`, frontend `/api/health`.
7. Render Nginx config cho hai domain, chạy `nginx -t`, reload và publish symlink release.
8. Nếu application không ready, Compose quay về release trước. Database migration không tự downgrade.

TLS certificate/certbot phải được provision theo policy hiện hữu của droplet trước hoặc bởi operator. Deploy fail-closed nếu thiếu `fullchain.pem`/`privkey.pem`, rồi cài HTTP→HTTPS redirect và TLS upstream config.

## Không chạy deploy từ local scaffold

Repository hiện chỉ chuẩn bị workflow. Codex không commit, push hoặc kích hoạt deployment. Trước lần chạy đầu cần review domain/port, verified known-hosts, DB grants/TLS, Keycloak redirect URI/web origin và backup/migration policy.
