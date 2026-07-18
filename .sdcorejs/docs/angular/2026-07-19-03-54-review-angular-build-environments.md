# Review Angular build environments - 2026-07-19 03:54

## What was requested

Review thay đổi theo chuẩn Angular Core UI và sửa mọi finding bắt buộc.

## What was changed

- EDIT `frontend/src/environments/environment.spec.ts` - bổ sung direct contract tests cho hosted development và production.
- EDIT `test/e2e/playwright.config.ts` - giữ lệnh web server portable qua Corepack sau repro từ standard tests.

## Review findings

| # | Severity | Group | Issue | Gate | Resolution |
|---|---|---|---|---|---|
| 1 | Medium | Testing | Chỉ local environment có direct contract test; hai file CI/deploy dùng chưa được khóa | REQUIRED | Đã thêm test, 3/3 pass |
| 2 | Medium | Test infrastructure | Playwright gọi `pnpm` global nên không start được web server trên Corepack-only machine | REQUIRED | Đã dùng `corepack pnpm`, E2E 2/2 pass |

Không còn finding `BLOCKER` hoặc `REQUIRED`. URL đặt trong `environment*.ts` là đúng config boundary đã được người dùng phê duyệt, không phải hardcoded URL trong service/component.

## Decisions made

- Production tiếp tục dùng public endpoint đã được xác nhận từ cấu hình dự án; không tự suy đoán endpoint UAT/QC.
- Runtime `.env` giữ phạm vi server-only.

## Open questions / follow-ups

- Hosted development và production đang dùng chung endpoint cho tới khi hạ tầng cấp endpoint riêng.

## Next suggested action

- Re-review khi thêm environment mới hoặc đổi public auth contract.

## Skill provenance

Skills invoked: `sdcorejs-review` -> `sdcorejs-repair-loop` -> `sdcorejs-test`.
