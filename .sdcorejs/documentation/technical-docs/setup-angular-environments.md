# Thiết lập Angular build environments

## Mục đích

Frontend StartFlow dùng typed Angular environments tại thời điểm build. Public API URL, auth mode và thông tin Keycloak public được đóng vào browser bundle; `.env` chỉ còn dành cho backend, AI service, Docker Compose và deployment secrets.

## Điểm vào và nguồn cấu hình

| Thành phần | Vai trò |
|---|---|
| `frontend/src/environments/environment.model.ts` | Contract `AppEnvironment` dùng chung |
| `frontend/src/environments/environment.ts` | Local API và mock auth |
| `frontend/src/environments/environment.development.ts` | Hosted development và Keycloak |
| `frontend/src/environments/environment.production.ts` | Production build và Keycloak |
| `frontend/angular.json` | Chọn file bằng `fileReplacements` |
| `frontend/src/app/core/config/app-environment.token.ts` | DI token cho application services |
| `frontend/src/app/app.config.ts` | Chọn mock auth hoặc Core Keycloak providers |
| `frontend/Dockerfile` | Build đúng Angular configuration |

## Ánh xạ môi trường

| Configuration | File được dùng | Lệnh build | Auth |
|---|---|---|---|
| `local` | `environment.ts` | `build:local` | `mock` |
| `development` | `environment.development.ts` | `build:development` | `keycloak` |
| `production` | `environment.production.ts` | `build:production` | `keycloak` |

Hosted development và production hiện dùng các public endpoint đã được xác nhận trong cấu hình dự án. Hai môi trường đang dùng chung API endpoint và Keycloak origin; chỉ tách thêm file khi có endpoint riêng đã được cấp và kiểm chứng.

## Luồng dữ liệu

1. Angular CLI thay `environment.ts` theo build configuration.
2. `createAppConfig()` đăng ký object đã chọn qua `APP_ENVIRONMENT`.
3. `StartFlowApiService` và `RunEventStreamService` lấy `apiUrl` từ token.
4. `KeycloakConfiguration` và auth adapter lấy Keycloak origin, realm và public client ID từ cùng token.
5. Angular sinh static bundle; Nginx phục vụ bundle mà không tạo config lúc container start.

`/app-config.json` là đường dẫn đã ngừng sử dụng và Nginx trả `404` rõ ràng để không bị SPA fallback trả nhầm `index.html`.

## Contract và giới hạn bảo mật

`AppEnvironment` chứa:

| Field | Ý nghĩa |
|---|---|
| `production` | Đánh dấu production build |
| `apiUrl` | REST/SSE API base URL có thể thấy trong browser |
| `authMode` | `mock` hoặc `keycloak` |
| `keycloakUrl` | Public Keycloak origin |
| `keycloakRealm` | Realm public |
| `keycloakClientId` | Public SPA client ID |

Không đặt client secret, access token, database URL, LLM key, `INTERNAL_SERVICE_TOKEN`, certificate hoặc private key vào bất kỳ file `environment*.ts` nào. Thay đổi public frontend config luôn yêu cầu build lại image.

## Lệnh sử dụng

```powershell
corepack pnpm --filter @startflow/frontend dev
corepack pnpm --filter @startflow/frontend build:local
corepack pnpm --filter @startflow/frontend build:development
corepack pnpm --filter @startflow/frontend build:production
```

Docker build nhận đúng một trong ba giá trị:

```powershell
docker build --file frontend/Dockerfile --build-arg STARTFLOW_BUILD_CONFIGURATION=production --tag startflow-frontend:local .
```

Compose local mặc định dùng `local`; production overlay dùng `production`. GitHub deploy build branch `dev` bằng `development` và branch `main` bằng `production`.

## Xác minh

```powershell
corepack pnpm --filter @startflow/frontend lint
corepack pnpm --filter @startflow/frontend typecheck
corepack pnpm --filter @startflow/frontend exec ng test --watch=false --browsers=ChromeHeadless --include='**/environment.spec.ts'
corepack pnpm --filter @startflow/frontend build:production
docker compose --env-file .env.example config --quiet
```

Sau Docker build, kiểm tra `/health` trả `200`, deep link trả Angular shell và `/app-config.json` trả `404`.

## Lỗi thường gặp

| Hiện tượng | Nguyên nhân thường gặp | Cách xử lý |
|---|---|---|
| Browser gọi sai API | Sửa nhầm environment hoặc chưa rebuild | Sửa đúng file, build lại image và recreate container |
| Local bị chuyển sang Keycloak | Chạy nhầm `development`/`production` | Dùng `dev` hoặc `build:local` |
| Keycloak khởi tạo lỗi | Realm/client/origin không khớp | Kiểm tra file environment tương ứng và cấu hình public client |
| Sửa `.env` nhưng frontend không đổi | Angular không đọc `.env` | Sửa `environment*.ts` rồi rebuild |
| `/app-config.json` trả `404` | Hành vi chủ đích sau migration | Không khôi phục runtime config; dùng build environment |

## Phụ thuộc

- Angular CLI `fileReplacements`.
- `APP_ENVIRONMENT` cho typed dependency injection.
- `@sdcorejs/angular/modules/keycloak` cho Keycloak provider, service và interceptor.
- Nginx non-root để phục vụ static SPA.
