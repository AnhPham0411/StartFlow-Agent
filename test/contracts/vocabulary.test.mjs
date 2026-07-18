import assert from 'node:assert/strict';
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

test('compose never provisions the existing PostgreSQL or Keycloak services', async () => {
  const compose = await readFile('docker-compose.yml', 'utf8');
  assert.doesNotMatch(compose, /^\s{2}(postgres|postgresql|keycloak):/m);
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

test('frontend container never receives private runtime env', async () => {
  const compose = await readFile('docker-compose.yml', 'utf8');
  const frontend = compose.match(/^  frontend:\n([\s\S]*?)(?=^  backend-migrate:)/m)?.[0];
  assert.ok(frontend);
  assert.doesNotMatch(frontend, /env_file:/);
});

test('CI prepares workspace-generated types before quality checks and e2e', async () => {
  const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
  const prepareCommand = packageJson.scripts?.['ci:prepare'];
  assert.match(prepareCommand, /@startflow\/contracts build/);
  assert.match(prepareCommand, /@startflow\/backend prisma:generate/);

  const workflow = await readFile('.github/workflows/ci.yml', 'utf8');
  const nodeJob = workflow.match(/^  node:\n([\s\S]*?)(?=^  python:)/m)?.[0];
  const e2eJob = workflow.match(/^  e2e:\n([\s\S]*?)(?=^  docker:)/m)?.[0];

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
