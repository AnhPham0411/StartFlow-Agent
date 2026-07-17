# Decisions - StartFlow đánh giá hồ sơ vay đa tác nhân

| Date       | Decision                                                 | Reason                                            | Impact               |
| ---------- | -------------------------------------------------------- | ------------------------------------------------- | -------------------- |
| 2026-07-17 | Chỉ làm một use case hồ sơ vay                           | Tối đa hóa chiều sâu demo trong 48 giờ            | Product, all apps    |
| 2026-07-17 | Planner + Credit + Compliance + Operations + Synthesizer | Bám đúng tiêu chí multi-agent phối hợp            | AI, dashboard        |
| 2026-07-17 | External PostgreSQL 18 và Keycloak qua env               | Hạ tầng đã có sẵn; tránh duplicate/lifecycle risk | Docker, deploy, auth |
| 2026-07-17 | Mock mode deterministic là bắt buộc                      | Demo không phụ thuộc internet/provider            | AI, CI, UAT          |
| 2026-07-17 | Human approval trước action ticket                       | Chứng minh kiểm soát ngân hàng                    | Backend, UI, audit   |
| 2026-07-17 | Không hiển thị chain-of-thought                          | Quan sát workflow mà không lộ reasoning nhạy cảm  | Event contract, UI   |
