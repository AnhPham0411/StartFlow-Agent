# Kịch bản demo StartFlow — tối đa 10 phút

## Chuẩn bị trước giờ demo

- CI xanh; `/ready` của backend/AI xanh.
- Keycloak có một analyst và một approver; giữ sẵn hai session/browser profile.
- Knowledge seed đã ingest; LLM để `mock` nếu mạng/API key không ổn định.
- Tạo sẵn một case dự phòng nhưng vẫn demo flow tạo case mới.

## Timeline

| Thời gian  | Thao tác                                  | Thông điệp                                                                                 |
| ---------- | ----------------------------------------- | ------------------------------------------------------------------------------------------ |
| 0:00–0:45  | Mở dashboard sau login analyst            | Đây là decision workspace, không phải chat UI.                                             |
| 0:45–1:45  | Tạo hồ sơ demo, chỉ dữ liệu synthetic     | Snapshot bất biến giúp audit và so sánh công bằng.                                         |
| 1:45–2:30  | Bấm bắt đầu đánh giá                      | Planner sinh đúng ba specialist task.                                                      |
| 2:30–4:30  | Mở run workspace                          | Chỉ ra ba lane chạy, tool latency, citation và persisted SSE timeline.                     |
| 4:30–5:45  | Mở findings/decision                      | Credit, Compliance, Operations có góc nhìn riêng; Synthesizer nêu conflict/condition.      |
| 5:45–6:45  | Chuyển approver, approve/reject có reason | AI đề xuất; con người mới tạo action ticket.                                               |
| 6:45–8:15  | Mở Comparison, chạy cùng case             | SINGLE/MULTI dùng cùng snapshot; giải thích sáu metric demo và `metricsSource`.            |
| 8:15–9:00  | Refresh run                               | Timeline dựng lại từ PostgreSQL, không phụ thuộc state browser.                            |
| 9:00–10:00 | Chốt kiến trúc/security                   | External Keycloak/PG, no chain-of-thought, deterministic fallback, deploy migration-first. |

## Câu chốt

“StartFlow không thay người phê duyệt. Nó biến một hồ sơ thành quy trình phân tích nhiều chuyên môn có căn cứ, quan sát được, chạy lại được và luôn giữ human gate cho hành động nhạy cảm.”

## Demo NBA & Customer 360 — 6 phút

1. Đăng nhập bằng Manager, mở **Khách hàng** và nhấn một dòng để vào Customer 360. Nhấn mạnh danh sách được giới hạn theo chi nhánh và vẫn mở được khách hàng chưa có recommendation.
2. Mở **NBA Operations → Batch & Stages**, chỉ đúng lane M1–M13 và badge `DEMO MODE`. Nhấn **Chạy mini-run demo**; nói rõ đây là journey UI deterministic, không ghi production batch.
3. Mở Compliance/Tag QA/Models/RAG/Audit để trình bày các control surface; mục thiếu E1–E10, R1–R12 và C5 luôn hiện `planned/not-configured`, không giả lập rule production.
4. Mở **Quản trị hệ thống → Chi nhánh/Tài khoản** bằng Manager: thấy dữ liệu chi nhánh nhưng không có thao tác ghi. Chuyển sang Admin: tạo/cập nhật, khóa/mở khóa, reset mật khẩu; nhấn mạnh mật khẩu tạm không hiển thị trên Portal.
5. Chốt bằng ba lớp bảo vệ: Keycloak xác thực, PostgreSQL giữ effective role/branch, API thực thi scope; việc ẩn menu/nút chỉ là UX và không thay thế authorization backend.

Tài khoản demo phải dùng identity đã được đồng bộ qua `identity:seed`; không dùng shared password trên màn hình hoặc trong log.

## Phương án dự phòng

- LLM lỗi: chuyển `LLM_MODE=mock` và dùng cùng seed.
- SSE mất kết nối: refresh để chứng minh persisted replay.
- External service gián đoạn: dùng recording/screenshots từ UAT, không thay bằng dữ liệu thật hay tắt auth production.
