---
feature: startflow-credit-assessment
status: implemented_with_live_verification_pending
tracks: [nestjs, nextjs, test, generic]
sourceSpecPath: .sdcorejs/specs/fullstack/2026-07-17-16-16-startflow-hackathon-multi-agent.md
sourcePlanPath: .sdcorejs/plans/fullstack/2026-07-17-16-25-startflow-hackathon-implementation.md
prdPath: product/prds/startflow-credit-assessment.md
userStoriesPath: product/user-stories/startflow-credit-assessment.md
acceptanceCriteriaPath: product/acceptance-criteria/startflow-credit-assessment.md
uatChecklistPath: product/uat-checklists/startflow-credit-assessment.md
updatedAt: 2026-07-17T18:12:12+07:00
---

# Product Feature Ledger - StartFlow Credit Assessment

## Business Goal

Chứng minh một đội AI ngân hàng có thể lập kế hoạch, dùng công cụ, phối hợp, giải thích bằng citation và dừng ở human approval.

## Requirement Contract

| Group       | Requirement                             | Priority | Source        | Status                                 |
| ----------- | --------------------------------------- | -------- | ------------- | -------------------------------------- |
| AC-001..004 | Runtime, auth, case snapshot            | Must     | approved spec | implemented; live auth/runtime pending |
| AC-005..013 | Multi-agent, tools, SSE, citations      | Must     | approved spec | verified by automated tests            |
| AC-014..019 | Safety, approval, comparison, knowledge | Must     | approved spec | verified; live DB ingest pending       |
| AC-020..024 | Test, env, CI/CD, deploy, demo          | Must     | approved spec | CI scaffolded; deploy/UAT pending      |

## Implementation Map

| AC          | Backend                         | Frontend            | Other                     | Status      |
| ----------- | ------------------------------- | ------------------- | ------------------------- | ----------- |
| AC-001..004 | `backend/`                      | `frontend/`         | Compose/external env      | implemented |
| AC-005..013 | `backend/src/modules/runs`      | `frontend/app/runs` | `ai-service/src/`         | implemented |
| AC-014..019 | auth/approval/knowledge modules | role-aware screens  | contracts/RAG             | implemented |
| AC-020..024 | backend tests                   | frontend/e2e        | CI/standalone deploy/docs | implemented |

## Test Map

| AC          | Unit                       | Integration            | E2E / UAT                      | Evidence                      | Status  |
| ----------- | -------------------------- | ---------------------- | ------------------------------ | ----------------------------- | ------- |
| AC-003..018 | 19 backend + 27 AI tests   | service/contract tests | 2 critical Playwright journeys | local verification 2026-07-17 | pass    |
| AC-019      | role/retrieval tests       | static integration map | live database ingest           | external PostgreSQL required  | partial |
| AC-020..022 | workspace and static tests | Compose config         | GitHub workflow definitions    | local verification 2026-07-17 | pass    |
| AC-001..002 | readiness/auth tests       | Compose config         | live runtime/Keycloak          | external services required    | pending |
| AC-023..024 | not applicable             | deploy scripts         | manual deploy and demo UAT     | checklist retained            | manual  |

## Gap Review

- Requirement gaps: none against approved spec.
- Implementation gaps: none in the scaffolded application scope.
- Verification gaps: Docker image build, live PostgreSQL/Keycloak readiness, live knowledge ingest, actual droplet deploy and the 10-minute UAT remain environment-owned.
- Ambiguities: production hostnames/secrets remain environment-owned as approved.

## Decisions

- Reuse external PostgreSQL/Keycloak and do not manage their lifecycle.
- Mock mode and human approval are release-blocking MVP behavior.
- Callback delivery is authenticated by service token plus HMAC-SHA256 raw-body signature with a five-minute replay window.

## Open Questions

- Configure GitHub Environment runtime env, domains, SSH known-hosts/key and PostgreSQL TLS material.
- Run the manual deploy and 10-minute demo UAT after external PostgreSQL/Keycloak are reachable.

## Related Docs

- PRD: `product/prds/startflow-credit-assessment.md`
- User stories: `product/user-stories/startflow-credit-assessment.md`
- Acceptance criteria: `product/acceptance-criteria/startflow-credit-assessment.md`
- UAT checklist: `product/uat-checklists/startflow-credit-assessment.md`
- Decisions: `product/decisions/startflow-credit-assessment.md`
- Spec: `.sdcorejs/specs/fullstack/2026-07-17-16-16-startflow-hackathon-multi-agent.md`
- Plan: `.sdcorejs/plans/fullstack/2026-07-17-16-25-startflow-hackathon-implementation.md`
