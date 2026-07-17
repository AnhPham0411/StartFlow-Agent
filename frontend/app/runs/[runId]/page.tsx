import { RunWorkspace } from '@/src/features/runs/run-workspace';

export default async function RunPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  return <RunWorkspace runId={runId} />;
}
