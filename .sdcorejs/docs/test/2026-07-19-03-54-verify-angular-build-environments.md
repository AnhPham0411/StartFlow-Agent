# Xác minh Angular build environments - 2026-07-19 03:54

## What was requested

Chạy standard test suite sau khi chuyển frontend khỏi runtime `.env`/`app-config.json` sang Angular build environments.

## What was changed

- EDIT `test/e2e/playwright.config.ts` - gọi pnpm qua Corepack để web server chạy được trên máy không cài pnpm global.
- EDIT `frontend/src/environments/environment.spec.ts` - khóa contract của local, development và production.

## Decisions made

- Test coverage level: standard theo lựa chọn của người dùng.
- Dùng framework có sẵn: Karma/Jasmine cho Angular và Playwright cho E2E.
- Không thêm test framework hoặc dependency mới.

## Verification

- Angular: 107/107 pass.
- Backend: 10 suites, 19/19 pass.
- Contracts: 3/3 pass; static contracts: 2/2 pass.
- Playwright: 2/2 pass.
- Lint và typecheck: exit 0.
- Local/development/production builds và bundle scans: pass.
- Compose local/production, 3 deployment shell suites và Docker/Nginx smoke: pass.

## Open questions / follow-ups

- Không có test blocker còn mở.

## Next suggested action

- Không cần thêm test cho tới khi có environment hoặc endpoint mới.

## Skill provenance

Skills invoked: `sdcorejs-test` -> `systematic-debugging` -> `verification-before-completion`.
