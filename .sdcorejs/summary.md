---
generated_at: 2026-07-19T09:55:00+07:00
git_head: bcb9961
branch: dev
tracks: [angular, nestjs, test, generic]
generator: sdcorejs-explore
---

# Project Summary - StartFlow-Agent

## What this project is

StartFlow is an Angular/NestJS/FastAPI demo platform. The current working tree adds a demo-ready Customer 360 and NBA Operations foundation on top of the original credit workflow and 500-customer PostgreSQL profile bundle. It also adds branch/account management for the canonical ADMIN, MANAGER and EMPLOYEE roles.

## Stack & track

- Angular 20 standalone + `@sdcorejs/angular` in `frontend/`.
- NestJS 11 + Prisma/PostgreSQL in `backend/`; NBA tables are mostly managed by raw SQL migration/query code.
- FastAPI/LangGraph/Pydantic in `ai-service/`; Qdrant knowledge RAG already exists.
- Zod shared contracts in `packages/contracts/`; Playwright in `test/e2e/`.
- External PostgreSQL and Keycloak; Docker Compose runs the three application containers.

## Architecture map

- `frontend/src/app/features/customers/` provides the independent Customer list/detail journey; `features/administration/` provides branch/account management; `features/nba/operations/` provides role-aware Operations and Admin demo consoles.
- `backend/src/modules/nba/` exposes the NBA business APIs with branch/account scope; `backend/src/modules/identity/` provides profile, branch and account APIs backed by Keycloak authentication and PostgreSQL authorization data.
- `backend/prisma/migrations/20260718190000_sales_copilot_profile_bundle/` creates users/customers/NBA tables; `profile-seed.ts` contains 500 customers, 25,031 transactions and 30 operational users.
- Canonical operational roles are `employee`, `manager`, `admin`; temporary rollout aliases map `sale`/`analyst` to employee and `approver` to manager.
- `ai-service/src/nba/` provides deterministic internal nightly/mini-run orchestration, stage traces, retry/timeout boundaries and safe demo scripting. Production persistence and authoritative missing M1-M13 rules remain external gates.

## Reusable building blocks

- Keycloak JWT introspection and DB user lookup: `backend/src/modules/auth/jwt-auth.guard.ts`.
- Role guard: `backend/src/modules/auth/roles.guard.ts`.
- Append audit service: `backend/src/modules/audit/audit.service.ts`.
- NBA assessment/rules/windows: `backend/src/modules/nba/assessment/`.
- Angular auth, permission mapping and Core layout: `frontend/src/app/core/auth/`, `frontend/src/app/layout/`.
- Typed NBA client and existing screens: `frontend/src/app/core/api/nba-*`, `frontend/src/app/features/nba/`.

## Conventions detected

- Angular components are standalone, OnPush and use Core UI components/signals.
- NestJS uses class-validator DTOs, Prisma and raw SQL for NBA bundle tables.
- Existing IDs in NBA tables are BIGINT; browser contracts serialize large audit/recommendation IDs as strings when needed.
- Frontend build-time environments live in `frontend/src/environments/`; runtime secrets never enter the frontend bundle.
- Shared workspace edits must preserve the current clean source baseline and newly approved `.sdcorejs` artifacts.

## Open context

- Approved spec: `.sdcorejs/specs/fullstack/2026-07-19-08-53-nba-customer-identity-platform.md`.
- Approved plan: `.sdcorejs/plans/fullstack/2026-07-19-08-53-nba-customer-identity-platform.md`.
- Missing source inputs for production-accurate M1/M5/M7 remain E1-E10 formulas, complete R1-R12 definitions and FULL_SPEC C5 patterns. Demo-safe work may proceed without inventing those rules.
- Parallel execution is authorized; backend, frontend and AI-service paths are role-split with parent-owned shared contracts.

## Freshness

Refreshed on branch `dev` at commit `bcb9961` after demo-ready P0 implementation and verification. The implementation remains uncommitted pending real PostgreSQL/Keycloak replay and Docker image verification.
