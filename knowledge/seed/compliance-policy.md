---
document_id: sf-compliance-policy-v1
title: Quy tắc KYC AML mô phỏng
domain: compliance
---

## Dừng xử lý bắt buộc

<!-- chunk: compliance-hard-stop-v1 -->

DEMO DATA. Kết quả sanctions match trong bộ quy tắc mô phỏng là hard stop và phải dẫn tới trạng thái BLOCKED. Không được diễn giải kết quả này là truy vấn từ nhà cung cấp KYC hoặc AML thực tế.

## Rà soát chủ sở hữu hưởng lợi

<!-- chunk: compliance-ubo-review-v1 -->

DEMO DATA. Khi thông tin beneficial owner cần rà soát, hồ sơ phải chuyển NEEDS_REVIEW và yêu cầu xác minh bởi người có thẩm quyền trước khi tạo bất kỳ action ticket nào.
