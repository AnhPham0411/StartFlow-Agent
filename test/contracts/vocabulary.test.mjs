import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const expectedEvents = [
  'run.started',
  'plan.created',
  'agent.started',
  'tool.completed',
  'citation.added',
  'agent.completed',
  'synthesis.completed',
  'approval.required',
  'run.completed',
  'run.failed',
];

test('public event schema keeps the frozen vocabulary', async () => {
  const schema = JSON.parse(await readFile('packages/contracts/run-event.schema.json', 'utf8'));
  const serialized = JSON.stringify(schema);

  for (const event of expectedEvents)
    assert.match(serialized, new RegExp(event.replace('.', '\\.')));
  assert.doesNotMatch(serialized, /chain.?of.?thought|reasoning_trace|scratchpad/i);
});

test('compose never provisions the existing PostgreSQL, Keycloak, or Qdrant services', async () => {
  const compose = await readFile('docker-compose.yml', 'utf8');
  assert.doesNotMatch(compose, /^\s{2}(postgres|postgresql|keycloak|qdrant):/m);
  assert.match(compose, /^\s{2}backend:/m);
  assert.match(compose, /^\s{2}ai-service:/m);
  assert.match(compose, /^\s{2}frontend:/m);
});

test('deployment env examples keep database credentials split', async () => {
  for (const path of ['.env.example', '.env.production.example']) {
    const envExample = await readFile(path, 'utf8');
    for (const key of ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD']) {
      assert.match(envExample, new RegExp(`^${key}=`, 'm'));
    }
    assert.doesNotMatch(envExample, /^(DATABASE_URL|AI_DATABASE_URL)=/m);
  }
});

test('AI vector storage uses external Qdrant without a pgvector deployment gate', async () => {
  const repository = await readFile('ai-service/src/rag/repository.py', 'utf8');
  const uvLock = await readFile('ai-service/uv.lock', 'utf8');
  const migration = await readFile(
    'ai-service/alembic/versions/20260717_0001_ai_knowledge.py',
    'utf8',
  );

  assert.match(repository, /\/points\/query/);
  assert.match(repository, /api-key/);
  assert.doesNotMatch(repository, /pgvector/);
  assert.doesNotMatch(uvLock, /name = "pgvector"/);
  assert.doesNotMatch(migration, /pg_extension|vector_cosine_ops|Vector\(/);
  for (const path of ['.env.example', '.env.production.example']) {
    const envExample = await readFile(path, 'utf8');
    for (const key of ['QDRANT_URL', 'QDRANT_API_KEY', 'QDRANT_COLLECTION', 'QDRANT_VECTOR_SIZE']) {
      assert.match(envExample, new RegExp(`^${key}=`, 'm'));
    }
  }
});

test('frontend container never receives private runtime env', async () => {
  const compose = await readFile('docker-compose.yml', 'utf8');
  const frontend = compose.match(/^  frontend:\r?\n([\s\S]*?)(?=^  backend-migrate:)/m)?.[0];
  assert.ok(frontend);
  assert.doesNotMatch(frontend, /env_file:/);
});

test('NBA schema keeps canonical roles and auditable run vocabulary', async () => {
  const schema = JSON.parse(await readFile('packages/contracts/nba-contracts.schema.json', 'utf8'));
  const serialized = JSON.stringify(schema);

  for (const role of ['employee', 'manager', 'admin'])
    assert.match(serialized, new RegExp(`"${role}"`));
  for (const status of ['pending', 'running', 'succeeded', 'failed']) {
    assert.match(serialized, new RegExp(`"${status}"`));
  }
  for (const stage of ['M1', 'AG1', 'M8', 'M13'])
    assert.match(serialized, new RegExp(`"${stage}"`));
  assert.doesNotMatch(serialized, /"sale"|"analyst"|"approver"/);
});

test('frontend CSP permits only the Core UI silent SSO inline script', async () => {
  const angularConfig = JSON.parse(await readFile('frontend/angular.json', 'utf8'));
  const assets = angularConfig.projects.startflow.architect.build.options.assets;
  assert.ok(
    assets.some(
      (asset) =>
        asset.input === 'node_modules/@sdcorejs/angular/modules/keycloak/htmls' &&
        asset.glob === '*.html' &&
        asset.output === '/',
    ),
    'Angular must copy the Core UI Keycloak static HTML files',
  );

  const inlineScript = '\n      parent.postMessage(location.href, location.origin);\n    ';
  const requiredHash = `sha256-${createHash('sha256').update(inlineScript).digest('base64')}`;
  for (const path of ['frontend/nginx.conf', 'infra/deploy/nginx/frontend.conf.template']) {
    const nginx = await readFile(path, 'utf8');
    const scriptSource = nginx.match(/script-src ([^;]+)/)?.[1];
    assert.ok(scriptSource, `${path} must define script-src`);
    assert.ok(
      scriptSource.includes(`'${requiredHash}'`),
      `${path} must allow the exact Core UI silent SSO script hash`,
    );
    assert.doesNotMatch(scriptSource, /'unsafe-inline'|static\.cloudflareinsights\.com/);
  }
});

test('frontend deploy keeps HTML fresh and only immutable-caches hashed JavaScript', async () => {
  const angularConfig = JSON.parse(await readFile('frontend/angular.json', 'utf8'));
  const buildConfigurations = angularConfig.projects.startflow.architect.build.configurations;
  assert.equal(buildConfigurations.development.outputHashing, 'all');
  assert.equal(buildConfigurations.production.outputHashing, 'all');

  const nginx = await readFile('frontend/nginx.conf', 'utf8');
  const noStore = 'Cache-Control "no-store, no-cache, must-revalidate, max-age=0"';
  assert.match(nginx, new RegExp(noStore.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(nginx, /location ~\* "\/\[\^\/\]\+-\[a-z0-9\]\{8,\}\\\.\(\?:js\|mjs\)\$"/);
  assert.match(nginx, /Cache-Control "public, max-age=31536000, immutable"/);
  assert.doesNotMatch(nginx, /location ~\* "\/\[\^\/\]\+-\[a-z0-9\]\{8,\}[^\n]*(?:css|woff)/);

  const globalStyles = await readFile('frontend/src/styles.scss', 'utf8');
  assert.match(globalStyles, /--startflow-asset-revision:\s*["']2026-07-19-cache-recovery["']/);

  const proxy = await readFile('infra/deploy/nginx/frontend.conf.template', 'utf8');
  assert.doesNotMatch(proxy, /proxy_hide_header\s+Cache-Control|add_header\s+Cache-Control/);
});

test('CI prepares workspace-generated types before quality checks and e2e', async () => {
  const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
  const prepareCommand = packageJson.scripts?.['ci:prepare'];
  assert.match(prepareCommand, /@startflow\/contracts build/);
  assert.match(prepareCommand, /@startflow\/backend prisma:generate/);

  const workflow = await readFile('.github/workflows/ci.yml', 'utf8');
  const nodeJob = workflow.match(/^  node:\r?\n([\s\S]*?)(?=^  python:)/m)?.[0];
  const e2eJob = workflow.match(/^  e2e:\r?\n([\s\S]*?)(?=^  docker:)/m)?.[0];

  for (const job of [nodeJob, e2eJob]) {
    assert.ok(job);
    assert.ok(job.indexOf('pnpm ci:prepare') > job.indexOf('pnpm install --frozen-lockfile'));
  }
  assert.ok(nodeJob.indexOf('pnpm ci:prepare') < nodeJob.indexOf('pnpm lint'));
  assert.ok(e2eJob.indexOf('pnpm ci:prepare') < e2eJob.indexOf('playwright install'));
});

test('AI image keeps its builder on Bookworm and installs pinned uv binaries', async () => {
  const dockerfile = await readFile('ai-service/Dockerfile', 'utf8');

  assert.match(dockerfile, /^FROM python:3\.12\.11-slim-bookworm AS builder$/m);
  assert.match(dockerfile, /^COPY --from=ghcr\.io\/astral-sh\/uv:0\.11\.29 \/uv \/uvx \/bin\/$/m);
  assert.doesNotMatch(dockerfile, /^FROM ghcr\.io\/astral-sh\/uv:.*bookworm.*$/m);
});
