import { inject, Injectable, InjectionToken } from '@angular/core';
import { runEventSchema, type RunEvent } from '@startflow/contracts';
import { AuthStateService } from '../auth/auth-state.service';
import { APP_ENVIRONMENT } from '../config/app-environment.token';

export interface SseFrame {
  id?: string;
  event?: string;
  data: string;
}

export interface ParsedSseFrames {
  frames: SseFrame[];
  remainder: string;
}

export type RunStreamConnectionState = 'connecting' | 'live' | 'reconnecting' | 'closed';

export type RunStreamErrorKind = 'auth' | 'http' | 'transport';

export class RunStreamError extends Error {
  constructor(
    message: string,
    readonly kind: RunStreamErrorKind,
    readonly retryable: boolean,
    readonly status?: number,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'RunStreamError';
  }
}

export interface RunStreamOptions {
  signal: AbortSignal;
  persistedEvents?: readonly RunEvent[];
  lastEventId?: string;
  onEvent: (event: RunEvent) => void;
  onConnectionChange?: (state: RunStreamConnectionState) => void;
  onError?: (error: RunStreamError) => void;
}

export type RunStreamFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
export type RunStreamDelay = (milliseconds: number, signal: AbortSignal) => Promise<void>;

export const RUN_STREAM_FETCH = new InjectionToken<RunStreamFetch>('run-stream.fetch', {
  factory: () => globalThis.fetch.bind(globalThis),
});

export const RUN_STREAM_DELAY = new InjectionToken<RunStreamDelay>('run-stream.delay', {
  factory: () => abortableDelay,
});

const RETRY_BASE_DELAY_MS = 1200;
const RETRY_MAX_DELAY_MS = 9600;

export function parseSseFrames(source: string): ParsedSseFrames {
  const chunks = source.replace(/\r\n/g, '\n').split('\n\n');
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

@Injectable({ providedIn: 'root' })
export class RunEventStreamService {
  readonly #environment = inject(APP_ENVIRONMENT);
  readonly #authState = inject<AuthStateService>(AuthStateService);
  readonly #fetchStream = inject(RUN_STREAM_FETCH);
  readonly #delay = inject(RUN_STREAM_DELAY);

  async stream(runId: string, options: RunStreamOptions): Promise<void> {
    const seenIds = new Set(options.persistedEvents?.map((event) => event.id) ?? []);
    const seenSequences = new Set(options.persistedEvents?.map((event) => event.sequence) ?? []);
    let lastEventId = options.lastEventId ?? highestSequence(options.persistedEvents);
    let firstAttempt = true;
    let retryAttempt = 0;
    let connectionState: RunStreamConnectionState = 'closed';
    const changeState = (state: RunStreamConnectionState): void => {
      if (connectionState === state) return;
      connectionState = state;
      options.onConnectionChange?.(state);
    };

    try {
      while (!options.signal.aborted) {
        if (firstAttempt) changeState('connecting');
        firstAttempt = false;

        try {
          let token: string;
          try {
            token = await this.#authState.getAccessToken();
          } catch (cause) {
            throw new RunStreamError(
              'Không thể xác thực luồng sự kiện.',
              'auth',
              false,
              undefined,
              { cause },
            );
          }

          const response = await this.#fetchStream(
            `${this.#environment.apiUrl}/runs/${encodeURIComponent(runId)}/events`,
            {
              headers: {
                Accept: 'text/event-stream',
                Authorization: `Bearer ${token}`,
                ...(lastEventId ? { 'Last-Event-ID': lastEventId } : {}),
              },
              cache: 'no-store',
              signal: options.signal,
            },
          );
          if (response.status === 401 || response.status === 403) {
            throw new RunStreamError(
              'Phiên đăng nhập không có quyền truy cập luồng sự kiện.',
              'auth',
              false,
              response.status,
            );
          }
          if (!response.ok) {
            const retryable = response.status >= 500;
            throw new RunStreamError(
              `Máy chủ luồng sự kiện phản hồi lỗi (HTTP ${response.status}).`,
              'http',
              retryable,
              response.status,
            );
          }
          if (!response.body) {
            throw new RunStreamError(
              'Máy chủ không trả về luồng sự kiện.',
              'transport',
              true,
              response.status,
            );
          }

          changeState('live');
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          let terminal = false;
          let readerCancellation: Promise<void> | undefined;
          const cancelReader = (): void => {
            readerCancellation ??= reader.cancel().catch(() => undefined);
          };
          options.signal.addEventListener('abort', cancelReader, { once: true });
          if (options.signal.aborted) cancelReader();

          try {
            while (!options.signal.aborted) {
              const { value, done } = await reader.read();
              if (options.signal.aborted) break;
              if (done) break;
              buffer += decoder.decode(value, { stream: true });
              const parsed = parseSseFrames(buffer);
              buffer = parsed.remainder;
              for (const frame of parsed.frames) {
                const runEvent = parseRunEvent(frame.data);
                if (!runEvent) continue;

                // A 200 response is not stable until at least one valid event is observed.
                retryAttempt = 0;

                lastEventId = frame.id ?? String(runEvent.sequence);
                const duplicate = seenIds.has(runEvent.id) || seenSequences.has(runEvent.sequence);
                if (!duplicate) {
                  seenIds.add(runEvent.id);
                  seenSequences.add(runEvent.sequence);
                  options.onEvent(runEvent);
                }

                if (runEvent.type === 'run.completed' || runEvent.type === 'run.failed') {
                  terminal = true;
                  break;
                }
              }
              if (terminal) {
                cancelReader();
                await readerCancellation;
                break;
              }
            }
          } finally {
            options.signal.removeEventListener('abort', cancelReader);
            if (options.signal.aborted) cancelReader();
            await readerCancellation;
            try {
              reader.releaseLock();
            } catch {
              // The reader owns no reusable resource after cancellation.
            }
          }

          if (terminal || options.signal.aborted) break;
          throw new RunStreamError(
            'Kết nối luồng sự kiện đã đóng trước khi hoàn tất.',
            'transport',
            true,
          );
        } catch (error) {
          if (options.signal.aborted) break;
          const streamError = normalizeStreamError(error);
          options.onError?.(streamError);
          if (!streamError.retryable) throw streamError;

          retryAttempt += 1;
          changeState('reconnecting');
          await this.#delay(retryDelay(retryAttempt), options.signal);
        }
      }
    } finally {
      changeState('closed');
    }
  }
}

function normalizeStreamError(error: unknown): RunStreamError {
  if (error instanceof RunStreamError) return error;
  return new RunStreamError(
    error instanceof Error ? error.message : 'Kết nối luồng sự kiện thất bại.',
    'transport',
    true,
    undefined,
    { cause: error },
  );
}

function retryDelay(attempt: number): number {
  return Math.min(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1), RETRY_MAX_DELAY_MS);
}

function parseRunEvent(data: string): RunEvent | null {
  try {
    const parsed = runEventSchema.safeParse(JSON.parse(data) as unknown);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function highestSequence(events: readonly RunEvent[] | undefined): string | undefined {
  if (!events?.length) return undefined;
  return String(Math.max(...events.map((event) => event.sequence)));
}

export function abortableDelay(milliseconds: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    let settled = false;
    const finish = (): void => {
      if (settled) return;
      settled = true;
      globalThis.clearTimeout(timeout);
      signal.removeEventListener('abort', finish);
      resolve();
    };
    const timeout = globalThis.setTimeout(finish, milliseconds);
    signal.addEventListener('abort', finish, { once: true });
  });
}
