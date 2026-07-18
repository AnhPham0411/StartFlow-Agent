---
generated_at: 2026-07-18T20:51:00+07:00
generator: sdcorejs-explore
target_root: C:/Users/nghiatt15_onemount/Documents/StartFlow-Agent
target_root_kind: target-project
git_head: f8ae8830ae0e8bbb0a1af946a2edb4a69dec8a51
dirty: true
relevant_dirty_paths:
  [
    backend/src/modules/auth,
    backend/src/config,
    backend/test,
    frontend/src/auth,
    frontend/tests/auth,
    infra/deploy,
    env examples,
  ]
tracks: [nestjs, nextjs, node, workflow]
stack_profiles: [plain-nestjs, plain-nextjs, general]
profile: simple
profile_confidence: high
source_roots: [backend/src, frontend/src, ai-service/src, infra]
summary_scope: runtime, persistence, authentication, deployment
package_manager: pnpm
package_manifest_hash: unknown
package_lock_hash: unknown
source_roots_hash: unknown
generated_from: [package.json, backend/package.json, frontend/package.json, docker-compose.yml]
commands_run: [git status, rg targeted runtime/config scan]
commands_skipped: [local .env value scan]
redaction_applied: true
---

# StartFlow Agent Summary

StartFlow is a pnpm monorepo with a plain NestJS/Prisma backend, a plain Next.js frontend, and a Python FastAPI/LangGraph AI service. PostgreSQL and Keycloak are external services and must never be provisioned by this repository's Compose stack.

## Runtime boundaries

- `backend/`: NestJS 11 API, Prisma persistence, Keycloak JWT validation, internal callbacks from the AI service.
- `frontend/`: Next.js 16 standalone application using Keycloak public configuration at build time.
- `ai-service/`: FastAPI service using SQLAlchemy/asyncpg, Alembic, external Qdrant vector storage, and an OpenAI-compatible LLM client.
- `infra/deploy/`: standalone GitHub Actions-to-droplet deployment, release directories, Nginx templates, and environment validation.

## Deployment constraints

- `dev` deploys independently under `/opt/startflow-agent/dev`; `main` targets production.
- Development secrets are `STARTFLOW_DEV` and `SSH_PRIVATE_KEY_DEV`.
- Runtime `.env`, database credentials, private keys, and generated certificates remain untracked.
- External secrets use split `DB_*` fields; Prisma and SQLAlchemy DSNs are generated only inside runtime processes.
- Host ports must remain distinct from other applications and from another StartFlow environment on the shared droplet.
