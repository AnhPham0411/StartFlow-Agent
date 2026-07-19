---
name: angular-core-ui-frontend-migration
description: Contract đã duyệt để thay toàn bộ frontend Next.js/React bằng Angular 20 và @sdcorejs/angular mà không đổi backend API.
approvedAt: 2026-07-18T22:44:15.0903219+07:00
approvedBy: ghost.of.dark.peter@gmail.com
track: angular
sourceDraftPath: .sdcorejs/docs/angular/2026-07-18-22-32-angular-core-ui-frontend-migration-spec.md
---

# Chuyển frontend StartFlow sang Angular Core UI - Approved Spec

> Snapshot of what the user approved at the `sdcorejs-spec` gate. Do not edit by hand; re-author through `sdcorejs-spec` if the contract changes.

## Approved contract

# Spec - Chuyển frontend StartFlow sang Angular Core UI - 2026-07-18 22:32

## Problem & Goals

Frontend hiện tại dùng Next.js/React, có đầy đủ luồng nghiệp vụ nhưng chưa đạt chất lượng giao diện enterprise mà người dùng mong muốn. Mục tiêu là thay toàn bộ `frontend/` bằng Angular 20, tham chiếu trực tiếp conventions của `C:\Users\Admin\Documents\local-solution\enterprise-portal` và dùng `@sdcorejs/angular` làm hệ thống Core UI.

Kết quả phải giữ nguyên hành vi nghiệp vụ, URL, Keycloak, phân quyền theo role, REST API, SSE, shared contracts và các hành trình demo hiện có. Việc chuyển đổi chỉ thay lớp frontend và cách đóng gói frontend; backend NestJS, AI service, database contract và API payload không thay đổi.

Người dùng chính là analyst, approver và admin trong luồng đánh giá tín dụng. Thành công được đo bằng một portal Angular nhất quán, dễ quét thông tin, thể hiện rõ luồng multi-agent, responsive, có kiểm thử regression và vận hành được bằng Docker/deployment hiện tại.

## Non-goals

- Không thay đổi endpoint, payload, schema hoặc business logic của backend NestJS.
- Không thay đổi AI orchestration, callback, PostgreSQL hoặc Keycloak realm/client phía server.
- Không thêm NgRx, micro-frontend hoặc một design system thứ hai ngoài `@sdcorejs/angular`.
- Không chạy Angular song song lâu dài với React; React/Next.js bị loại bỏ sau khi parity được xác nhận.
- Không thêm màn hình hoặc workflow nghiệp vụ mới ngoài phạm vi frontend hiện tại.
- Không tạo mockup riêng; UI được hiện thực theo Core UI và conventions của `enterprise-portal`.

## Architecture

### Angular application

- Dùng Angular 20 và `@sdcorejs/angular` dòng 20, đồng bộ với `enterprise-portal`.
- Giữ workspace package name `@startflow/frontend`, thư mục `frontend/`, port public `3000` và các route hiện tại.
- Dùng standalone components, `ChangeDetectionStrategy.OnPush`, Angular signals và lazy-loaded feature routes.
- Cấu trúc chính:
  - `core/auth` - khởi tạo Keycloak, token refresh, user/role state và route guards.
  - `core/api` - HTTP client, response normalization, models và error mapping.
  - `core/streaming` - SSE fetch stream, reconnect, `Last-Event-ID`, abort và deduplication.
  - `layout` - `SdLayoutComponent`, menu theo role, profile và logout.
  - `shared` - status mapping, formatters và các presentational component thực sự dùng lại.
  - `features` - dashboard, cases, run, comparisons và knowledge.
- Tái sử dụng `@startflow/contracts` cho schema validation và domain types; không sao chép contract vào frontend.

### Core UI conventions

- App shell dùng `SdLayoutComponent` và `SdTabRouterOutletComponent`.
- Màn hình dùng `SdPageComponent`, `SdSection`, `SdTable`, `SdBadge`, `SdButton`, Core UI form controls, `SdSideDrawer`, `SdConfirmService`, `SdLoadingService` và `SdNotifyService` khi phù hợp.
- `autoId` ổn định được gắn cho thao tác chính và control cần E2E.
- Chỉ viết custom SCSS cho bố cục đặc thù multi-agent, decision rail và một số data visualization; không tái tạo button, form, table, badge hoặc modal mà Core UI đã cung cấp.
- Typography, spacing, responsive utilities, focus state và màu trạng thái tuân theo Core UI. StartFlow chỉ thêm một accent được cấu hình tập trung; không dùng gradient hoặc decorative card dư thừa.
- Nội dung UI dùng tiếng Việt nhất quán; route path, permission code và identifier giữ tiếng Anh.

### Routes and screens

| Route | Angular feature | Core UI composition |
| --- | --- | --- |
| `/dashboard` | Dashboard vận hành | `SdPage`, KPI summary, `SdSection`, recent-run `SdTable`, next-action queue |
| `/cases` | Danh sách hồ sơ | `SdPage`, filter controls, `SdTable`, status badges, open/create actions |
| `/cases/new` | Tạo hồ sơ | Full-page split layout, ba `SdSection`, Core UI form controls, sticky summary |
| `/cases/:caseId` | Chi tiết hồ sơ | `SdPage`, financial/document sections, run-history `SdTable`, start-run action |
| `/runs/:runId` | Run đa tác nhân | Planner strip, ba agent lanes, decision rail, approval panel, timeline/evidence tabs |
| `/comparisons` | So sánh | Case selector, metric table và horizontal comparison visualization |
| `/knowledge` | Tri thức demo | Document `SdTable`, admin-only ingest action trong `SdSideDrawer` |

Route mặc định chuyển tới `/dashboard`; unknown route dùng trang not-found của Angular/Core UI. URL hiện tại không thêm prefix `/layout` để tránh phá link và E2E hiện có.

### Authentication and authorization

- Dùng Keycloak Authorization Code + PKCE qua Core UI Keycloak integration.
- Giữ dev-only mock auth và từ chối mock auth trong production.
- HTTP interceptor lấy access token hiện tại và refresh trước khi gửi request.
- `SD_PERMISSION_CONFIGURATION` trả permission codes từ role trong token, không gọi API `page-permission` mới.
- Role mapping tối thiểu:
  - Mọi user có ít nhất một StartFlow role (`analyst`, `approver`, `admin`): dashboard, case view/create, run view/start và comparison view.
  - `approver`: thêm quyền run approve.
  - `admin`: thêm quyền knowledge view/create.
- `SdPermissionGuard` bảo vệ route; `sdPermission` bảo vệ action. Người thiếu quyền thấy forbidden state rõ ràng, không chỉ thấy button bị disable.

### Data flow and state

- Mỗi feature có injectable facade/store nhỏ dùng signals cho loading, data và error; không dùng global state framework.
- API service giữ nguyên endpoint `/cases`, `/runs`, `/comparisons`, `/knowledge` và approval endpoint hiện tại.
- Normalization hiện có được chuyển thành pure functions có unit test để hỗ trợ cả envelope `{ data }`, collection `{ items }` và dữ liệu thiếu trường tùy chọn.
- Form tạo hồ sơ tiếp tục validate bằng `caseInputSchema` trước khi POST.
- SSE dùng `fetch` để hỗ trợ Authorization header. Service gửi sequence cuối cùng làm `Last-Event-ID`, giữ event đã lưu khi reconnect và bỏ qua event trùng theo `id` hoặc `sequence`.
- Khi nhận terminal event hoặc `approval.required`, run facade reload snapshot từ REST để đồng bộ decision, approval và version.

### Error and interaction states

- Loading toàn trang/section dùng Core UI loading; loading cho action không khóa toàn portal.
- Empty state giải thích bước tiếp theo và có CTA khi phù hợp.
- Lỗi tải dữ liệu hiển thị inline với nút thử lại; mutation success/failure dùng notify.
- SSE reconnect là banner không chặn; timeline đã lưu vẫn đọc được.
- Partial agent failure giữ lane lỗi, hạ confidence và nêu rõ kết quả chưa đầy đủ.
- Approval cần reason tối thiểu, confirmation nêu tên hành động, hỗ trợ cancel/escape và xử lý `409` bằng thông báo reload dữ liệu mới nhất.
- Knowledge route và action ingest chỉ dành cho admin.

### Testing strategy

- TDD RED-first cho auth adapter, role-to-permission mapping, route guards, API normalization, SSE reconnect/dedup và approval conflict handling.
- Component tests được thêm ngay sau từng màn hình cho loading, empty, error, permission và primary action.
- Dùng Jasmine/Karma theo Angular 20 và conventions của `enterprise-portal`.
- Playwright giữ hai critical journeys hiện tại, đổi selector sang `autoId`/accessible role ổn định.
- Verification bắt buộc: Angular lint, typecheck/build, unit tests, root workspace tests, Playwright critical journeys và Docker/Compose config.

### Build, runtime configuration and deployment

- Docker multi-stage build tạo Angular production artifacts rồi phục vụ bằng Nginx non-root trên port `3000`.
- Nginx có SPA fallback và endpoint `/health` trả `200`; Compose/deploy healthcheck chuyển từ `/api/health` sang `/health`.
- Public configuration được đổi khỏi tiền tố `NEXT_PUBLIC_*` sang tên trung lập `STARTFLOW_API_URL`, `STARTFLOW_AUTH_MODE`, `STARTFLOW_KEYCLOAK_URL`, `STARTFLOW_KEYCLOAK_REALM`, `STARTFLOW_KEYCLOAK_CLIENT_ID`.
- Angular tải public runtime config trước khi khởi tạo auth để một image có thể dùng cho nhiều environment mà không chứa server secret.
- GitHub workflow, deploy env validation, Docker Compose, examples và run guide được cập nhật theo tên biến/health endpoint mới.
- Backend, AI service và external PostgreSQL/Keycloak lifecycle không đổi.

## File structure

- `frontend/angular.json`, `frontend/tsconfig*.json`, `frontend/eslint.config.*` - thay cấu hình Next/Vitest bằng Angular 20 build, lint và test.
- `frontend/package.json` - thay React/Next dependencies bằng Angular/Core UI dependencies, giữ workspace identity.
- `frontend/src/main.ts`, `frontend/src/index.html`, `frontend/src/styles.scss` - bootstrap và global styling tối thiểu.
- `frontend/src/app/app.config.ts`, `frontend/src/app/app.routes.ts` - providers, Core UI configuration và lazy routes.
- `frontend/src/app/core/auth/**` - Keycloak, auth state, role-permission adapter và guards.
- `frontend/src/app/core/api/**` - API client, normalization và domain-facing models.
- `frontend/src/app/core/streaming/**` - run event stream và reconnect policy.
- `frontend/src/app/layout/**` - Core UI layout, menu, user info và logout.
- `frontend/src/app/shared/**` - formatters, status presentation và shared view helpers.
- `frontend/src/app/features/dashboard/**` - dashboard screen và tests.
- `frontend/src/app/features/cases/**` - list, intake, detail screens và tests.
- `frontend/src/app/features/runs/**` - run workspace, approval, timeline/evidence views và tests.
- `frontend/src/app/features/comparisons/**` - comparison screen và tests.
- `frontend/src/app/features/knowledge/**` - knowledge list/ingest drawer và tests.
- `frontend/nginx.conf`, `frontend/docker-entrypoint.d/**`, `frontend/Dockerfile` - static runtime, config generation và health endpoint.
- `frontend/app/**`, React-specific `frontend/src/**`, `frontend/next.config.ts`, `frontend/vitest*` - bị loại bỏ sau khi Angular parity được xác nhận.
- `pnpm-lock.yaml`, `docker-compose*.yml`, `.env*.example` - dependency, build/runtime env và healthcheck.
- `.github/workflows/*.yml`, `infra/deploy/**` - frontend image build, env validation và readiness path.
- `test/e2e/**` - selector và assertions tương thích Angular/Core UI.
- `ReadMe.md`, `START.md`, `docs/architecture.md`, `docs/deployment.md` - stack, lệnh chạy và deployment contract mới.

## Acceptance criteria

1. `frontend/` build bằng Angular 20 và không còn dependency runtime/dev của React, React DOM hoặc Next.js.
2. `@sdcorejs/angular` là nguồn cho layout, page, section, table, form, badge, loading, notify và confirmation controls.
3. Các route `/dashboard`, `/cases`, `/cases/new`, `/cases/:caseId`, `/runs/:runId`, `/comparisons`, `/knowledge` hoạt động với URL không đổi.
4. Route mặc định mở `/dashboard`; route không tồn tại hiển thị not-found có đường quay lại portal.
5. Keycloak login dùng Authorization Code + PKCE, refresh token trước request và logout đúng redirect.
6. Mock auth chỉ hoạt động ngoài production; production fail closed nếu auth mode/config không hợp lệ.
7. Menu, route và action tuân theo role `analyst`, `approver`, `admin`; chỉ approver được approval và chỉ admin được ingest knowledge.
8. Dashboard hiển thị đúng tổng hồ sơ, run active, approval pending, run completed và recent-run queue từ API hiện tại.
9. Cases list tìm theo tên/mã đăng ký, hiển thị trạng thái/số tiền/số run và mở đúng chi tiết.
10. Intake form hỗ trợ fixture demo, validate shared schema, hiển thị field error và tạo hồ sơ qua endpoint hiện tại.
11. Case detail hiển thị snapshot tài chính, tài liệu, lịch sử run và bắt đầu run mới không đổi API contract.
12. Run workspace hiển thị Planner, ba agent lane, decision, confidence, conflicts, conditions, timeline, citations và tool events.
13. SSE gửi token, resume từ sequence cuối, reconnect không mất timeline và không thêm event trùng.
14. Partial/failed agent state vẫn hiển thị evidence và thông báo tác động tới confidence.
15. Approval bắt buộc reason và confirmation; lỗi `409` yêu cầu reload snapshot mới nhất thay vì ghi đè.
16. Comparison hiển thị rõ chỉ số single-agent và multi-agent với label/legend không phụ thuộc màu.
17. Knowledge hiển thị document state; admin ingest được demo content qua side drawer và nhận feedback thành công/thất bại.
18. Mọi màn hình có loading, empty và error state phù hợp; action quan trọng có focus/keyboard behavior và target tối thiểu 44px.
19. Giao diện responsive ở desktop, tablet và mobile; run detail chuyển một cột mà không mất decision/approval controls.
20. Core logic được TDD và component tests bao phủ trạng thái/hành động chính; hai Playwright critical journeys tiếp tục pass.
21. Docker image phục vụ Angular qua Nginx trên port `3000`, SPA deep link hoạt động và `/health` trả `200`.
22. Compose, deploy workflow, env validation và tài liệu không còn tham chiếu `NEXT_PUBLIC_*`, `.next` hoặc `/api/health` của frontend.
23. Root lint, typecheck/build, test, E2E critical journeys và Compose config hoàn tất không lỗi.
24. Backend, AI service và shared API contract không có thay đổi hành vi do migration frontend.

## Risks & mitigations

- **Risk:** Core UI permission convention thường tải permission từ API, trong khi StartFlow chỉ có realm roles. -> **Mitigation:** Cung cấp `SD_PERMISSION_CONFIGURATION` adapter thuần từ token và kiểm thử ma trận role-permission.
- **Risk:** SSE có Bearer header không dùng được native `EventSource`. -> **Mitigation:** Giữ fetch-stream pattern, đóng gói trong injectable service và TDD reconnect/dedup/abort.
- **Risk:** Xóa Next.js làm hỏng healthcheck và deep links. -> **Mitigation:** Nginx cung cấp `/health`, `try_files ... /index.html` và có Docker/Compose verification.
- **Risk:** Core UI và Angular dependency không tương thích với pnpm workspace/shared contracts. -> **Mitigation:** Đồng bộ Angular/Core UI major 20 như `enterprise-portal`, build contracts trước frontend và kiểm tra lockfile frozen.
- **Risk:** Full rewrite gây thiếu parity ở trạng thái hiếm. -> **Mitigation:** Dùng acceptance matrix cho 7 route, chuyển pure normalization tests trước và giữ Playwright critical journeys.
- **Risk:** Custom run visualization phá tính nhất quán Core UI. -> **Mitigation:** Chỉ custom layout/connector cần cho multi-agent; mọi control và interaction dùng Core UI.
- **Risk:** Runtime config public bị nhầm là secret. -> **Mitigation:** Chỉ đưa API URL và Keycloak public client settings vào config; server secrets không đi vào frontend image/config.

## Out of scope (deferred)

- Thay đổi backend permission API - chỉ xem xét nếu sau này StartFlow cần permission granularity vượt quá realm roles.
- NgRx hoặc enterprise global state - chỉ xem xét khi có nhiều feature đồng thời chỉnh cùng một aggregate phức tạp.
- Micro-frontend - chỉ xem xét khi portal được tách thành nhiều team/release độc lập.
- Brand asset/logo chính thức - bổ sung khi người dùng cung cấp bộ nhận diện được phê duyệt.
- Mở rộng nghiệp vụ beyond current demo - thực hiện bằng spec riêng sau khi Angular migration đạt parity.

## Decisions captured during review

- Approved as drafted after three incremental design confirmations and one final written-spec approval.

## Skill provenance

sdcorejs-spec (approved on attempt 1 / 3)
