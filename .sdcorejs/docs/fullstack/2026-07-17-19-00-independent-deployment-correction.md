# Điều chỉnh ownership deployment — 2026-07-17 19:00

## User correction

StartFlow chỉ host trên cùng droplet với các ứng dụng khác. Dự án không sử dụng lại hoặc sửa `devops-config`; deployment phải độc lập và thuộc repository StartFlow.

## Thay đổi

- Xóa feature branch StartFlow đã tạo trong `devops-config`; `main` của repository đó không thay đổi.
- Chuyển env validation, remote deploy, Nginx templates và regression tests vào `infra/deploy/`.
- Thay reusable workflow bằng `.github/workflows/deploy.yml` self-contained.
- Dùng release root, Compose project, Docker network, container names, ports, domains và Nginx sites riêng.
- Giữ PostgreSQL 18 và Keycloak là external dependencies; workflow không quản lý vòng đời của chúng.

## Supersedes

Tài liệu này thay thế riêng các quyết định deployment trong spec/plan snapshot ngày 2026-07-17 có nhắc tới `devops-config`. Các phần product, backend, frontend, AI, auth và data contract còn lại không thay đổi.

## Verification cần chạy

- Prettier, lint, typecheck, tests và build của monorepo.
- Compose local/production config.
- Static standalone deployment tests trong Ubuntu CI.
- Search xác nhận runtime workflow không còn tham chiếu `devops-config`.
