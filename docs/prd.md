# PRD - StartFlow Sales Copilot

## Bối cảnh

Đội thi cần một trải nghiệm bán hàng có thể demo trong thời gian ngắn nhưng vẫn bám hạ tầng thật: Keycloak, PostgreSQL, Qdrant, Angular, NestJS và Python AI service. Sales Copilot mở rộng StartFlow bằng bộ hồ sơ khách hàng demo và luồng NBA có kiểm soát quyền.

## Người dùng

- Sale: xem khách được giao, chuẩn bị cuộc gọi, đọc đánh giá, ghi chú và phản hồi kết quả.
- Manager: xem dữ liệu trong chi nhánh, phân công call list và điều chỉnh ưu tiên sản phẩm.
- Admin: xem toàn bộ và thực hiện các thao tác quản trị.

## Luồng chính

### 1. Đăng nhập

Người dùng đăng nhập bằng Keycloak. Ứng dụng không cung cấp role switcher hoặc tài khoản giả trong production. Access token được gửi đến backend cho mọi API nghiệp vụ.

### 2. Call list

Người dùng mở `/nba/calllist`, chọn ngày và xem khách trong phạm vi được phép. Mỗi dòng hiển thị đề xuất mới nhất và liên kết tới hồ sơ.

### 3. Danh sách và hồ sơ khách hàng

Trang `/nba/customers` cho phép tìm theo tên hoặc CIF. Trang chi tiết tổng hợp:

- đề xuất sản phẩm và phiên bản;
- bảng đánh giá dựa trên dữ liệu 3/6 tháng;
- cảnh báo staleness khi dữ liệu neo thay đổi;
- lịch sử ghi chú cuộc gọi;
- trace của recommendation.

### 4. Feedback

Sale ghi nhận `success`, `rejected`, `no_contact` hoặc `callback`. Trường hợp từ chối phải có lý do; suppression được áp dụng theo rule database để hạn chế đề xuất lặp lại.

### 5. Quản trị

Manager/admin điều chỉnh hệ số KPI theo sản phẩm trong giới hạn cho phép. Thao tác đi qua backend và được bảo vệ bằng realm role.

## Yêu cầu chức năng

- Dữ liệu demo được khởi tạo tự động sau migration và có thể chạy lại.
- Token role là nguồn quyền duy nhất; profile database chỉ bổ sung id/branch.
- Sale không thể đọc khách ngoài assignment.
- Manager không thể đọc khách ngoài branch.
- API ghi chú và feedback không fallback sang một user mặc định.
- Assessment rules vẫn hiển thị khi LLM không sẵn sàng.
- UI không phụ thuộc địa chỉ localhost hoặc internal service URL.
- Deployment seed lỗi phải dừng trước khi thay container đang healthy.

## Yêu cầu phi chức năng

- Security: fail closed cho auth/profile link; không lưu credential trong code hoặc seed.
- Auditability: lưu audit cho view/write quan trọng; recommendations có version và input snapshot.
- Reliability: seed transaction, idempotent, không destructive; migration forward-only.
- Operability: health checks, Nginx verification và release rollback độc lập.
- Demo readiness: dữ liệu đủ cho call list, customer profile, assessment, KPI và feedback ngay sau deploy.

## Ngoài phạm vi

- Thay Keycloak bằng auth khác.
- Thay PostgreSQL/Qdrant hiện tại.
- Cho browser gọi trực tiếp AI service.
- Huấn luyện/retrain model từ UI trong release này.
- Đồng bộ dữ liệu liên tục từ nguồn cũ.

## Acceptance criteria

1. Deploy `dev` tự chạy migration và profile seed trước rollout.
2. Seed chạy lại không làm tăng số bản ghi theo stable keys và không xoá dữ liệu.
3. Manifest lưu đúng version, SHA-256 và table counts.
4. Production frontend chỉ dùng Keycloak và gửi bearer token đến NestJS.
5. Database role không thể cấp thêm quyền so với token.
6. Backend NBA, profile seed và contracts build thành công; các trang call list, customers, customer detail và admin phải được port sang Angular Core UI trước khi nghiệm thu UI Sales Copilot.
7. Backend chặn truy cập ngang theo assignment/branch.
8. PostgreSQL, Qdrant và AI service hiện hữu tiếp tục hoạt động không đổi.
9. CI quality, tests, production build, Compose validation và deploy contracts pass.
10. Repository không chứa credential hoặc dependency runtime tới nguồn dữ liệu cũ.

## Chỉ số demo

- Đăng nhập thành công; NBA UI được đo sau khi hoàn tất hạng mục port sang Angular Core UI.
- Dữ liệu hồ sơ/call list xuất hiện ngay sau deploy đầu tiên.
- Một flow hoàn chỉnh: chọn khách → xem đánh giá → lưu ghi chú → gửi feedback.
- Health checks frontend/backend trả 200 sau rollout.
