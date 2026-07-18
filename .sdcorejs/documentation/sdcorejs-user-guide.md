---
title: StartFlow - Hướng dẫn sử dụng
generated_at: 2026-07-19T03:54:00+07:00
git_head: c103b91fb02372f3b5906727ea5ddfd4ef27b1ab
modules: [frontend-configuration]
coverage: { total: 4, met: 4, partial: 0, missing: 0 }
---

# StartFlow - Hướng dẫn sử dụng

## Mục lục

1. [Cấu hình môi trường frontend](#cấu-hình-môi-trường-frontend)

## Tổng quan hệ thống

StartFlow là portal đánh giá tín dụng multi-agent dành cho analyst, approver và admin. Tài liệu này tổng hợp cách vận hành các module đã có guide evergreen.

## Cấu hình môi trường frontend

### Tổng quan

Frontend chọn cấu hình public khi Angular build. Local dùng mock auth; hosted development và production dùng Keycloak. `.env` không điều khiển frontend.

### Tác vụ

| Nhu cầu | Lệnh |
|---|---|
| Chạy local | `corepack pnpm --filter @startflow/frontend dev` |
| Build local | `corepack pnpm --filter @startflow/frontend build:local` |
| Build hosted development | `corepack pnpm --filter @startflow/frontend build:development` |
| Build production | `corepack pnpm --filter @startflow/frontend build:production` |

Khi đổi API URL hoặc public Keycloak config, sửa file tương ứng trong `frontend/src/environments/` rồi build lại. Không đưa secrets vào các file này.

### Core UI được sử dụng

| Core UI | Vai trò |
|---|---|
| `provideSdKeycloak` | Khởi tạo Core Keycloak cho hosted build |
| `SdKeycloakInterceptor` | Tích hợp Keycloak vào HTTP pipeline |
| `SdKeycloakService` | Login, logout và access token cho auth adapter |
| `SD_CORE_CONFIGURATION` | Cấu hình Core UI chung |
| `SD_AUTH_CONFIGURATION` | Nối auth state của StartFlow vào Core UI |
| `SD_LAYOUT_CONFIGURATION` | Cấu hình portal shell/navigation |
| `SD_PERMISSION_CONFIGURATION` | Ánh xạ role sang permission |

### Coverage so với yêu cầu

| # | Yêu cầu | Trạng thái |
|---|---|---|
| 1 | Local API + mock auth | met |
| 2 | Hosted development file replacement | met |
| 3 | Production file replacement | met |
| 4 | Không còn runtime `.env`/`app-config.json` | met |

## Tổng hợp coverage so với yêu cầu

| Module | Met | Partial | Missing |
|---|---:|---:|---:|
| frontend-configuration | 4 | 0 | 0 |
| **Tổng** | **4** | **0** | **0** |
