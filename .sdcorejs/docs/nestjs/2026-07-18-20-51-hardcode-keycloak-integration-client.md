# Hardcode Keycloak Integration Client — 2026-07-18 20:51

## Yêu cầu

Hardcode client backend `INTEGRATION_API`, chỉ giữ client secret trong env, đồng thời bảo đảm tài khoản quản trị xem được toàn bộ dữ liệu mà không cần liên kết `users.username`.

## Thay đổi

- EDIT `backend/src/modules/auth/jwt-auth.guard.ts` — introspection và JWT audience luôn dùng `INTEGRATION_API`; secret vẫn lấy từ `KEYCLOAK_SECRET`.
- EDIT `backend/src/config/env.validation.ts` — bỏ yêu cầu runtime cho client ID/audience, tiếp tục bắt buộc secret.
- EDIT `backend/test/jwt-auth.guard.spec.ts` và `backend/test/env-validation.spec.ts` — regression cho contract hardcode và secret bắt buộc.
- EDIT `backend/test/nba.service.spec.ts` — chứng minh admin không có profile DB vẫn đọc toàn bộ NBA.
- EDIT `frontend/src/auth/roles.ts` — ánh xạ `realm-management.realm-admin` thành application `admin`.
- EDIT `infra/deploy/` và các env example — contract deploy chỉ yêu cầu `KEYCLOAK_SECRET` cho confidential client.
- EDIT `infra/keycloak/` — tài liệu/example phân biệt `portal-ops` và `INTEGRATION_API`.

## Quyết định

- `portal-ops` vẫn là public frontend client dùng Authorization Code + PKCE.
- `INTEGRATION_API` là confidential backend client và audience cố định trong source.
- Không cấp admin dựa trên username; quyền đến từ realm role `admin` hoặc `realm-management.realm-admin`.
- Mức kiểm thử: standard. Không tạo user guide hoặc technical doc mới; bỏ qua review theo lựa chọn của người dùng.

## Câu hỏi mở / theo dõi

- Live user token phải có audience `INTEGRATION_API` và GitHub `STARTFLOW_DEV` phải chứa `KEYCLOAK_SECRET`; chưa kiểm chứng bằng token người dùng thật trong phiên này.

## Hành động tiếp theo

- Chạy verification toàn workspace, commit/push `dev`, theo dõi deploy và kiểm tra luồng đăng nhập thật.

## Product traceability

- Không tạo ledger mới: đây là auth bugfix/configuration change, không thay đổi business feature.

## Skill provenance

Skills: `sdcorejs-debug` → `sdcorejs-nestjs` → `sdcorejs-test` → `sdcorejs-documentation` → `sdcorejs-ship`.
