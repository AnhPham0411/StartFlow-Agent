# Angular Build Environments Implementation Plan

> **For agentic workers:** Execute inline and preserve the user's existing Angular Core UI migration worktree. Do not commit or dispatch subagents unless the user asks.

**Goal:** Replace the Angular frontend runtime `app-config.json` dependency with typed build-time environment files while keeping server secrets in process environment variables.

**Architecture:** A typed `AppEnvironment` object is selected by Angular CLI `fileReplacements` and exposed through an Angular injection token. Frontend API, SSE, authentication, and Keycloak configuration consume that token. Local development uses localhost plus mock auth; production embeds the public values currently confirmed in `.env`.

**Tech Stack:** Angular 20 standalone, TypeScript strict mode, Karma/Jasmine, Docker/Nginx, Docker Compose.

---

### Task 1: Define the environment contract RED-first

**Files:**
- Create: `frontend/src/environments/environment.model.ts`
- Create: `frontend/src/environments/environment.ts`
- Create: `frontend/src/environments/environment.production.ts`
- Test: `frontend/src/environments/environment.spec.ts`

- [ ] Add a spec that imports the default environment and asserts local API, mock auth, and non-production mode.
- [ ] Run the focused spec and confirm it fails because the environment module does not exist.
- [ ] Add the typed contract plus development and production objects.
- [ ] Run the focused spec and confirm it passes.

### Task 2: Replace RuntimeConfigService consumers

**Files:**
- Create: `frontend/src/app/core/config/app-environment.token.ts`
- Modify: `frontend/src/main.ts`
- Modify: `frontend/src/app/app.config.ts`
- Modify: `frontend/src/app/app.config.spec.ts`
- Modify: `frontend/src/app/core/auth/keycloak.configuration.ts`
- Modify: `frontend/src/app/core/auth/auth-state.service.ts`
- Modify: `frontend/src/app/core/auth/auth-state.service.spec.ts`
- Modify: `frontend/src/app/core/api/startflow-api.service.ts`
- Modify: `frontend/src/app/core/api/startflow-api.service.spec.ts`
- Modify: `frontend/src/app/core/streaming/run-event-stream.service.ts`
- Modify: `frontend/src/app/core/streaming/run-event-stream.service.spec.ts`
- Delete: `frontend/src/app/core/config/runtime-config.model.ts`
- Delete: `frontend/src/app/core/config/runtime-config.service.ts`
- Delete: `frontend/src/app/core/config/runtime-config.service.spec.ts`

- [ ] Change existing specs to request the new environment-driven API and confirm RED.
- [ ] Add the environment injection token and switch all consumers.
- [ ] Bootstrap Angular synchronously with the selected build environment.
- [ ] Remove the obsolete runtime config service and rerun focused tests.

### Task 3: Configure Angular builds and delivery

**Files:**
- Modify: `frontend/angular.json`
- Modify: `frontend/package.json`
- Modify: `frontend/Dockerfile`
- Modify: `frontend/nginx.conf`
- Modify: `docker-compose.yml`
- Modify: `docker-compose.prod.yml`
- Modify: `.github/workflows/deploy.yml`
- Modify: `infra/deploy/prepare-env.sh`
- Modify: `infra/deploy/tests/prepare-env.test.sh`
- Modify: `infra/deploy/tests/workflow.test.sh`
- Delete: `frontend/public/app-config.template.json`
- Delete: `frontend/docker-entrypoint.d/40-startflow-config.sh`

- [ ] Add production `fileReplacements` and explicit local/production build scripts.
- [ ] Build the selected Angular configuration in Docker instead of generating config at container startup.
- [ ] Remove frontend public runtime variables from Compose and deployment validation.
- [ ] Update static deployment tests to assert build-time environments.

### Task 4: Update operating documentation and verify

**Files:**
- Modify: `.env.example`
- Modify: `.env.production.example`
- Modify: `START.md`
- Modify: `ReadMe.md`
- Modify: `docs/architecture.md`
- Modify: `docs/deployment.md`

- [ ] Remove retired frontend runtime keys from env examples and instructions.
- [ ] Document that frontend public values require a rebuild, while backend/AI secrets remain in `.env`.
- [ ] Run focused Angular tests, full frontend tests, lint, typecheck, builds, deployment shell tests, and Compose rendering.
- [ ] Inspect the final diff for stale runtime-config references and accidental secret exposure.
