# PRD - StartFlow đánh giá hồ sơ vay đa tác nhân

## Problem

Một chatbot đơn lẻ khó chứng minh khả năng phối hợp liên phòng ban, dùng công cụ thật và giải thích quyết định trong quy trình tín dụng. Ban giám khảo cần nhìn thấy một hệ thống lập kế hoạch, chia việc, tổng hợp xung đột và giữ con người ở điểm phê duyệt.

## Goal

Cho phép analyst chạy một hồ sơ vay doanh nghiệp mô phỏng qua Planner, Credit, Compliance và Operations Agent; quan sát toàn bộ tiến trình; nhận đề xuất có citation; và để approver quyết định hành động tiếp theo.

## Users

- `analyst` - tạo hồ sơ demo, khởi chạy đánh giá và đọc kết quả.
- `approver` - kiểm tra căn cứ, xung đột và approve/reject action ticket.
- `admin` - quản lý knowledge seed và xem audit evidence.
- Ban giám khảo - quan sát sự khác biệt giữa single-agent và multi-agent.

## Scope

- Một use case: đánh giá hồ sơ vay doanh nghiệp.
- Planner + ba specialist agents + Synthesizer.
- Bốn công cụ: financial calculator, mock KYC/AML, document checklist, knowledge retrieval.
- Dashboard realtime/replay, citation, approval, audit và comparison.
- External PostgreSQL 18/Keycloak qua env; ba application containers.
- CI/CD caller + reusable deploy workflow trên shared app droplet.

## Out Of Scope

- Core banking/CIC/KYC/AML thật, dữ liệu khách hàng thật và tự động giải ngân.
- Provision hoặc thay đổi lifecycle PostgreSQL/Keycloak có sẵn.
- Tám chatbot tư vấn sản phẩm, HA, autoscaling và production governance.

## Success Criteria

- Demo end-to-end hoàn tất trong tối đa 10 phút.
- Cùng một run thể hiện ba specialist agents, tool events và grounded citations.
- Compliance hard-stop có thể chặn một kết quả tín dụng tích cực.
- Action ticket chỉ được tạo sau approval hợp lệ và không bị tạo trùng.
- Mock mode chạy ổn định khi không có LLM key.
