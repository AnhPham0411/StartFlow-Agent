---
name: tuan-anh-profile-seed-integration
description: Tích hợp Sales Copilot/NBA đã làm sạch với Keycloak, PostgreSQL và seed profile idempotent.
contract_id: startflow-tuan-anh-integration-v1
requirement_id: startflow-tuan-anh-integration
approvedAt: "2026-07-18T18:26:33+07:00"
approvedBy: nghiatt15@onemount.com
approval_source: explicit-user-choice
track: fullstack
target_root_kind: target-project
stack_profile: plain-nextjs + plain-nestjs + general
profile_confidence: high
sourceDraftPath: .sdcorejs/docs/fullstack/2026-07-18-18-20-tuan-anh-profile-seed-integration-spec.md
approved_spec_hash: ae52351a0845803662434d455aa4d232a86cddaa41f7b19e769755e74f2cfb09
acceptance_criteria_count: 14
manual_criteria_count: 1
redaction_applied: true
supersedes: null
change_control:
  revision: 1
  supersedes: null
  change_reason: null
---

# Tích hợp Sales Copilot và seed profile từ Supabase cũ - Approved Spec

> Snapshot of what the user approved at the `sdcorejs-spec` gate. Do not edit by hand; re-author through `sdcorejs-spec` if the contract changes.

## Approved contract

# Spec - Tích hợp Sales Copilot và seed profile từ Supabase cũ - 2026-07-18 18:20

```yaml
spec_context:
  source: sdcorejs-spec
  contract_id: startflow-tuan-anh-integration-v1
  requirement_id: startflow-tuan-anh-integration
  approved_spec_path: .sdcorejs/specs/fullstack/2026-07-18-18-26-tuan-anh-profile-seed-integration.md
  approved_spec_hash: ae52351a0845803662434d455aa4d232a86cddaa41f7b19e769755e74f2cfb09
  supersedes: null
  target_root: C:/Users/nghiatt15_onemount/Documents/StartFlow-Agent
  target_root_kind: target-project
  track: fullstack
  stack_profile: plain-nextjs + plain-nestjs + general
  profile_confidence: high
  source_requirement_context: startflow-tuan-anh-integration-v1
  acceptance_criteria_count: 14
  manual_criteria_count: 1
  non_goals:
    - Dùng Supabase làm auth, database runtime hoặc dependency sau khi deploy
    - Import Git history có chứa credential từ branch tuan-anh
    - Provision hoặc thay đổi vòng đời Keycloak, PostgreSQL hay Qdrant có sẵn
    - Ghi đè hoặc xóa dữ liệu nghiệp vụ đã thay đổi trên môi trường dev
  risks:
    - Credential Supabase cũ đã xuất hiện trong chat và Git history
    - Dữ liệu nguồn có thể không phù hợp schema đích hoặc chứa trường nhạy cảm
    - Seed tự động có thể làm deploy thất bại nếu migration và seed không cùng contract
    - Squash integration lớn có thể gây regression cho luồng multi-agent hiện tại
  assumptions:
    - Dữ liệu Supabase là dữ liệu demo hackathon, không phải PII sản xuất
    - URL Supabase cũ chỉ được dùng một lần trong máy local để tạo snapshot seed
    - PostgreSQL đích lấy từ các biến DB_* hiện có và Keycloak lấy từ các biến KEYCLOAK_* hiện có
    - Qdrant tiếp tục làm vector store; không thêm lại pgvector
  redaction_applied: true
  approval:
    approved: true
    approved_at: 2026-07-18T18:26:33+07:00
    approval_source: explicit-user-choice
  change_control:
    revision: 1
    supersedes: null
    change_reason: null
```

## Problem & Goals

Branch `tuan-anh` có bộ tính năng Sales Copilot/NBA và dữ liệu profile đang gắn với PostgreSQL trên Supabase. Môi trường `dev` hiện tại phải tiếp tục dùng Keycloak để xác thực, PostgreSQL hiện tại để lưu trữ và Qdrant cho vector search. Mục tiêu là tích hợp phần code an toàn của `tuan-anh` bằng squash đã làm sạch, chuyển bộ dữ liệu profile cần thiết thành seed script idempotent và tự động chạy seed sau migration trong deploy `dev`.

Kết quả thành công phải cho phép giao diện Sales Copilot/NBA hoạt động với dữ liệu đích, trong khi luồng Keycloak và hệ thống multi-agent hiện tại không bị suy giảm.

## Non-goals

- Không merge commit/history trực tiếp từ `tuan-anh`; chỉ tích hợp snapshot code đã kiểm tra.
- Không đưa URL, password, token, secret hoặc credential Supabase vào source, artifact, log hay seed.
- Không dùng Supabase Auth, Supabase SDK hay Supabase database sau khi snapshot seed đã được tạo.
- Không import password, refresh token, session, vai trò auth hoặc bản ghi xác thực; Keycloak luôn là nguồn xác thực và phân quyền.
- Không sửa repository `devops-config` và không provision dịch vụ hạ tầng mới.
- Không thêm pgvector; RAG/vector search tiếp tục dùng Qdrant.

## Architecture

- Tích hợp bằng sanitized squash trên nền `dev`; loại `ai.log`, credential hardcode, hướng dẫn Supabase runtime và duplicate AI app không phù hợp với `ai-service` hiện tại.
- NestJS tiếp nhận module Sales Copilot/NBA, nhưng guard và role authorization phải dựa trên JWT Keycloak. Bảng user/profile trong ứng dụng chỉ lưu metadata nghiệp vụ; không thay thế identity provider.
- Prisma migration tạo nhóm bảng tối thiểu để profile, customer, recommendations/call-list, assessment và call notes hoạt động. Migration không dùng extension `vector`.
- Một seed script TypeScript tự chứa snapshot dữ liệu demo đã xuất. Script upsert theo khóa ổn định trong transaction, không xóa dữ liệu và có manifest/version để chạy lại an toàn.
- Quá trình trích xuất một lần đọc credential cũ từ Git object của `origin/tuan-anh` trong bộ nhớ tiến trình local, không in giá trị ra terminal và không ghi credential vào file.
- Workflow deploy chạy theo thứ tự: validate env -> Prisma migration -> profile seed -> rollout/health verification. Seed lỗi thì deploy dừng trước rollout.
- PostgreSQL đích được tạo DSN trong runtime từ `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` và các biến SSL hiện có.

## Stack profile and technology assumptions

- Track: `fullstack`
- Stack profile: `plain-nextjs + plain-nestjs + general`
- Profile evidence: Next.js 16 App Router trong `frontend`; NestJS 11/Prisma 6 trong `backend`; FastAPI/Python trong `ai-service`; pnpm workspace; deploy độc lập trong `.github/workflows` và `infra/deploy`.
- Technology assumptions: giữ nguyên pnpm, Prisma migration, Keycloak Authorization Code + PKCE/JWKS, Docker Compose, GitHub Actions và Qdrant hiện tại.

## File structure

- `backend/prisma/schema.prisma` - mở rộng schema cho Sales Copilot/NBA và profile bundle.
- `backend/prisma/migrations/<timestamp>_sales_copilot_profile_bundle/migration.sql` - migration forward-only, không pgvector.
- `backend/prisma/profile-seed.ts` - seed snapshot idempotent, transaction, version/count output.
- `backend/package.json` - lệnh seed profile dùng trong test và deploy.
- `backend/src/modules/nba/**` - tích hợp API/assessment/policy từ branch nguồn và giữ Keycloak authorization.
- `backend/src/modules/auth/**` - chỉ điều chỉnh nếu cần để map Keycloak identity sang application profile; không Supabase/mock production auth.
- `frontend/app/nba/**`, `frontend/src/features/nba/**` - tích hợp các màn hình Sales Copilot/NBA.
- `frontend/src/auth/**`, `frontend/src/lib/api-client.ts` - giữ Keycloak session/token làm chuẩn khi gọi API.
- `ai-service/**` - chỉ nhận các thay đổi tương thích với AI service hiện tại; không thêm `apps/ai` duplicate hay Supabase runtime.
- `infra/deploy/deploy.sh` và các contract tests liên quan - chạy seed sau migration và fail closed.
- `.env.example`, `.env.production.example` - ghi contract cấu hình đích; không thêm source DB credential.
- `backend/test/**`, `frontend/tests/**`, `infra/deploy/tests/**` - regression cho auth, mapping, seed idempotency, UI và deploy order.

## Acceptance criteria

- AC-001 - `dev` nhận code chức năng Sales Copilot/NBA qua sanitized squash; không nhập commit history của `tuan-anh`.
- AC-002 - Cây source sau tích hợp không chứa URL/password Supabase, `ai.log`, Supabase Auth/SDK hoặc cấu hình Supabase runtime.
- AC-003 - `AUTH_MODE=keycloak` và JWT Keycloak tiếp tục là cơ chế xác thực/phân quyền của backend và frontend; profile DB không thể cấp vai trò auth.
- AC-004 - Migration tạo đủ schema quan hệ cần cho profile, customer và các luồng Sales Copilot/NBA được tích hợp, không yêu cầu pgvector.
- AC-005 - Snapshot seed chỉ chứa dữ liệu demo nghiệp vụ; không chứa credential, auth session, token, password hay dữ liệu hệ thống Supabase.
- AC-006 - Seed script upsert theo khóa ổn định trong transaction, không delete/truncate và chạy hai lần cho cùng count/kết quả logic.
- AC-007 - Seed ghi/kiểm tra version hoặc checksum manifest và in summary chỉ gồm tên bảng, số bản ghi, trạng thái; log không có secret hay raw payload nhạy cảm.
- AC-008 - Deploy `dev` tự chạy seed ngay sau Prisma migration, trước rollout; seed thất bại làm job thất bại và không thay container đang healthy.
- AC-009 - Sau deploy, source URL Supabase không cần có trong `.env`, GitHub secrets, droplet hay runtime containers.
- AC-010 - Qdrant hiện tại tiếp tục là vector store; migration và code mới không thêm dependency pgvector.
- AC-011 - API Sales Copilot/NBA trả dữ liệu seed từ PostgreSQL đích và tuân thủ role Keycloak.
- AC-012 - Frontend Sales Copilot/NBA render được luồng customer/profile/call-list/assessment bằng API đích mà không làm hỏng silent SSO Keycloak.
- AC-013 - Node/Python quality gates, unit/integration tests, production builds, Compose validation và deploy contract tests đều pass trước push.
- AC-014 `[Manual]` - Sau GitHub Actions deploy, public frontend/backend health đạt HTTP 200; đăng nhập Keycloak, mở màn NBA và đối soát source/seed/target counts thành công.

## Risks & mitigations

- **Risk:** Credential Supabase cũ đã bị lộ trong branch/chat. -> **Mitigation:** không lặp lại giá trị, chỉ đọc trong bộ nhớ cho export một lần, không import history; khuyến nghị rotate sau khi hoàn tất.
- **Risk:** Snapshot có PII hoặc auth data. -> **Mitigation:** allowlist bảng/cột nghiệp vụ, loại auth schema và secret-like fields, review generated seed trước commit.
- **Risk:** Schema nguồn và Prisma schema khác nhau. -> **Mitigation:** map rõ field, kiểm tra FK order, dry-run/counts trước ghi và transaction khi seed.
- **Risk:** Seed lặp lại ghi đè dữ liệu dev. -> **Mitigation:** chỉ upsert deterministic seed-owned records, không delete/truncate và không thay record ngoài seed manifest.
- **Risk:** Merge làm suy giảm auth/deploy hiện tại. -> **Mitigation:** lấy `dev` làm chuẩn khi resolve, giữ test Keycloak/Nginx/deploy và chạy live smoke sau rollout.

## Out of scope (deferred)

- Xóa hoặc rewrite branch `tuan-anh` trên remote - thực hiện riêng khi chủ repository quyết định xử lý secret history.
- Tự động đồng bộ hai chiều với Supabase - không cần vì Supabase không còn là runtime.
- Import dữ liệu sản xuất hoặc PII thật - cần quy trình bảo mật và phê duyệt dữ liệu riêng.


## Decisions captured during review

- (approved as drafted)

## Skill provenance

sdcorejs-spec (approved on attempt 1 / 3)
