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
