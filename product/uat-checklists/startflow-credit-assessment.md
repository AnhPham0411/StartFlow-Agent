# UAT Checklist - StartFlow đánh giá hồ sơ vay đa tác nhân

| Scenario             | Steps                                                      | Expected Result                                                      | Owner | Status  |
| -------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------- | ----- | ------- |
| Đăng nhập analyst    | Mở app, login bằng account đã map role                     | Vào dashboard; không thấy admin-only actions                         | PO/QC | pending |
| Chạy hồ sơ tốt       | Tạo case fixture tốt, bấm `Bắt đầu đánh giá`               | Ba agent chạy; decision `RECOMMEND` hoặc `NEEDS_REVIEW` có điều kiện | PO/QC | pending |
| Compliance hard-stop | Chạy fixture có AML flag                                   | Credit có thể tích cực nhưng final decision là `BLOCKED`             | PO/QC | pending |
| Mất kết nối SSE      | Đang xem run thì refresh/reconnect                         | Timeline tiếp tục sau last event, không duplicate                    | QC    | pending |
| Human approval       | Login approver, mở proposed action, nhập reason và approve | Một ticket được tạo và audit ghi identity/time                       | PO/QC | pending |
| Permission denial    | Analyst mở `/knowledge` hoặc gọi admin API                 | UI/API từ chối rõ ràng, không lộ dữ liệu                             | QC    | pending |
| Single vs multi      | Mở comparison của case đã chạy                             | Cùng snapshot và đủ sáu metrics                                      | PO/QC | pending |
| Demo dự phòng        | Chuyển `LLM_MODE=mock`, không cấp LLM key                  | Toàn bộ journey vẫn hoàn tất trong 10 phút                           | Team  | pending |
