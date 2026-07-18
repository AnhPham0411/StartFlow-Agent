# StartFlow Sales Copilot - Build Specification

## Mục tiêu

StartFlow bổ sung luồng Sales Copilot (NBA) vào hệ thống multi-agent hiện tại để nhân viên bán hàng xem danh sách gọi, hồ sơ khách hàng demo, đánh giá sản phẩm, ghi chú và phản hồi. Bản tích hợp chạy độc lập trên hạ tầng StartFlow hiện có.

## Kiến trúc chuẩn

- Frontend: Next.js, chỉ gọi NestJS API bằng access token.
- Backend: NestJS, xác thực access token do Keycloak phát hành và truy cập PostgreSQL qua Prisma.
- AI service: Python service hiện tại; Qdrant tiếp tục là kho vector cho RAG.
- Database: PostgreSQL hiện tại, cấu hình từ các biến `DB_*` tại runtime.
- Deployment: Docker Compose độc lập và host Nginx riêng của StartFlow trên droplet.

Không có database hoặc identity provider dự phòng. Frontend không gọi trực tiếp service nội bộ.

## Authentication và authorization

Keycloak là nguồn xác thực và phân quyền duy nhất:

1. Frontend đăng nhập qua realm/client được cấu hình bằng `NEXT_PUBLIC_KEYCLOAK_*`.
2. Backend xác minh chữ ký, issuer và audience của bearer token.
3. Realm roles trong token quyết định quyền truy cập API.
4. `preferred_username` chỉ được dùng để tìm `users.id` và `users.branch` phục vụ phạm vi dữ liệu NBA; cột `users.role` không thay thế quyền trong token.
5. Nếu token hợp lệ nhưng chưa liên kết profile, các thao tác cần foreign key user sẽ fail closed.

Để dùng scope sale/manager với profile demo, `preferred_username` của user Keycloak phải trùng với `users.username` đã seed; tài khoản `admin` vẫn có thể kiểm tra toàn bộ dữ liệu mà không cần liên kết này.

Vai trò NBA là `sale`, `manager`, `admin`. Hai vai trò demo hiện hữu được ánh xạ tương thích: `analyst` có quyền đọc của sale, `approver` có quyền manager. `admin` có toàn quyền.

## Profile bundle

Migration `20260718190000_sales_copilot_profile_bundle` tạo schema Sales Copilot và bảng manifest. Dữ liệu demo được đóng gói trong `backend/prisma/profile-seed.ts` với checksum SHA-256 và số lượng bản ghi cố định.

Seed có các thuộc tính:

- tự chứa, không kết nối nguồn ngoài;
- transaction duy nhất theo thứ tự foreign key;
- `ON CONFLICT DO NOTHING`, không ghi đè dữ liệu đã sửa;
- không `DELETE` hoặc `TRUNCATE`;
- có thể chạy lại an toàn;
- không chứa mật khẩu user, access token hoặc connection string;
- ghi `profile_seed_manifest` để đối soát version, checksum và counts.

## API Sales Copilot

Các endpoint đều yêu cầu bearer token Keycloak:

- `GET /api/nba/calllist`
- `GET /api/nba/customers`
- `GET /api/nba/customer/:id`
- `GET /api/nba/customer/:id/assessment`
- `GET /api/nba/notes/:customerId`
- `POST /api/nba/notes`
- `POST /api/nba/feedback`
- `POST /api/nba/admin/calllist`
- `PUT /api/nba/admin/kpi`
- `GET /api/nba/audit/recommendation/:id`

Sale chỉ xem khách được giao. Manager chỉ xem khách thuộc chi nhánh đã liên kết. Admin được phép xem toàn bộ. Các lần xem/ghi quan trọng được lưu vào audit log.

## Assessment

Mặc định `EXPLAINER_MODE=rules`, không cần thêm env. Hai mode tùy chọn:

- `llm`: yêu cầu `LLM_API_KEY`, sử dụng `LLM_BASE_URL` và `LLM_MODEL`.
- `model`: yêu cầu `EXTERNAL_MODEL_URL`; hiện trả trạng thái degraded cho tới khi adapter model được triển khai.

LLM chỉ nhận evidence đã loại định danh trực tiếp. Output bị kiểm tra từ ngữ hứa hẹn và số liệu không có trong evidence; lỗi provider không làm mất bảng đánh giá rules.

## Deployment order

Workflow `dev` dùng hai GitHub Secrets hiện có. Release trên droplet thực hiện tuần tự:

1. nạp image và validate Compose;
2. kiểm tra Keycloak discovery;
3. chạy `backend-migrate`;
4. chạy `ai-migrate`;
5. chạy `backend-profile-seed`;
6. rollout backend, AI service và frontend;
7. kiểm tra health và Nginx virtual hosts;
8. chạy AI knowledge seed theo chính sách best-effort hiện tại.

Profile seed là bước bắt buộc trước rollout. Mọi thay đổi database là forward-only; rollback chỉ khôi phục container của release trước.

## Verification

Trước khi ship phải pass:

```text
pnpm ci:prepare
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
docker compose --env-file .env.example -f docker-compose.yml -f docker-compose.prod.yml config --quiet
```

Ngoài ra chạy Python quality/tests, các static deploy contract tests và secret scan. Không commit `.env`, certificate, key hoặc generated runtime logs.
