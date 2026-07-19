---
title: Angular build environments thay cho runtime frontend env
track: angular
kind: user-preference
updated_at: 2026-07-19T03:54:00+07:00
---

# Angular build environments

- Người dùng muốn frontend Angular theo pattern enterprise-portal: typed `environment*.ts` và Angular CLI `fileReplacements`.
- Không dùng `.env`, runtime `app-config.json` hoặc container entrypoint để cấu hình public frontend, trừ khi người dùng đổi quyết định rõ ràng.
- `.env` giữ phạm vi backend, AI, Compose và secrets. Mọi giá trị trong Angular environment đều browser-visible và không được chứa secret.
- Local dùng mock auth; hosted builds dùng Core Keycloak.
- Không tự tạo UAT/QC hoặc đoán hostname. Chỉ thêm environment khi endpoint/pipeline đã tồn tại và được xác nhận.
