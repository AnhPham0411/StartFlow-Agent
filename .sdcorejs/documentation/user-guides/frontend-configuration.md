---
module: frontend-configuration
title: Cấu hình môi trường frontend
tracks: [angular]
generated_at: 2026-07-19T03:47:56+07:00
git_head: c103b91fb02372f3b5906727ea5ddfd4ef27b1ab
routes: []
permissions: []
entities: []
screens: []
spec_refs: []
prd_refs: []
coverage: { total: 4, met: 4, partial: 0, missing: 0 }
---

# Cấu hình môi trường frontend - Hướng dẫn sử dụng

## Tổng quan

Frontend StartFlow chọn cấu hình public khi Angular build. Người phát triển dùng `local`; pipeline hosted development dùng `development`; bản phát hành chính thức dùng `production`. `.env` không điều khiển frontend và tiếp tục dành cho server settings cùng secrets.

## Màn hình và tác vụ

Tính năng này không có màn hình cấu hình trong portal. Chọn môi trường qua lệnh build:

| Nhu cầu | Lệnh |
|---|---|
| Chạy local | `corepack pnpm --filter @startflow/frontend dev` |
| Build local | `corepack pnpm --filter @startflow/frontend build:local` |
| Build hosted development | `corepack pnpm --filter @startflow/frontend build:development` |
| Build production | `corepack pnpm --filter @startflow/frontend build:production` |

Khi cần đổi API URL hoặc public Keycloak config, sửa file trong `frontend/src/environments/` tương ứng rồi build lại. Không đưa secrets vào các file này.

## Bảng quyền

Không có permission riêng; chỉ người có quyền sửa source/deployment mới nên thay đổi build environment.

## Tham chiếu dữ liệu

| Field | Kiểu | Bắt buộc | Ràng buộc |
|---|---|---|---|
| `production` | boolean | có | `true` chỉ cho production build |
| `apiUrl` | string | có | Public HTTP(S) API base URL |
| `authMode` | union | có | `mock` hoặc `keycloak` |
| `keycloakUrl` | string | khi dùng Keycloak | Public Keycloak origin |
| `keycloakRealm` | string | khi dùng Keycloak | Realm public |
| `keycloakClientId` | string | khi dùng Keycloak | Public SPA client ID; không phải secret |

## Core UI được sử dụng

| Core UI | Vai trò trong tính năng |
|---|---|
| `SD_CORE_CONFIGURATION` | Cấu hình Core UI dùng chung lúc bootstrap |
| `SD_AUTH_CONFIGURATION` | Nối auth state của StartFlow vào Core UI |
| `SD_LAYOUT_CONFIGURATION` | Cấu hình shell/navigation của portal |
| `SD_PERMISSION_CONFIGURATION` | Ánh xạ role sang permission |
| `provideSdKeycloak` | Khởi tạo Core Keycloak cho hosted build |
| `SdKeycloakInterceptor` | Gắn xử lý Keycloak vào HTTP pipeline |
| `SdKeycloakService` | Cung cấp login, logout và access token cho auth adapter |

## Coverage so với yêu cầu

> Không có spec/PRD riêng cho thay đổi này; bảng dưới đây được đối chiếu best-effort từ code và yêu cầu trực tiếp của người dùng.

| # | Tính năng phát hiện từ code | Trạng thái | Ghi chú |
|---|---|---|---|
| 1 | Local dùng localhost API và mock auth | met | `environment.ts` |
| 2 | Hosted development dùng file replacement riêng | met | `environment.development.ts` |
| 3 | Production dùng file replacement riêng | met | `environment.production.ts` |
| 4 | Frontend không còn phụ thuộc `.env`/`app-config.json` lúc chạy | met | Docker/Nginx/deploy contract |

## Checklist ảnh minh họa

- [x] Không áp dụng - tính năng không có màn hình UI riêng để chụp.

Nếu module có thêm màn hình cấu hình trong tương lai, chạy:

```powershell
$env:SDCOREJS_DOCS_BASE_URL='http://localhost:3000'; node .sdcorejs/documentation/user-guides/capture-screenshots.playwright.mjs
```
