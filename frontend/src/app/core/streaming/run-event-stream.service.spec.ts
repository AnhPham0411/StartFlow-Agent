import { TestBed } from '@angular/core/testing';
import type { RunEvent } from '@startflow/contracts';
import { AuthStateService } from '../auth/auth-state.service';
import { APP_ENVIRONMENT } from '../config/app-environment.token';
import {
  RUN_STREAM_DELAY,
  RUN_STREAM_FETCH,
  RunStreamError,
  RunEventStreamService,
  abortableDelay,
  parseSseFrames,
  type RunStreamConnectionState,
} from './run-event-stream.service';

describe('parseSseFrames', () => {
  it('parses id, event and multiline data while preserving a partial frame', () => {
    const parsed = parseSseFrames(
      'id: 4\r\nevent: tool.completed\r\ndata: {"part":\r\ndata: true}\r\n\r\nid: 5\ndata: pending',
    );

    expect(parsed.frames).toEqual([{ id: '4', event: 'tool.completed', data: '{"part":\ntrue}' }]);
    expect(parsed.remainder).toBe('id: 5\ndata: pending');
  });

  it('ignores comments and frames without data', () => {
    expect(parseSseFrames(': heartbeat\n\nid: 2\n\n').frames).toEqual([]);
  });
});

describe('abortableDelay', () => {
  it('removes its abort listener after the timer settles', async () => {
    const controller = new AbortController();
    const removeListener = spyOn(controller.signal, 'removeEventListener').and.callThrough();

    await abortableDelay(0, controller.signal);

    expect(removeListener).toHaveBeenCalledWith('abort', jasmine.any(Function));
  });
});

describe('RunEventStreamService', () => {
  it('keeps connection callbacks isolated for concurrent run streams', async () => {
    const terminal = event(1, 'run.completed');
    const fetchSpy = jasmine
      .createSpy('fetch')
      .and.callFake(() => Promise.resolve(sseResponse([terminal], ['1'])));
    const firstStates: RunStreamConnectionState[] = [];
    const secondStates: RunStreamConnectionState[] = [];
    const service = createService(fetchSpy);

    await Promise.all([
      service.stream('run-1', {
        signal: new AbortController().signal,
        onEvent: () => undefined,
        onConnectionChange: (state) => firstStates.push(state),
      }),
      service.stream('run-2', {
        signal: new AbortController().signal,
        onEvent: () => undefined,
        onConnectionChange: (state) => secondStates.push(state),
      }),
    ]);

    expect(firstStates).toEqual(['connecting', 'live', 'closed']);
    expect(secondStates).toEqual(['connecting', 'live', 'closed']);
  });

  it('cancels only the aborted reader and ignores a frame resolved after abort', async () => {
    const abortedResponse = deferredSseResponse();
    const survivingResponse = deferredSseResponse();
    const fetchSpy = jasmine
      .createSpy('fetch')
      .and.callFake((input: RequestInfo | URL) =>
        Promise.resolve(
          String(input).includes('/run-aborted/')
            ? abortedResponse.response
            : survivingResponse.response,
        ),
      );
    const abortedController = new AbortController();
    const survivingController = new AbortController();
    const abortedStates: RunStreamConnectionState[] = [];
    const survivingStates: RunStreamConnectionState[] = [];
    const abortedEvents: RunEvent[] = [];
    const survivingEvents: RunEvent[] = [];
    const service = createService(fetchSpy);

    const abortedStream = service.stream('run-aborted', {
      signal: abortedController.signal,
      onEvent: (runEvent) => abortedEvents.push(runEvent),
      onConnectionChange: (state) => abortedStates.push(state),
    });
    const survivingStream = service.stream('run-surviving', {
      signal: survivingController.signal,
      onEvent: (runEvent) => survivingEvents.push(runEvent),
      onConnectionChange: (state) => survivingStates.push(state),
    });
    await Promise.all([abortedResponse.readStarted, survivingResponse.readStarted]);

    abortedController.abort();
    await Promise.resolve();

    expect(abortedResponse.cancel).toHaveBeenCalledTimes(1);
    expect(survivingResponse.cancel).not.toHaveBeenCalled();
    expect(survivingStates).toEqual(['connecting', 'live']);

    const lateEvent = event(1, 'run.completed');
    abortedResponse.resolveEvent(lateEvent, '1');
    await abortedStream;

    expect(abortedEvents).toEqual([]);
    expect(abortedStates).toEqual(['connecting', 'live', 'closed']);
    expect(abortedResponse.releaseLock).toHaveBeenCalledTimes(1);
    expect(survivingStates).toEqual(['connecting', 'live']);

    const survivingEvent = event(2, 'run.completed');
    survivingResponse.resolveEvent(survivingEvent, '2');
    await survivingStream;

    expect(survivingEvents).toEqual([survivingEvent]);
    expect(survivingStates).toEqual(['connecting', 'live', 'closed']);
    expect(survivingResponse.cancel).toHaveBeenCalledTimes(1);
    expect(survivingResponse.releaseLock).toHaveBeenCalledTimes(1);
  });

  it('sends bearer resume headers, deduplicates persisted events and closes on terminal event', async () => {
    const persisted = event(2, 'agent.completed');
    const terminal = event(3, 'run.completed');
    const fetchSpy = jasmine
      .createSpy('fetch')
      .and.resolveTo(sseResponse([persisted, terminal], ['2', '3']));
    const states: RunStreamConnectionState[] = [];
    const received: RunEvent[] = [];
    const service = createService(fetchSpy);

    await service.stream('run/with spaces', {
      signal: new AbortController().signal,
      persistedEvents: [persisted],
      onEvent: (runEvent) => received.push(runEvent),
      onConnectionChange: (state) => states.push(state),
    });

    const [url, init] = fetchSpy.calls.mostRecent().args as [string, RequestInit];
    expect(url).toBe('https://api.startflow.test/api/runs/run%2Fwith%20spaces/events');
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer ephemeral-token');
    expect(new Headers(init.headers).get('Last-Event-ID')).toBe('2');
    expect(received).toEqual([terminal]);
    expect(states).toEqual(['connecting', 'live', 'closed']);
  });

  it('reconnects after a transport failure without clearing received events', async () => {
    const terminal = event(1, 'run.failed');
    let attempt = 0;
    const fetchSpy = jasmine.createSpy('fetch').and.callFake(() => {
      attempt += 1;
      return attempt === 1
        ? Promise.reject(new Error('network down'))
        : Promise.resolve(sseResponse([terminal], ['1']));
    });
    const delaySpy = jasmine.createSpy('delay').and.resolveTo();
    const states: RunStreamConnectionState[] = [];
    const errors: RunStreamError[] = [];
    const received: RunEvent[] = [];
    const service = createService(fetchSpy, delaySpy);

    await service.stream('run-1', {
      signal: new AbortController().signal,
      onEvent: (runEvent) => received.push(runEvent),
      onConnectionChange: (state) => states.push(state),
      onError: (error) => errors.push(error),
    });

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(delaySpy).toHaveBeenCalledTimes(1);
    expect(received).toEqual([terminal]);
    expect(states).toEqual(['connecting', 'reconnecting', 'live', 'closed']);
    expect(errors.length).toBe(1);
    expect(errors.at(0)?.kind).toBe('transport');
    expect(errors.at(0)?.retryable).toBeTrue();
  });

  it('closes with a fatal auth error when token acquisition fails', async () => {
    const tokenError = new Error('session expired');
    const fetchSpy = jasmine.createSpy('fetch');
    const delaySpy = jasmine.createSpy('delay').and.resolveTo();
    const errors: RunStreamError[] = [];
    const states: RunStreamConnectionState[] = [];
    const service = createService(fetchSpy, delaySpy, {
      getAccessToken: () => Promise.reject(tokenError),
    });

    await expectAsync(
      service.stream('run-1', {
        signal: new AbortController().signal,
        onEvent: () => undefined,
        onError: (error) => errors.push(error),
        onConnectionChange: (state) => states.push(state),
      }),
    ).toBeRejectedWithError(RunStreamError, 'Không thể xác thực luồng sự kiện.');

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(delaySpy).not.toHaveBeenCalled();
    expect(errors.length).toBe(1);
    expect(errors.at(0)?.kind).toBe('auth');
    expect(errors.at(0)?.retryable).toBeFalse();
    expect(errors.at(0)?.cause).toBe(tokenError);
    expect(states).toEqual(['connecting', 'closed']);
  });

  it('treats HTTP 401 and 403 as fatal auth failures without reconnecting', async () => {
    for (const status of [401, 403]) {
      const fetchSpy = jasmine
        .createSpy(`fetch-${status}`)
        .and.resolveTo(new Response(null, { status }));
      const delaySpy = jasmine.createSpy(`delay-${status}`).and.resolveTo();
      const errors: RunStreamError[] = [];
      const service = createService(fetchSpy, delaySpy);

      await expectAsync(
        service.stream(`run-${status}`, {
          signal: new AbortController().signal,
          onEvent: () => undefined,
          onError: (error) => errors.push(error),
        }),
      ).toBeRejectedWithError(RunStreamError);

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(delaySpy).not.toHaveBeenCalled();
      expect(errors.length).toBe(1);
      expect(errors.at(0)?.kind).toBe('auth');
      expect(errors.at(0)?.status).toBe(status);
      expect(errors.at(0)?.retryable).toBeFalse();
    }
  });

  it('uses bounded exponential backoff for 5xx failures and preserves Last-Event-ID', async () => {
    const terminal = event(8, 'run.completed');
    let attempt = 0;
    const fetchSpy = jasmine.createSpy('fetch').and.callFake(() => {
      attempt += 1;
      return Promise.resolve(
        attempt <= 5 ? new Response(null, { status: 500 }) : sseResponse([terminal], ['8']),
      );
    });
    const delays: number[] = [];
    const errors: RunStreamError[] = [];
    const service = createService(fetchSpy, (milliseconds) => {
      delays.push(milliseconds);
      return Promise.resolve();
    });

    await service.stream('run-1', {
      signal: new AbortController().signal,
      persistedEvents: [event(7, 'agent.completed')],
      onEvent: () => undefined,
      onError: (error) => errors.push(error),
    });

    expect(delays).toEqual([1200, 2400, 4800, 9600, 9600]);
    expect(errors.every((error) => error.kind === 'http' && error.retryable)).toBeTrue();
    expect(
      fetchSpy.calls
        .allArgs()
        .map(([, init]) => new Headers((init as RequestInit).headers).get('Last-Event-ID')),
    ).toEqual(['7', '7', '7', '7', '7', '7']);
  });

  it('keeps exponential backoff when a successful response closes before any event', async () => {
    const terminal = event(1, 'run.completed');
    let attempt = 0;
    const fetchSpy = jasmine.createSpy('fetch').and.callFake(() => {
      attempt += 1;
      return Promise.resolve(
        attempt <= 3
          ? new Response('', {
              status: 200,
              headers: { 'Content-Type': 'text/event-stream' },
            })
          : sseResponse([terminal], ['1']),
      );
    });
    const delays: number[] = [];
    const service = createService(fetchSpy, (milliseconds) => {
      delays.push(milliseconds);
      return Promise.resolve();
    });

    await service.stream('run-1', {
      signal: new AbortController().signal,
      onEvent: () => undefined,
    });

    expect(delays).toEqual([1200, 2400, 4800]);
  });

  it('does not open a connection after it has been aborted', async () => {
    const fetchSpy = jasmine.createSpy('fetch');
    const controller = new AbortController();
    controller.abort();
    const service = createService(fetchSpy);

    await service.stream('run-1', {
      signal: controller.signal,
      onEvent: () => fail('No event should be emitted'),
    });

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

function createService(
  fetchStream: jasmine.Spy,
  delay: (milliseconds: number, signal: AbortSignal) => Promise<void> = () => Promise.resolve(),
  authState: { getAccessToken: () => Promise<string> } = {
    getAccessToken: () => Promise.resolve('ephemeral-token'),
  },
) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      RunEventStreamService,
      {
        provide: APP_ENVIRONMENT,
        useValue: {
          production: true,
          apiUrl: 'https://api.startflow.test/api',
          authMode: 'keycloak',
          keycloakUrl: 'https://identity.startflow.test',
          keycloakRealm: 'startflow',
          keycloakClientId: 'startflow-web',
        },
      },
      {
        provide: AuthStateService,
        useValue: authState,
      },
      { provide: RUN_STREAM_FETCH, useValue: fetchStream },
      { provide: RUN_STREAM_DELAY, useValue: delay },
    ],
  });
  return TestBed.inject(RunEventStreamService);
}

function event(sequence: number, type: RunEvent['type']): RunEvent {
  return {
    id: `00000000-0000-4000-8000-${sequence.toString().padStart(12, '0')}`,
    runId: '10000000-0000-4000-8000-000000000000',
    sequence,
    type,
    agent: null,
    occurredAt: '2026-07-18T00:00:00.000Z',
    correlationId: '20000000-0000-4000-8000-000000000000',
    idempotencyKey: `event-${sequence.toString().padStart(3, '0')}`,
    payload: {},
  };
}

function sseResponse(events: RunEvent[], ids: string[]): Response {
  const body = events
    .map(
      (runEvent, index) =>
        `id: ${ids[index]}\nevent: ${runEvent.type}\ndata: ${JSON.stringify(runEvent)}\n\n`,
    )
    .join('');
  return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}

function deferredSseResponse(): {
  response: Response;
  readStarted: Promise<void>;
  resolveEvent: (runEvent: RunEvent, id: string) => void;
  cancel: jasmine.Spy<() => Promise<void>>;
  releaseLock: jasmine.Spy<() => void>;
} {
  let markReadStarted!: () => void;
  let resolveRead!: (result: ReadableStreamReadResult<Uint8Array>) => void;
  const readStarted = new Promise<void>((resolve) => {
    markReadStarted = resolve;
  });
  const readResult = new Promise<ReadableStreamReadResult<Uint8Array>>((resolve) => {
    resolveRead = resolve;
  });
  const cancel = jasmine.createSpy('cancel').and.resolveTo();
  const releaseLock = jasmine.createSpy('releaseLock');
  const reader = {
    read: jasmine.createSpy('read').and.callFake(() => {
      markReadStarted();
      return readResult;
    }),
    cancel,
    releaseLock,
  };
  const response = {
    status: 200,
    ok: true,
    body: { getReader: () => reader },
  } as unknown as Response;

  return {
    response,
    readStarted,
    resolveEvent: (runEvent, id) => {
      resolveRead({
        done: false,
        value: new TextEncoder().encode(
          `id: ${id}\nevent: ${runEvent.type}\ndata: ${JSON.stringify(runEvent)}\n\n`,
        ),
      });
    },
    cancel,
    releaseLock,
  };
}
