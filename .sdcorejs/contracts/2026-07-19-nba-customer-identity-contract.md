# Frozen Contract - NBA Customer & Identity Execution

This contract is frozen for parallel execution. Role agents must not change it silently.

## Roles and scope

- Canonical roles: `admin | manager | employee`.
- Rollout aliases: `sale/analyst -> employee`, `approver -> manager`.
- Admin has no branch and global access.
- Manager and employee require exactly one branch.
- Manager sees all customers/accounts/call-lists in its branch.
- Employee sees only customers and call-lists assigned to its own local user id.

## Identity API

- `GET /api/auth/me` -> `{id,username,full_name,role,active,branch,permissions[]}`.
- `GET /api/admin/branches?q=&active=` -> branch list.
- `POST /api/admin/branches` -> `{code,name}`.
- `PUT /api/admin/branches/:id` -> `{name,active?}`; code immutable.
- `POST /api/admin/branches/:id/deactivate` -> reject when active accounts remain.
- `GET /api/admin/accounts?q=&role=&branch_id=&active=` -> scoped list; manager read-only own branch.
- `POST /api/admin/accounts` -> `{username,full_name,role,branch_id?}`; admin only.
- `PUT /api/admin/accounts/:id` -> `{full_name,role,branch_id?}`; username immutable.
- `POST /api/admin/accounts/:id/enable|disable|reset-password`; admin only.

## Public DTOs

- Branch: `{id:number,code:string,name:string,active:boolean,account_count:number}`.
- Account: `{id:number,username:string,full_name:string,role,active:boolean,branch:BranchRef|null,identity_synced:boolean}`.
- BranchRef: `{id:number,code:string,name:string}`.
- Errors keep existing NestJS JSON error behavior; no secret or temporary password is returned after creation/reset.

## Customer API and routes

- `GET /api/nba/customers?q=&limit=` remains backward compatible and gains typed role scope.
- Angular routes: `/customers`, `/customers/:customerId`, `/administration/branches`, `/administration/accounts`.
- Existing `/nba` Call List stays available; old `/nba/customers/:customerId` navigation remains compatible.

## Permissions

- `STARTFLOW_CUSTOMER_VIEW`
- `STARTFLOW_NBA_OPERATIONS_VIEW` (manager/admin operations consoles)
- `STARTFLOW_BRANCH_VIEW`, `STARTFLOW_BRANCH_MANAGE`
- `STARTFLOW_ACCOUNT_VIEW`, `STARTFLOW_ACCOUNT_MANAGE`
- Employee: customer view and existing operator permissions.
- Manager: employee permissions + branch/account read + approval/call-list management.
- Admin: all permissions.

## Seed

- Branches: HN-HK, HP, HCM-BT, HN-DD, CT, HUE, DN, NT, BH, HCM-Q1.
- Preserve user ids 1-30 and all existing FKs.
- user017/user028 -> admin with null branch.
- user006/user007/user020/user023/user029 -> manager with existing branch.
- Remaining users -> employee with existing branch.
- Keycloak seed is idempotent, runtime-secret driven and never logs passwords.

## Parallel ownership

- Parent: `packages/contracts/`, `.sdcorejs/`, fan-in integration and shared contract changes.
- Backend role: `backend/`, root env/compose/deploy files only when explicitly listed in brief.
- Frontend role: `frontend/` only.
- AI role: `ai-service/` only.
