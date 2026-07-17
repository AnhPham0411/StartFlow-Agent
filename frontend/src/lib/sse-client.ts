import { runEventSchema, type RunEvent } from '@startflow/contracts';
import { getApiBaseUrl } from './api-client';

interface SseFrame {
  id?: string;
  event?: string;
  data: string;
}

export function parseSseFrames(source: string): { frames: SseFrame[]; remainder: string } {
  const normalized = source.replace(/\r\n/g, '\n');
  const chunks = normalized.split('\n\n');
  const remainder = chunks.pop() ?? '';
  const frames = chunks.flatMap((chunk) => {
    let id: string | undefined;
    let event: string | undefined;
    const data: string[] = [];
    for (const line of chunk.split('\n')) {
      if (!line || line.startsWith(':')) continue;
      const separator = line.indexOf(':');
      const field = separator === -1 ? line : line.slice(0, separator);
      const value = separator === -1 ? '' : line.slice(separator + 1).replace(/^ /, '');
      if (field === 'id') id = value;
      if (field === 'event') event = value;
      if (field === 'data') data.push(value);
    }
    return data.length ? [{ id, event, data: data.join('\n') }] : [];
  });
  return { frames, remainder };
}

export interface RunStreamOptions {
  signal: AbortSignal;
  getAccessToken: () => Promise<string>;
  lastEventId?: string;
  onEvent: (event: RunEvent) => void;
  onConnectionChange?: (state: 'connecting' | 'live' | 'reconnecting' | 'closed') => void;
}

export async function streamRunEvents(runId: string, options: RunStreamOptions) {
  let lastEventId = options.lastEventId;
  let reconnecting = false;

  while (!options.signal.aborted) {
    options.onConnectionChange?.(reconnecting ? 'reconnecting' : 'connecting');
    try {
      const token = await options.getAccessToken();
      const response = await fetch(`${getApiBaseUrl()}/runs/${encodeURIComponent(runId)}/events`, {
        headers: {
          Accept: 'text/event-stream',
          Authorization: `Bearer ${token}`,
          ...(lastEventId ? { 'Last-Event-ID': lastEventId } : {}),
        },
        cache: 'no-store',
        signal: options.signal,
      });
      if (!response.ok || !response.body) throw new Error(`SSE_${response.status}`);
      options.onConnectionChange?.('live');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let terminal = false;

      while (!options.signal.aborted) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parsed = parseSseFrames(buffer);
        buffer = parsed.remainder;
        for (const frame of parsed.frames) {
          let candidate: unknown;
          try {
            candidate = JSON.parse(frame.data) as unknown;
          } catch {
            continue;
          }
          const event = runEventSchema.safeParse(candidate);
          if (!event.success) continue;
          lastEventId = frame.id ?? String(event.data.sequence);
          options.onEvent(event.data);
          if (event.data.type === 'run.completed' || event.data.type === 'run.failed')
            terminal = true;
        }
      }
      if (terminal) break;
    } catch {
      if (options.signal.aborted) break;
      reconnecting = true;
      await new Promise<void>((resolve) => {
        const timeout = window.setTimeout(resolve, 1200);
        options.signal.addEventListener(
          'abort',
          () => {
            window.clearTimeout(timeout);
            resolve();
          },
          { once: true },
        );
      });
    }
  }
  options.onConnectionChange?.('closed');
}
