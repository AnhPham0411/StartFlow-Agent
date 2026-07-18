# Thiết kế Phân quyền 3 cấp & Nhật ký cuộc gọi - AI Sales Copilot

Tài liệu này đặc tả kiến trúc phân quyền 3 cấp người dùng (Admin HO, Branch Manager, Sale Staff) và chức năng nhật ký cuộc gọi cho hệ thống StartFlow AI Sales Copilot.

---

## 1. Phân quyền Người dùng (3 Tiers)

Hệ thống hỗ trợ 3 vai trò với quyền hạn truy cập thông tin như sau:

| Vai trò | Phân vùng dữ liệu (Data Scope) | Các chức năng được phép |
| :--- | :--- | :--- |
| **Admin HO** (`admin`) | Toàn quốc (Global) | Xem tổng quan, Log thao tác, Xem note tất cả cuộc gọi, Hiệu suất toàn bộ nhân viên, Điều chỉnh tham số sản phẩm & KPI. |
| **Manager** (`manager`) | Theo Chi nhánh (`branch`) | Xem tổng quan chi nhánh mình, Xem hiệu suất các sale thuộc chi nhánh mình. *Không* được sửa thông số KPI/Model. |
| **Sale Staff** (`sale`) | Theo phân công cá nhân (`assigned_sale_id`) | Xem danh sách được giao, Xem kịch bản tư vấn, Xem % match rate, Thêm & xem ghi chú cuộc gọi dạng văn bản. |

---

## 2. Thay đổi Cơ sở dữ liệu (Database Schema)

### Bảng `call_notes`
Lưu trữ nhật ký ghi chú cuộc gọi của nhân viên sale với khách hàng:

```sql
CREATE TABLE call_notes (
    id              BIGSERIAL PRIMARY KEY,
    customer_id     BIGINT NOT NULL REFERENCES customers(id),
    sale_id         BIGINT NOT NULL REFERENCES users(id),
    note_text       TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Prisma Mapping (`schema.prisma`)
```prisma
model CallNote {
  id          BigInt   @id @default(autoincrement())
  customerId  BigInt   @map("customer_id")
  saleId      BigInt   @map("sale_id")
  noteText    String   @map("note_text") @db.Text
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  @@map("call_notes")
}
```

---

## 3. Kiến trúc API Backend

*   **`GET /api/nba/calllist?date=...`**:
    *   Lọc theo vai trò của user đăng nhập:
        *   `sale`: `WHERE assigned_sale_id = user.id`
        *   `manager`: `WHERE assigned_sale_id IN (SELECT id FROM users WHERE branch = user.branch)`
        *   `admin`: Không lọc.
*   **`POST /api/nba/notes`**: Lưu ghi chú mới vào `call_notes`. Gán `sale_id = user.id`.
*   **`GET /api/nba/notes/:customerId`**: Lấy lịch sử ghi chú của khách hàng.
*   **`GET /api/nba/admin/performance`**: Lấy thống kê số liệu cuộc gọi theo chi nhánh hoặc toàn bộ.
*   **`GET /api/nba/admin/audit-logs`**: Lấy log từ bảng `audit_log` (chỉ dành cho `admin`).

---

## 4. Giao diện Frontend (UI/UX)

*   **Role Switcher (Môi trường Dev)**: Một dropdown chọn vai trò ở Sidebar để chuyển nhanh mock session (`admin`, `manager`, `sale`).
*   **Màn hình Sale**:
    *   Ẩn các tab quản trị.
    *   Hiển thị Match Rate dưới dạng phần trăm (Ví dụ: `85%`).
    *   Khu vực nhập ghi chú & xem note history trong chi tiết khách hàng.
*   **Màn hình Manager**:
    *   Hiển thị biểu đồ/bảng số liệu trong chi nhánh.
    *   Màn hình quản lý bị vô hiệu hóa (disabled) nút điều chỉnh KPI/Retrain.
*   **Màn hình Admin**:
    *   Mở khóa toàn bộ chức năng.
