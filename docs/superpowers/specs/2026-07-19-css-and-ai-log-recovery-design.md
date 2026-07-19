# CSS and AI Log Recovery Design

## Goal

Restore the complete Core UI stylesheet and Material icon fonts on deployed development builds, make local development explicitly use the shared development API and Keycloak, and append more than 100 clearly synthetic StartFlow project conversations to `ai.log` without replacing its three existing records.

## Root Cause

The deployed HTML references the current hashed stylesheet and both the stylesheet and font assets return HTTP 200. Angular critical-CSS optimization emits the stylesheet as `media="print"` with an inline `onload="this.media='all'"` handler. The strict Content Security Policy blocks that handler, so the complete stylesheet never becomes active for screen media. The blocked Cloudflare Insights beacon is unrelated analytics injection and must not be whitelisted to fix UI styling.

## Changes

1. Configure development and production Angular builds with script/style minification enabled but `styles.inlineCritical` disabled. Keep `outputHashing: "all"` so the generated stylesheet remains content-addressed.
2. Make the local Angular configuration explicitly replace `environment.ts` with `environment.development.ts`. Preserve the existing uncommitted environment values that already point to the shared development API and Keycloak.
3. Do not disable all caching. HTML remains `no-store`; hashed JavaScript remains immutable; CSS and fonts retain their existing bounded cache rules.
4. Append 120 JSONL records to `ai.log`. Each record keeps the existing fields (`time`, `session_id`, `model`, token counts, `user`, `assistant`) and adds `synthetic: true`. Conversations cover discovery, Angular/Core UI, NestJS, AI workflow, Customer 360/NBA, Keycloak/RBAC, seed data, tests, deployment, cache and CSS incident response. They contain no secrets or real customer data.

## Verification

- Parse every line of `ai.log` as JSON and confirm 123 total records, with the first three unchanged and 120 new synthetic records.
- Build Angular development and production configurations.
- Confirm both built `index.html` files use a normal screen stylesheet link and contain no stylesheet `media="print"`/inline `onload` loader.
- Confirm hashed CSS and Material icon font files exist in build output.
- Run frontend lint, typecheck, relevant contract tests and deployment tests.
- Start the local frontend with the local configuration and confirm its compiled environment uses the shared development API/Keycloak.

## Non-goals

- Do not allow Cloudflare Insights in CSP.
- Do not change backend, authentication data, API behavior, global UI design or Docker storage policy.
- Do not modify or remove the existing three `ai.log` records.
