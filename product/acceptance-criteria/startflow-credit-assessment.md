# Acceptance Criteria - StartFlow đánh giá hồ sơ vay đa tác nhân

| ID     | User Story | Criterion                                                                                                           | Verification      | Status |
| ------ | ---------- | ------------------------------------------------------------------------------------------------------------------- | ----------------- | ------ |
| AC-001 | US-08      | Compose khởi động ba app services và readiness xác nhận external PostgreSQL/Keycloak, không tạo hai dependency này. | Docker smoke      | agreed |
| AC-002 | US-01      | Analyst đăng nhập qua Keycloak; người chưa đăng nhập được chuyển tới login.                                         | E2E/UAT           | agreed |
| AC-003 | US-01      | API trả 401 cho token lỗi và 403 khi thiếu role.                                                                    | Integration       | agreed |
| AC-004 | US-01      | Analyst tạo case demo và run dùng immutable snapshot.                                                               | Integration/E2E   | agreed |
| AC-005 | US-02      | Planner tạo đúng ba specialist tasks với dependency/status.                                                         | Unit/E2E          | agreed |
| AC-006 | US-02      | Mỗi specialist tạo tool hoặc retrieval event có latency/output đã lọc.                                              | Unit/Integration  | agreed |
| AC-007 | US-03      | Credit result có ratios, risk band và citation.                                                                     | Unit/E2E          | agreed |
| AC-008 | US-03      | Compliance result có mock KYC/AML, hard-stop/condition và citation.                                                 | Unit/E2E          | agreed |
| AC-009 | US-03      | Operations result có checklist, missing docs và proposed action.                                                    | Unit/E2E          | agreed |
| AC-010 | US-04      | Synthesizer hợp nhất xung đột và trả một decision status hợp lệ.                                                    | Unit/E2E          | agreed |
| AC-011 | US-04      | Một agent lỗi vẫn cho partial result với confidence không tăng.                                                     | Unit              | agreed |
| AC-012 | US-04      | SSE có thứ tự, resume không duplicate và refresh dựng lại timeline.                                                 | Integration/E2E   | agreed |
| AC-013 | US-03      | Citation chỉ tới đúng document/section/chunk/excerpt.                                                               | Integration/E2E   | agreed |
| AC-014 | US-04      | UI/event/log không lộ chain-of-thought hoặc secret.                                                                 | Security test/UAT | agreed |
| AC-015 | US-05      | Analyst không tạo ticket; approver approve/reject với reason/audit.                                                 | Integration/E2E   | agreed |
| AC-016 | US-05      | Concurrent approval chỉ tạo một ticket.                                                                             | Integration       | agreed |
| AC-017 | US-06      | Comparison dùng cùng snapshot và hiển thị sáu metrics.                                                              | Unit/E2E          | agreed |
| AC-018 | US-08      | Mock mode không cần API key và cho kết quả ổn định.                                                                 | Unit/E2E          | agreed |
| AC-019 | US-07      | Admin ingest knowledge; non-admin bị từ chối; retrieval có citation mỗi domain.                                     | Integration       | agreed |
| AC-020 | US-08      | CI chạy unit/integration/e2e trọng yếu, không skip để làm xanh.                                                     | CI                | agreed |
| AC-021 | US-07      | Env examples đủ key nhưng không chứa secret thật.                                                                   | Static check      | agreed |
| AC-022 | US-08      | PR CI chạy lint/typecheck/tests/build/Compose validation với lockfile.                                              | CI                | agreed |
| AC-023 | US-08      | Deploy workflow chạy ba app services, không ảnh hưởng enterprise app hoặc external dependencies.                    | Manual deploy     | agreed |
| AC-024 | US-08      | Demo script hoàn tất login-to-comparison trong tối đa 10 phút.                                                      | UAT               | agreed |
