# Screen Flow - StartFlow Credit Assessment

```text
Keycloak login
  -> /dashboard
  -> /cases/new
  -> create demo case
  -> /cases/:caseId
  -> start multi-agent run
  -> /runs/:runId (SSE + replay)
       -> plan created
       -> Credit / Compliance / Operations lanes
       -> Synthesizer decision gate
       -> approval required?
            yes -> approver approve/reject -> action ticket/audit
            no  -> completed
  -> /comparisons?caseId=:caseId
```

Admin-only branch: `/knowledge` -> ingest demo knowledge -> show ingestion status/citations. Permission-denied returns to dashboard with explicit role message.

Mobile resume: reconnect to `/runs/:runId`, send last event ID, show persisted events, then continue live events without duplicate.
