# Scope UI v1: SHB Multi-Agent System (MAS) Credit Assessment

Tài liệu này xác định phạm vi các màn hình (screens) cần phát triển cho phiên bản UI đầu tiên (v1) phục vụ chạy demo UAT và Hackathon.

---

## 1. Màn hình 1: Dashboard Danh sách Hồ sơ (Case Queue Dashboard)

* **Mục tiêu**: Giúp Cán bộ tín dụng quản lý và theo dõi hồ sơ. Áp dụng quy tắc *Path to Action*, màn hình đầu tiên sau khi đăng nhập phải định hướng người dùng ngay vào việc cần làm.
* **Hai hành động cốt lõi (Primary Actions)**:
  1. **Xử lý hồ sơ tồn đọng**: Trạng thái mặc định hiển thị tab **Cần Xử Lý (HITL Queue)**.
  2. **Tạo hồ sơ mới (Walk-in Route)**: Nút CTA chính "Thêm Hồ Sơ Mới" trigger Màn hình 3.
* **Summary Widgets** (Progressive Disclosure):
  * "3 hồ sơ chờ duyệt", "15 hồ sơ tự động duyệt hôm nay", **"4 khoản vay cần theo dõi"** *(mới — từ Loan Health Monitoring)*.
* **Các Tab bộ lọc**:
  * **Cần Xử Lý (HITL Queue)**: Mặc định.
  * **Đang Xử Lý (Active Processing)**.
  * **Tất cả (All)**.
  * **Lịch sử (History)**.
  * **⚠️ Sức khỏe khoản vay (Loan Health)** *(mới)*: Liệt kê khoản vay active có Loan Health Score dưới ngưỡng. Score badge dùng `{colors.semantic-error}` cho <30, `{colors.timeline-thinking}` (peach/amber) cho 30–49. Chỉ hiện với Tier 1 (SHB account holders).
* **Tương tác trên mỗi dòng**: Mã hồ sơ, Tên KH, Số tiền. Risk/Confidence badge là interactive pills với tooltip giải thích.

---

## 2. Màn hình 2: Workspace Thẩm định Hồ sơ (Case Assessment Workspace)

* **Mục tiêu**: Màn hình cốt lõi. Toàn bộ kết quả Agent để ra quyết định mà không đọc thủ công tài liệu thô.
* **Các Phân khu chính (Layout)**:

  * **Header Trạng thái & Thao tác**:
    * Quyết định khuyến nghị Rules Engine: `RECOMMEND`, `NEEDS_REVIEW`, `BLOCKED`.
    * Nút Approver: **Phê duyệt** hoặc **Từ chối** kèm lý do.
    * **Data Tier badge** *(mới)*: `Tier 1 · SHB Account` / `Tier 2 · Open Banking` / `Tier 3 · Document Only` — dùng `{components.badge-pill}`. Cán bộ cần biết confidence level của data trước khi ra quyết định.

  * **Biểu đồ Dòng tiền 12 tháng (Cash-Flow Analysis)**:
    * Recharts thu nhập hàng tháng, Stable Income Proxy line, outlier markers, seasonality markers.

  * **Kiểm tra Trích xuất Tài liệu (Document Extraction Audit)**:
    * Các trường + confidence score. Trường <80% là clickable edit input (không chỉ màu cảnh báo — per UX principle *Interactive Semantics*). Hover/click highlight nguồn trong document viewer.

  * **Báo cáo Gian lận (Fraud Detection Panel)** *(mở rộng)*:
    * Flags hiện có: Circular transfer, Velocity alert, Blacklist match.
    * **Household Exposure Check** *(mới)*: Flag khi ≥2 hồ sơ trong 90 ngày trùng CMND/địa chỉ/SĐT và cùng khai thu nhập hộ. Hiển thị link sang hồ sơ liên quan để cán bộ cross-check.
    * **Cross-Source Consistency** *(mới)*: So sánh thu nhập TMĐT khai báo vs. payment gateway deposits trong sao kê. Layout hai cột: `"Khai báo Shopee: 45M" | "Deposits thực: 28M" | "Chênh lệch: 38% ⚠️"`. Không phải phát hiện ảnh giả — là kiểm tra tính nhất quán giữa hai nguồn độc lập.

  * **Draft Rejection / Guidance Email** *(mới)*:
    * Chỉ render khi Rules Engine ra `BLOCKED` hoặc case vào HITL.
    * MAS soạn sẵn email: lý do từ chối ngôn ngữ thân thiện, điều kiện cụ thể để nộp lại, khung thời gian. Mục đích: giảm tải cán bộ và định hướng retention.
    * Cán bộ edit inline trước khi gửi. Dùng `{components.code-block}` style cho email body — phân biệt với UI xung quanh.
    * Nút: "Sao chép nội dung" và "Gửi Email" (nếu tích hợp mail client).

  * **Nhật ký Suy luận & Trích dẫn (Agent Traces & Citations)**:
    * Reasoning trace từng Agent + citations chỉ rõ nguồn dữ liệu. Collapsed by default — *Progressive Disclosure*.

---

## 3. Màn hình 3: Upload & Nhập hồ sơ (Document Ingestion Panel)

* **Mục tiêu**: Đưa hồ sơ khách hàng mới vào hệ thống.
* **Tính năng chính**:
  * Drag & Drop: PDF sao kê, screenshot Shopee/TikTok Shop, XML hóa đơn VAT.
  * **Data Tier auto-detect** *(mới)*: Sau khi nhập số tài khoản/CMND, hệ thống kiểm tra KH có tài khoản SHB không và tự gán Tier. Hiển thị Tier badge ngay để cán bộ biết trước confidence level.
  * Pipeline Tracker realtime: `Ingested` → `OCR/Vision-LLM Running` → `Agent Processing` → `Completed/HITL`.

---

## 4. Màn hình 4: Cấu hình Luật Tín dụng (Credit Rules Configuration)

* **Mục tiêu**: Risk Officer điều chỉnh chính sách mà không cần thay đổi code.
* **Tính năng chính**:
  * HITL thresholds: DTI, Volatility (>40%), Confidence (<80%), Loan amount (>3 tỷ).
  * Fraud rule thresholds: circular transfer rounds, velocity spike %, cross-source discrepancy %.
  * **Loan Health Score thresholds** *(mới)*: Cấu hình notify / contact / escalate (default 50 / 30 / 30).
  * **Bank Profile selector** *(mới)*: Dropdown chọn `bank_id` — toàn bộ config là per-bank. Label rõ: `"Đang cấu hình cho: SHB Production"` để tránh nhầm khi multi-bank. Rationale: kiến trúc agents không chứa business logic của ngân hàng — Rules Engine config là nơi duy nhất chứa risk appetite.

---

## 5. Màn hình 5: Loan Health Monitor *(mới)*

* **Mục tiêu**: Portfolio view cho Risk Officer / Team Lead theo dõi sức khỏe khoản vay sau giải ngân. Đây là UI của tính năng đóng lỗ hổng "không kiểm soát dòng tiền sau giải ngân" từ kết luận Thanh tra 84.
* **Chỉ áp dụng Tier 1** (KH có tài khoản SHB — đủ transaction data để monitor liên tục).
* **Role access**: `approver` và `admin` — không hiển thị với `analyst`.
* **Layout**:
  * **Score distribution chart**: Histogram Recharts Loan Health Score toàn bộ portfolio active. Risk Officer thấy ngay % khoản vay đang ở vùng nguy hiểm.
  * **Alert list**: Khoản vay có score <50, sắp xếp theo mức độ. Mỗi dòng: Tên KH, Score badge, component kéo score xuống (income drop / spending mismatch / cash buffer thấp / late payment), cán bộ phụ trách.
    * Score badge màu: `{colors.semantic-error}` cho <30, `{colors.timeline-thinking}` (peach) cho 30–49.
  * **Trend chart per loan**: Click vào khoản vay → Loan Health Score theo 12 tháng gần nhất. Tháng <30 tô đỏ, 30–49 tô amber.
  * **Action**: Nút "Giao việc" — assign review task cho cán bộ phụ trách trực tiếp từ màn hình này.
