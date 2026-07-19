import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { demoDatabaseSummary } from '@/src/lib/demo-database';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function countJson(directory: string) {
  try {
    return (await readdir(directory)).filter((name) => name.endsWith('.json')).length;
  } catch {
    return 0;
  }
}

async function latestHeartbeat(directory: string): Promise<Record<string, unknown> | null> {
  try {
    const files = (await readdir(directory)).filter((name) => name.endsWith('.json'));
    const candidates = await Promise.all(
      files.map(async (name) => ({
        name,
        modified: (await stat(path.join(directory, name))).mtimeMs,
      })),
    );
    const latest = candidates.sort((left, right) => right.modified - left.modified)[0];
    if (!latest) return null;
    const value = JSON.parse(await readFile(path.join(directory, latest.name), 'utf8')) as unknown;
    return typeof value === 'object' && value !== null
      ? { ...(value as Record<string, unknown>), observedAt: new Date(latest.modified).toISOString() }
      : null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const demoMode =
    process.env.NEXT_PUBLIC_AUTH_MODE === 'demo' &&
    process.env.NEXT_PUBLIC_DEMO_PUBLIC_WARNING === 'true';
  const authorization = request.headers.get('authorization');
  if (
    (demoMode && authorization !== 'Bearer demo-manager-token') ||
    (!demoMode && !authorization?.startsWith('Bearer '))
  ) {
    return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 });
  }
  const spool = process.env.STARTFLOW_HPC_SPOOL_DIR?.trim();
  const heartbeat = spool ? await latestHeartbeat(path.join(spool, 'heartbeat')) : null;
  const observedAt = typeof heartbeat?.observedAt === 'string' ? Date.parse(heartbeat.observedAt) : 0;
  const online = observedAt > 0 && Date.now() - observedAt < 90_000;
  const models = Array.isArray(heartbeat?.models)
    ? heartbeat.models.filter((item) => typeof item === 'object' && item !== null).slice(0, 40)
    : [];
  return NextResponse.json(
    {
      runtime: {
        online,
        mode: typeof heartbeat?.runtimeMode === 'string' ? heartbeat.runtimeMode : 'not-connected',
        model: typeof heartbeat?.model === 'string' ? heartbeat.model : 'GPU VLM pending',
        slurmJobId: typeof heartbeat?.slurmJobId === 'string' ? heartbeat.slurmJobId : null,
        observedAt: heartbeat?.observedAt ?? null,
        models,
      },
      queue: {
        pending: spool ? await countJson(path.join(spool, 'inbox')) : 0,
        running: spool ? await countJson(path.join(spool, 'processing')) : 0,
        completed: spool ? await countJson(path.join(spool, 'completed')) : 0,
        approvals: spool ? await countJson(path.join(spool, 'approval')) : 0,
        failed: spool ? await countJson(path.join(spool, 'dead-letter')) : 0,
      },
      demoDatabase: demoDatabaseSummary(),
      observedAt: new Date().toISOString(),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
