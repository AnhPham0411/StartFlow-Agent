# Design Decisions - StartFlow Credit Assessment

## Frontend Design Plan

### Subject

- Subject: một hồ sơ vay đi qua ba luồng chuyên môn và hội tụ tại decision gate.
- Audience: analyst/approver làm việc trên dashboard nghiệp vụ; ban giám khảo quan sát luồng.
- Single job: hiểu run đang ở đâu, dựa trên căn cứ nào và cần con người làm gì tiếp theo.

### Visual Direction

- Concept: “decision rail” - ba lane Credit/Compliance/Operations chạy song song và hội tụ vào một cổng quyết định.
- Rationale: biến kiến trúc multi-agent thành cấu trúc quét được, không dùng chat bubbles làm trung tâm.
- Intentional risk: timeline có mật độ cao; giảm rủi ro bằng progressive disclosure cho payload/tool details.

### Tokens

| Token          | Role           |       Hex | Intended use                     |
| -------------- | -------------- | --------: | -------------------------------- |
| Ledger fog     | Page surface   | `#F3F5F7` | Background trung tính            |
| Evidence white | Raised surface | `#FFFFFF` | Panels, forms, agent cards       |
| Decision ink   | Primary text   | `#18212F` | Titles/body                      |
| Audit slate    | Secondary text | `#596779` | Metadata/helper copy             |
| Gate ember     | Primary action | `#B73A0A` | CTA, active rail, approval focus |
| Trust teal     | Focus/success  | `#08756D` | Focus ring, ready/success state  |

Status luôn kèm label/icon; không chỉ dùng màu. Warning dùng amber + `Cần xem xét`; blocked dùng red + `Đã chặn`.

### Type

| Role    | Typeface / stack                          | Weight  | Usage                        |
| ------- | ----------------------------------------- | ------- | ---------------------------- |
| Display | `Segoe UI Variable, Segoe UI, sans-serif` | 700     | Screen title, final decision |
| Body    | `Segoe UI, Noto Sans, sans-serif`         | 400-600 | Forms, panels, tables        |
| Utility | `Cascadia Mono, Consolas, monospace`      | 500     | Event sequence, latency, IDs |

### Layout

- Desktop: 240px navigation + fluid work surface; run detail dùng plan strip, three-lane agent grid và right decision/evidence rail.
- Tablet: navigation thu gọn; decision rail xuống dưới agent grid.
- Mobile: top context + stacked agent cards; bottom navigation; approval CTA sticky nhưng không che nội dung.

### Signature Element

- Ba lane có số thứ tự/event pulse hội tụ vào diamond decision gate.
- Phù hợp vì biểu diễn chính xác coordination và conflict resolution; reduced-motion dùng trạng thái tĩnh.

### Copy Voice

- Bình tĩnh, nghiệp vụ, chủ động: `Bắt đầu đánh giá`, `Xem căn cứ`, `Phê duyệt hành động`.
- Empty state nói bước tiếp: `Chưa có hồ sơ. Tạo hồ sơ demo để chạy đánh giá.`
- Error nói cách sửa: `Không thể nối lại timeline. Thử lại; các sự kiện đã lưu không bị mất.`

## Mobile Design Plan

- Target: responsive mobile web, dùng khi approver xem nhanh hoặc demo trên màn hình nhỏ.
- Mobile context: chú ý gián đoạn, kết nối yếu; job chính là đọc decision và approve/reject có chủ đích.
- Navigation: bottom bar cho Dashboard/Cases/Runs; detail dùng stack/back.
- Primary action: sticky bottom action chỉ ở approval state; reject/approve có label rõ và confirmation.
- Touch targets: tối thiểu 44px; không dùng hover/gesture làm đường duy nhất.
- Offline/poor network: hiện banner, giữ persisted timeline, disable action cần network.
- Interrupted/resumed: SSE reconnect từ last event và thông báo `Đã nối lại`.
- Zoom/dynamic text: layout không khóa chiều cao; agent cards chuyển một cột.

## Design Critique

- Initial issue: dashboard card-grid chung chung không làm lộ coordination.
- Revision: đưa decision rail và three-lane convergence thành cấu trúc chính; metric cards chỉ là phần phụ.
- Fit: người xem hiểu ngay “ai đang làm gì, dựa vào đâu, hội tụ ra sao”.
