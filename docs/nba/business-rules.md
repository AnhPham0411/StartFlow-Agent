# NBA Business Rule Ledger

Status: implementation baseline for the 2026-07-19 demo. Production activation remains blocked until the source rule packs listed below are supplied and reconciled.

## Fixed platform rules

- Canonical application roles are `admin`, `manager`, and `employee`.
- `admin` has global scope and no branch. `manager` and `employee` belong to exactly one branch.
- A manager reads branch data; an employee reads only assignments tied to their local user id.
- A nightly run creates one audit thread. M1, AG1, and M2 may start concurrently, followed by ordered downstream stages.
- A failed stage is retried once. A second failure stops the run and must not persist a partial recommendation version.
- M1 is deterministic and preserves NULL values. M2 must not infer geography below the configured confidence threshold.
- Only AG1 may consume raw transaction descriptions, and it must use the local model adapter.
- AG2-AG6 receive a sanitized payload. Numeric claims must be traceable to calculator/tool slots.
- M7 validates structured output and uses a deterministic fallback when validation still fails after the bounded retry.
- M8 appends recommendation versions transactionally; mini-runs never overwrite an earlier version.
- M11 outcomes come from products opened within the configured observation window, not from a UI checkbox.
- M12 promotion requires all four gates plus improvement over the current production model.
- M13 masks case data before embedding and retains both won and lost cases.

## PII boundary

Raw names, account/card identifiers, phone numbers, addresses, national identifiers and unredacted transaction descriptions must not cross the external-model boundary or appear in prompts, stage events, audit metadata, errors or application logs. Internal customer and run ids are allowed. The sanitization layer must use allow-listed fields and fail closed.

## Demo-safe behavior

- Demo mode uses deterministic adapters and fixed configuration versions so a replay is reproducible.
- A domain stage whose production rule pack is unavailable reports `skipped/not-configured`; it must not fabricate a score, threshold or recommendation.
- Customer 360 remains available for customers without a recommendation and shows an explicit empty state.
- Mini-run is isolated to one customer, audited like a nightly run, and is suitable for the demo journey.

## Pending authoritative inputs

The repository does not currently contain the referenced complete sources for E1-E10, ordered R1-R12, or FULL_SPEC C5 regex/template definitions. Until those artifacts are approved and versioned, production weights, thresholds, compliance patterns and model selection remain configuration placeholders. Any implementation must preserve seams for those rule packs and must not label demo defaults as production policy.

## Change control

Each production rule pack must carry an immutable version, effective date, approver and checksum. A change requires parity fixtures across the shared JSON Schema, Python validation and NestJS API, plus regression evidence for ranking order, PII redaction and append-only versioning.
