import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import {
  chmod,
  mkdir,
  readFile,
  readdir,
  rename,
  stat,
  unlink,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import type {
  AssistantAgentTask,
  AssistantEvidence,
  AssistantFileSummary,
  AssistantHistoryItem,
} from './assistant-types';

const MAX_ENVELOPE_AGE_SECONDS = 1_800;
const HEARTBEAT_MAX_AGE_MS = 90_000;

interface SpoolRequest {
  prompt: string;
  history: AssistantHistoryItem[];
  requestId: string;
  files: AssistantFileSummary[];
  sourceFiles: File[];
  tasks: AssistantAgentTask[];
  demoEvidence?: AssistantEvidence[];
  approval?: { decision: 'approve' | 'reject'; task: AssistantAgentTask };
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  }
  return value;
}

function canonicalJson(value: unknown) {
  return JSON.stringify(canonicalize(value));
}

function signEnvelope(payload: Record<string, unknown>, secret: Buffer) {
  const issued_at = Math.floor(Date.now() / 1_000);
  const nonce = randomUUID().replaceAll('-', '');
  const signed = canonicalJson({ issued_at, nonce, payload });
  return {
    issued_at,
    nonce,
    payload,
    signature: createHmac('sha256', secret).update(signed).digest('hex'),
  };
}

function verifyEnvelope(value: unknown, secret: Buffer) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const envelope = value as Record<string, unknown>;
  const { issued_at, nonce, payload, signature } = envelope;
  if (
    typeof issued_at !== 'number' ||
    !Number.isInteger(issued_at) ||
    typeof nonce !== 'string' ||
    nonce.length !== 32 ||
    typeof payload !== 'object' ||
    payload === null ||
    Array.isArray(payload) ||
    typeof signature !== 'string' ||
    !/^[a-f0-9]{64}$/.test(signature)
  ) return null;
  if (Math.abs(Date.now() / 1_000 - Number(issued_at)) > MAX_ENVELOPE_AGE_SECONDS) return null;
  const expected = createHmac('sha256', secret)
    .update(canonicalJson({ issued_at, nonce, payload }))
    .digest();
  const received = Buffer.from(signature, 'hex');
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null;
  return payload as Record<string, unknown>;
}

async function atomicJson(target: string, value: unknown) {
  const temporary = `${target}.${randomUUID()}.tmp`;
  await writeFile(temporary, canonicalJson(value), { encoding: 'utf8', mode: 0o600, flag: 'wx' });
  await rename(temporary, target);
}

async function loadSecret(secretFile: string) {
  const metadata = await stat(secretFile);
  if ((metadata.mode & 0o077) !== 0) throw new Error('HPC spool secret must be mode 0600');
  const secret = Buffer.from((await readFile(secretFile, 'utf8')).trim());
  if (secret.length < 32) throw new Error('HPC spool secret is too short');
  return secret;
}

async function workerOnline(spool: string) {
  try {
    const heartbeatDirectory = path.join(spool, 'heartbeat');
    const names = (await readdir(heartbeatDirectory)).filter((name) => name.endsWith('.json'));
    const modified = await Promise.all(
      names.map(async (name) => (await stat(path.join(heartbeatDirectory, name))).mtimeMs),
    );
    return modified.some((time) => Date.now() - time < HEARTBEAT_MAX_AGE_MS);
  } catch {
    return false;
  }
}

function safeAttachmentName(index: number, name: string) {
  const cleaned = path.basename(name).replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 160) || 'file';
  return `${String(index + 1).padStart(2, '0')}-${cleaned}`;
}

export async function callHpcSpool(request: SpoolRequest): Promise<unknown | null> {
  const spool = process.env.STARTFLOW_HPC_SPOOL_DIR?.trim();
  const secretFile = process.env.STARTFLOW_HPC_SECRET_FILE?.trim();
  if (!spool || !secretFile || !(await workerOnline(spool))) return null;

  const secret = await loadSecret(secretFile);
  for (const directory of ['inbox', 'outbox', 'attachments', 'completed']) {
    await mkdir(path.join(spool, directory), { recursive: true, mode: 0o700 });
  }
  const attachmentDirectory = path.join(spool, 'attachments', request.requestId);
  await mkdir(attachmentDirectory, { recursive: false, mode: 0o700 });
  const attachments: Array<AssistantFileSummary & { path: string }> = [];
  let enqueued = false;
  try {
    for (const [index, file] of request.sourceFiles.entries()) {
      const summary = request.files[index];
      if (!summary) throw new Error('Missing uploaded file metadata');
      const target = path.join(attachmentDirectory, safeAttachmentName(index, file.name));
      await writeFile(target, Buffer.from(await file.arrayBuffer()), { mode: 0o600, flag: 'wx' });
      await chmod(target, 0o600);
      attachments.push({ ...summary, path: target });
    }
    if (request.demoEvidence?.length) {
      const target = path.join(attachmentDirectory, '99-startflow-demo-banking-database.json');
      const content = Buffer.from(
        JSON.stringify(
          {
            synthetic: true,
            warning: 'Dữ liệu tổng hợp chỉ dùng demo, không phải dữ liệu khách hàng hoặc chính sách thật.',
            evidence: request.demoEvidence,
          },
          null,
          2,
        ),
        'utf8',
      );
      await writeFile(target, content, { mode: 0o600, flag: 'wx' });
      attachments.push({
        name: 'startflow-demo-banking-database.json',
        size: content.byteLength,
        type: 'application/json',
        readableText: true,
        path: target,
      });
    }

    const now = new Date();
    const task = {
      taskId: request.requestId,
      runId: request.requestId,
      workflowId: `assistant-${request.requestId}`,
      prompt: request.prompt,
      history: request.history,
      requestedAgents: request.tasks.map((task) => task.agentId),
      requestedTasks: request.tasks,
      files: attachments,
      demoDatabase: request.demoEvidence?.length ? { synthetic: true } : null,
      approval: request.approval ?? null,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + MAX_ENVELOPE_AGE_SECONDS * 1_000).toISOString(),
    };
    const inbox = path.join(spool, 'inbox', `${request.requestId}.json`);
    const outbox = path.join(spool, 'outbox', `${request.requestId}.json`);
    await atomicJson(inbox, signEnvelope(task, secret));
    enqueued = true;

    const timeoutMs = Math.min(
      Math.max(Number(process.env.STARTFLOW_HPC_TIMEOUT_MS ?? 90_000), 10_000),
      240_000,
    );
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      try {
        const value = JSON.parse(await readFile(outbox, 'utf8')) as unknown;
        const payload = verifyEnvelope(value, secret);
        if (payload) {
          await atomicJson(path.join(spool, 'completed', `${request.requestId}.json`), {
            requestId: request.requestId,
            mode: typeof payload.mode === 'string' ? payload.mode : 'local-vlm',
            completedAt: new Date().toISOString(),
          }).catch(() => undefined);
          await unlink(outbox).catch(() => undefined);
          return payload.response ?? payload;
        }
        return null;
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code !== 'ENOENT') return null;
      }
      await new Promise((resolve) => setTimeout(resolve, 750));
    }
    return null;
  } catch (error) {
    if (!enqueued) {
      const { rm } = await import('node:fs/promises');
      await rm(attachmentDirectory, { recursive: true, force: true }).catch(() => undefined);
    }
    throw error;
  }
}

function safeApprovalId(taskId: string) {
  return taskId.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 220);
}

export async function isPendingApproval(task: AssistantAgentTask) {
  const spool = process.env.STARTFLOW_HPC_SPOOL_DIR?.trim();
  if (!spool) return false;
  try {
    const value = JSON.parse(
      await readFile(path.join(spool, 'approval', `${safeApprovalId(task.id)}.json`), 'utf8'),
    ) as Record<string, unknown>;
    return (
      value.taskId === task.id &&
      value.agentId === task.agentId &&
      value.agentName === task.agentName &&
      value.domain === task.domain &&
      value.objective === task.objective
    );
  } catch {
    return false;
  }
}

export async function syncApprovalQueue(requestId: string, tasks: AssistantAgentTask[]) {
  const spool = process.env.STARTFLOW_HPC_SPOOL_DIR?.trim();
  if (!spool) return;
  const directory = path.join(spool, 'approval');
  await mkdir(directory, { recursive: true, mode: 0o700 });
  for (const task of tasks) {
    const target = path.join(directory, `${safeApprovalId(task.id)}.json`);
    if (task.status === 'awaiting_approval') {
      await atomicJson(target, {
        requestId,
        taskId: task.id,
        agentId: task.agentId,
        agentName: task.agentName,
        domain: task.domain,
        objective: task.objective,
        synthetic: true,
        createdAt: new Date().toISOString(),
      }).catch(async (error) => {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      });
    } else {
      await unlink(target).catch(() => undefined);
    }
  }
}
