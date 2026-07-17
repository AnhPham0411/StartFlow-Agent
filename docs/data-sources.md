# Nguồn dữ liệu demo

StartFlow không chứa dữ liệu khách hàng hoặc tài liệu nội bộ SHB. Ba file dưới `knowledge/seed/` là nội dung synthetic phục vụ kiểm thử:

| Domain     | File                                  | Mục đích                              |
| ---------- | ------------------------------------- | ------------------------------------- |
| Credit     | `knowledge/seed/credit-policy.md`     | ratio, risk band và điều kiện demo    |
| Compliance | `knowledge/seed/compliance-policy.md` | mock KYC/AML và hard-stop demo        |
| Operations | `knowledge/seed/operations-policy.md` | checklist chứng từ và bước xử lý demo |

Ingestion chia tài liệu thành document/section/chunk để citation luôn mang `documentId`, `documentTitle`, `section`, `chunkId`, `excerpt` và relevance score. `demoData=true` là bắt buộc ở boundary ingest.

Không đưa PII, CCCD, số tài khoản, hồ sơ tín dụng thật hoặc secret vào seed. Trước khi thay seed bằng nguồn chính thức cần có quyền sử dụng tài liệu, chính sách phân loại dữ liệu, retention và quy trình đánh giá retrieval riêng.
