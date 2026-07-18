# Áp dụng Angular build environments - 2026-07-19 03:54

## What was requested

Chuyển frontend Angular sang typed environment files giống pattern enterprise-portal, không dùng `.env`/runtime config cho browser.

## What was changed

- CREATE `frontend/src/environments/environment.model.ts` và ba environment files - typed public config cho local/development/production.
- CREATE `frontend/src/app/core/config/app-environment.token.ts` - DI boundary dùng chung.
- EDIT `frontend/src/app/app.config.ts`, API/SSE/auth/Keycloak consumers - đọc environment qua typed token.
- EDIT `frontend/angular.json`, `frontend/package.json` - file replacements và build scripts.
- EDIT Docker/Compose/workflow/deploy assets - chọn Angular configuration lúc build, bỏ runtime public env injection.
- DELETE runtime-config service/model/spec, app-config template và Docker config entrypoint.
- EDIT `ReadMe.md`, `START.md`, `docs/architecture.md`, `docs/deployment.md` - cập nhật vận hành.
- CREATE `.sdcorejs/documentation/technical-docs/setup-angular-environments.md` và user guide - tài liệu kỹ thuật/vận hành.

## Decisions made

- `.env` chỉ dành cho backend, AI, Compose và secrets; Angular không đọc `.env`.
- Local dùng `http://localhost:3001/api` cùng mock auth.
- Hosted development và production dùng public API/Keycloak values đã được xác nhận; đổi config cần rebuild.
- Không tạo UAT/QC khi endpoint và pipeline chưa tồn tại.
- `/app-config.json` trả `404` rõ ràng thay vì rơi vào SPA fallback.
- Test coverage: standard; documentation: user guide + technical docs; review: enabled.

## Open questions / follow-ups

- Cấp endpoint/pipeline riêng trước khi thêm UAT hoặc QC environments.
- Worktree React-to-Angular migration chưa được commit; người dùng quyết định thời điểm lưu/commit.

## Product traceability

- Không tạo product ledger: đây là thay đổi cấu hình/delivery, không thêm business capability hoặc màn hình.

## Next suggested action

- Khi sẵn sàng, review toàn bộ `git diff` rồi commit migration theo workflow Git đã chọn.
- Khi có endpoint mới, thêm environment file, file replacement, contract test và deployment mapping cùng lúc.

## Skill provenance

Skills invoked: `sdcorejs-angular` -> `test-driven-development` -> `sdcorejs-test` -> `sdcorejs-review` -> `sdcorejs-repair-loop` -> `sdcorejs-documentation` -> `sdcorejs-ship`.
