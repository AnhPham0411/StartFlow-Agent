# Frozen Contract - StartFlow Parallel Execution

```yaml
parallel_context:
  source: sdcorejs-parallel-dispatch
  contract_id: SFA-20260717-001
  approved_plan_path: .sdcorejs/plans/fullstack/2026-07-17-16-25-startflow-hackathon-implementation.md
  approved_plan_hash: 93c696114a61fcade9974c04cfd845f0cb91cb4574c43b30759a3e2302fcfb84
  target_root: C:/Users/nghiatt15_onemount/Documents/StartFlow-Agent
  target_root_kind: target-project
  track: fullstack
  verdict: ROLE-SPLIT
  unit_isolation:
    strategy: disjoint-paths
    max_concurrency: 3
  shared_file_owner: parent
  redaction_applied: true
  final_tail:
    verify_before_done: true
    branch_ready_final_gate: true
```

## Immutable inputs

- Approved spec hash: `be8d968b1ff9f260f97681ab0f7d5f94105ed148c96c7f758cea849c92624453`.
- Approved plan hash: `93c696114a61fcade9974c04cfd845f0cb91cb4574c43b30759a3e2302fcfb84`.
- PostgreSQL 18 and Keycloak already exist and are configured only through environment variables.
- No role may modify approved specs/plans, root manifests, lockfiles, env examples, Compose files, GitHub workflows, `ReadMe.md`, `START.md`, `.gitignore`, or `devops-config`.

## Shared domain contract

The source of truth is `packages/contracts/src/schemas.ts`.

- Roles: `analyst`, `approver`, `admin`.
- Specialist agents: `CREDIT`, `COMPLIANCE`, `OPERATIONS`.
- Decisions: `RECOMMEND`, `NEEDS_REVIEW`, `BLOCKED`.
- Public events: `run.started`, `plan.created`, `agent.started`, `tool.completed`, `citation.added`, `agent.completed`, `synthesis.completed`, `approval.required`, `run.completed`, `run.failed`.
- Tool names: `financial_calculator`, `mock_kyc_aml`, `document_checklist`, `knowledge_retrieval`.
- Event ordering uses a positive monotonic `sequence`; duplicate callbacks are rejected by `idempotencyKey`.
- Public events contain filtered summaries, never chain-of-thought, raw prompts, tokens, credentials, Authorization headers or cookies.

## HTTP contract

- `GET /health`, `GET /ready`.
- `GET|POST /api/cases`, `GET /api/cases/:caseId`.
- `POST /api/cases/:caseId/runs`.
- `GET /api/runs/:runId`, `GET /api/runs/:runId/events` (SSE with `Last-Event-ID`).
- `POST /api/runs/:runId/approvals`.
- `POST /api/cases/:caseId/comparisons`.
- `GET|POST /api/knowledge` (admin).
- Internal AI callback is not exposed through public Nginx, requires `INTERNAL_SERVICE_TOKEN`, run ID and idempotency key.

## Screen contract

- `/dashboard`: case/run/approval metrics.
- `/cases`: list; `/cases/new`: validated demo intake; `/cases/[caseId]`: case snapshot and runs.
- `/runs/[runId]`: plan, agent cards, live/persisted timeline, tools, citations, decision and approval.
- `/comparisons`: same-snapshot single vs multi metrics.
- `/knowledge`: admin-only demo knowledge view/ingestion.

## Unit ownership

- Backend unit writes only `backend/**` and runs backend-focused checks.
- AI unit writes only `ai-service/**` and `knowledge/seed/**` and runs Python-focused checks.
- Frontend unit writes only `frontend/**` and runs frontend-focused checks.
- Parent owns shared contracts, dependency lockfile, env, Compose, product/design/docs, cross-stack tests and both repositories' CI/CD integration.

Any contract drift must return to the parent. Units must not spawn additional agents.
