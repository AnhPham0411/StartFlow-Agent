---
name: nba-customer-identity-platform
description: Approved fullstack contract for NBA M1-M13, Customer 360, branch/account management, three-level RBAC and demo operations.
approvedAt: "2026-07-19T08:53:45+07:00"
approvedBy: ghost.of.dark.peter@gmail.com
track: fullstack
sourceDraftPath: .sdcorejs/docs/fullstack/2026-07-19-08-53-nba-customer-identity-platform-spec.md
---

# NBA Customer & Identity Platform - Approved Spec

> Snapshot of what the user approved at the `sdcorejs-spec` gate. Do not edit by hand; re-author through `sdcorejs-spec` if the contract changes.

## Approved contract

## Problem & Goals

StartFlow đã có dữ liệu seed NBA, API tư vấn cơ bản và Angular Core UI nhưng chưa có runtime M1-M13, chưa có menu Khách hàng độc lập và chưa có mô hình quản trị tài khoản/chi nhánh thống nhất. Mục tiêu là hoàn thiện một Portal có thể vận hành thật và trình diễn thuyết phục: quản lý người dùng theo chi nhánh, tra cứu Customer 360, chạy pipeline NBA có audit, theo dõi compliance/model và mô phỏng mini-pipeline.

Thành công được đo bằng bốn kết quả: dữ liệu được giới hạn đúng theo ba cấp quyền; toàn bộ 500 khách hàng seed có thể tra cứu; nightly/mini pipeline sinh recommendation append-only có truy vết; demo journey chạy ổn định từ Customer 360 đến recommendation version mới.

## Non-goals

- Không triển khai Voice Extraction Agent trong phạm vi MVP.
- Không cho Portal sửa dữ liệu core-banking gốc của khách hàng.
- Không gửi tên khách hàng, số tài khoản hoặc nội dung chuyển khoản thô tới external LLM.
- Không xóa cứng tài khoản, chi nhánh, recommendation hoặc audit history.
- Không commit mật khẩu demo, Keycloak client secret, API key hoặc database credential.

## Architecture

- Angular 20 và `@sdcorejs/angular` cung cấp UI, lazy routes, Core UI controls, signals và permission-aware navigation.
- NestJS là secured control plane: Keycloak authentication, RBAC/branch scope, Customer APIs, scheduler, staleness, admin APIs, audit và AI-service client.
- FastAPI/Python sở hữu deterministic orchestrator và M1-M8, M10-M13; NumPy/scikit-learn thực hiện scoring/retrain; LLM được bọc sau adapter demo/live.
- PostgreSQL là nguồn dữ liệu nghiệp vụ, audit thread, stage state, model registry và append-only recommendation store.
- Keycloak là identity provider. PostgreSQL giữ local operational profile, effective application role, `branch_id`, trạng thái và `keycloak_user_id`.
- Shared Zod/JSON Schema là contract chuẩn phía TypeScript; Pydantic models có parity tests với JSON Schema.

## Roles & Data Scope

- `ADMIN`: quyền toàn hệ thống, `branch_id` bắt buộc NULL, quản lý chi nhánh/tài khoản và mọi chức năng Portal.
- `MANAGER`: bắt buộc thuộc đúng một chi nhánh; xem toàn bộ khách hàng, nhân viên, call-list và hiệu quả trong chi nhánh; không tự cấp quyền tài khoản.
- `EMPLOYEE`: bắt buộc thuộc đúng một chi nhánh; chỉ xem khách hàng/call-list được assign cho chính mình; được ghi note và feedback.
- Một tài khoản có đúng một effective role. Username và branch code là immutable identifiers.
- Legacy aliases chỉ tồn tại trong rollout: `sale/analyst -> employee`, `approver -> manager`; UI và contract công khai chỉ hiển thị ba role mới.
- Account/branch được deactivate thay vì hard delete. Không deactivate branch khi còn active account và không disable admin cuối cùng hoặc chính admin đang thao tác.

## Identity & Branch Data

`branches` lưu code, name, active, timestamps. `users` tiếp tục giữ stable BIGINT id để bảo toàn call-list/feedback/note history, đồng thời có `keycloak_user_id`, `branch_id`, effective role, active và timestamps.

Seed khởi tạo mười chi nhánh: `HN-HK`, `HP`, `HCM-BT`, `HN-DD`, `CT`, `HUE`, `DN`, `NT`, `BH`, `HCM-Q1`. Ba mươi user hiện hữu giữ nguyên id/username: `user017` và `user028` thành global admin; `user006`, `user007`, `user020`, `user023`, `user029` giữ manager; 23 user còn lại map từ sale sang employee và giữ chi nhánh.

Identity seed upsert user Keycloak theo username, gán đúng một application role, lưu Keycloak subject vào PostgreSQL và đặt `UPDATE_PASSWORD`. Initial password chỉ lấy từ runtime secret ở demo/dev; production seed cần explicit enable flag.

## NBA Processing Contract

- Nightly run tạo một `batch_runs` audit thread, chạy M1/AG1/M2 song song rồi M3-M8 theo thứ tự. Stage lỗi được retry một lần; thất bại sau retry dừng run và không ghi recommendation nửa vời.
- M1 deterministic, giữ NULL, bit-identical. AG1 là thành phần duy nhất đọc raw transaction PII và chỉ dùng local LLM. M2 không suy diễn geo dưới confidence threshold.
- M3 ghi versioned profile snapshot. M4 dùng production weights kèm train mean/std; M5 áp dụng R1-R12 theo thứ tự; M6 chỉ chuyển call-list customer sang scripting.
- AG2-AG6 dùng sanitized contract; mọi con số đến từ catalog/calculator; M7 regex/slot/template validation và deterministic fallback; M8 append recommendation bằng transaction, snapshot hash và concurrency-safe version.
- M9 trả staleness dưới 300 ms. M10 mini-run chỉ một customer và không ghi đè version cũ.
- M11 tạo outcome từ product opened trong cửa sổ, không dùng checkbox làm label. M12 chỉ promote model khi bốn gates pass và tốt hơn production. M13 mask dữ liệu trước embedding và lưu cả won/lost cases.

## Portal Navigation & Screens

- Tổng quan: KPI, batch state, conversion, product distribution.
- Khách hàng: paginated/searchable customer list và Customer 360.
- Danh sách gọi: call-list T+1, Top 2, hook, note, feedback.
- Hiệu quả tư vấn: branch/sale/product metrics cho manager/admin.
- Vận hành AI: batch list/detail, stage lane, retry/cost/statistics.
- Compliance & Tag QA: validator rejects, tag review và precision.
- Mô hình & Học lại: versions, four-gate reports và retrain action.
- Cấu hình nghiệp vụ: call-list assignments, KPI, catalog, geo và effective parameters.
- RAG Cases và Audit: retrieval cases, recommendation versions, rules, weights và snapshot hash.
- Quản trị hệ thống: Chi nhánh và Tài khoản cho admin; manager có team view read-only theo chi nhánh.

Customer 360 gồm overview, current financial position, 3/6-month windows, held products, tags/geo, recommendation versions, staleness, relationship timeline, notes, feedback và audit. Raw transaction narrative không xuất hiện trên standard sale UI.

## API Surface

- `/api/auth/me` trả effective role, branch và permissions.
- `/api/admin/branches` hỗ trợ list/create/update/deactivate.
- `/api/admin/accounts` hỗ trợ list/create/update/enable/disable/reset-password.
- `/api/nba/customers` và child resources hỗ trợ scoped pagination/filter/detail/timeline.
- `/api/nba/batches` hỗ trợ nightly trigger, status, stage events và history.
- `/api/nba/customers/:id/simulations/big-transaction` kích hoạt demo mini-pipeline có audit.
- `/api/nba/operations/*` và `/api/nba/admin/*` cung cấp compliance, tags, models, RAG, catalog, KPI, geo, config và audit.
- Internal AI endpoints dùng service token, không public trực tiếp ra browser.

## File Structure

- `backend/prisma/migrations/` - additive schema cho identity, branch và NBA runtime.
- `backend/prisma/profile-seed.ts` - deterministic branch/user transformation và existing NBA bundle.
- `backend/scripts/seed-keycloak-identities.ts` - idempotent Keycloak provisioning.
- `backend/src/modules/identity/` - branch/account APIs và Keycloak admin adapter.
- `backend/src/modules/nba/` - customer, pipeline, operations và admin control plane.
- `ai-service/src/nba/` - orchestrator, stages, tools, prompts và repositories.
- `packages/contracts/src/nba.schemas.ts` - shared public/internal contracts.
- `frontend/src/app/features/customers/` - customer list và Customer 360.
- `frontend/src/app/features/administration/` - branch/account management.
- `frontend/src/app/features/nba/operations/` và `frontend/src/app/features/nba/admin/` - operations center.
- `test/e2e/specs/` - role scope và demo critical journeys.

## Acceptance Criteria

1. Public application roles chỉ gồm ADMIN, MANAGER và EMPLOYEE.
2. Database từ chối manager/employee thiếu branch và admin có branch.
3. Mỗi account có tối đa một branch; 10 branch và 30 account seed idempotently.
4. Keycloak seed không commit/log password và đồng bộ `keycloak_user_id` về database.
5. Employee không xem được customer/call-list của employee khác.
6. Manager chỉ xem dữ liệu trong branch của mình; admin xem toàn hệ thống.
7. Admin quản lý branch/account, còn manager chỉ xem team trong branch.
8. Disabled account bị từ chối ở backend dù token Keycloak chưa hết hạn.
9. Admin cuối cùng và branch còn active account không thể bị deactivate.
10. Admin phân trang và tra cứu được toàn bộ 500 customer seed; customer chưa có recommendation vẫn mở được Customer 360.
11. Nightly/mini run có batch/stage audit, retry đúng một lần và không tạo partial recommendation.
12. M1 giữ NULL và chạy lặp lại bit-identical; M4 đạt 1.000 khách x 5 sản phẩm dưới một giây.
13. M5 trả Top 2/Top 1/empty đúng rule order và ghi đầy đủ `rules_applied`.
14. External scripting payload không chứa raw PII; mọi numeric token truy về tool slot.
15. M7 ghi mọi reject và dùng deterministic fallback sau tối đa hai lần regenerate.
16. Recommendation append-only, snapshot hash hợp lệ và version an toàn khi chạy đồng thời.
17. Staleness response dưới 300 ms; mini-run tạo version mới và giữ version cũ.
18. Retrain không promote nếu bất kỳ gate nào fail; RAG lưu cả won/lost sau masking.
19. Angular menus/actions phản ánh đúng role; direct-route access vẫn bị guard/API chặn.
20. Demo journey Customer 360 -> big transaction -> live stages -> version diff -> explain/audit -> feedback chạy không có console/API error.

## Risks & Mitigations

- **Thiếu E1-E10, R1-R12 và compliance C5:** khóa decision ledger từ tài liệu nguồn trước khi viết domain logic.
- **Distributed consistency Keycloak/PostgreSQL:** dùng compensation, idempotency và reconciliation status; auth fail closed khi local profile inactive/mismatch.
- **Legacy role downtime:** rollout aliases trước, seed/migrate identities, refresh tokens rồi mới loại aliases.
- **Production thiếu pgvector:** kiểm tra extension trước migration; chỉ dùng Qdrant nếu có decision phê duyệt độ lệch spec.
- **PII leakage:** typed sanitized contracts, structured log redaction và negative tests cho prompts/events/audit.
- **Concurrent pipeline writes:** advisory transaction lock, unique constraints và idempotency keys.

## Out of Scope (Deferred)

- Voice/STT feedback ingestion - Phase 3 sau khi MVP được nghiệm thu.
- Multi-branch assignment cho một account - chỉ xem xét khi business thay đổi quy tắc một chi nhánh.
- Customer master-data editing - chờ integration với core-banking source of truth.
- Production auto-creation of demo users - chỉ bật bằng explicit deployment flag.

## Decisions captured during review

- Added a dedicated Customer menu and Customer 360 instead of leaving customer detail hidden below NBA call-list navigation.
- Expanded the portal into an NBA Operations Center suitable for an end-to-end demo.
- Replaced legacy application roles with a three-level hierarchy while keeping temporary rollout aliases.
- Added branch/account management and deterministic PostgreSQL-Keycloak seed behavior.
- Chose global ADMIN without a branch; MANAGER and EMPLOYEE require one branch.

## Skill provenance

sdcorejs-spec (approved through the combined plan approval on attempt 1 / 3)
