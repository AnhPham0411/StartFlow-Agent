import { TestBed } from '@angular/core/testing';
import type { AgentResult, RunEvent } from '@startflow/contracts';
import type { RunDetail } from '../../core/api/models';
import { StartFlowApiService } from '../../core/api/startflow-api.service';
import {
  RunEventStreamService,
  RunStreamError,
  type RunStreamOptions,
} from '../../core/streaming/run-event-stream.service';
import { RunFacade } from './run.facade';

describe('RunFacade', () => {
  let api: jasmine.SpyObj<StartFlowApiService>;
  let streamService: jasmine.SpyObj<RunEventStreamService>;
  let streamOptions: RunStreamOptions;
  let streamDeferred: Deferred<void>;
  let facade: RunFacade;

  beforeEach(() => {
    api = jasmine.createSpyObj<StartFlowApiService>('StartFlowApiService', ['getRun']);
    streamService = jasmine.createSpyObj<RunEventStreamService>('RunEventStreamService', [
      'stream',
    ]);
    streamDeferred = deferred<void>();
    streamService.stream.and.callFake((_runId, options) => {
      streamOptions = options;
      return streamDeferred.promise;
    });
    TestBed.configureTestingModule({
      providers: [
        RunFacade,
        { provide: StartFlowApiService, useValue: api },
        { provide: RunEventStreamService, useValue: streamService },
      ],
    });
    facade = TestBed.inject(RunFacade);
  });

  afterEach(() => facade.ngOnDestroy());

  it('loads the initial REST snapshot before opening SSE with persisted events', async () => {
    const persisted = runEvent(1, 'run.started');
    const snapshot = runDetail({ events: [persisted], status: 'RUNNING' });
    api.getRun.and.resolveTo(snapshot);

    await facade.load(snapshot.id);

    expect(api.getRun).toHaveBeenCalledOnceWith(snapshot.id);
    expect(facade.run()).toBe(snapshot);
    expect(facade.events()).toEqual([persisted]);
    expect(facade.loading()).toBeFalse();
    expect(streamService.stream).toHaveBeenCalledOnceWith(
      snapshot.id,
      jasmine.objectContaining({ persistedEvents: [persisted] }),
    );
  });

  it('merges persisted and live events in sequence order without duplicate ids or sequences', async () => {
    const first = runEvent(1, 'run.started');
    const third = runEvent(3, 'agent.started');
    api.getRun.and.resolveTo(runDetail({ events: [third, first], status: 'RUNNING' }));
    await facade.load('run-1');

    streamOptions.onEvent({ ...first });
    streamOptions.onEvent(runEvent(2, 'plan.created'));
    streamOptions.onEvent({ ...runEvent(9, 'tool.completed'), sequence: 3 });

    expect(facade.events().map((event) => event.sequence)).toEqual([1, 2, 3]);
  });

  it('owns reconnect and typed fatal stream state without replacing persisted data', async () => {
    const persisted = runEvent(1, 'run.started');
    api.getRun.and.resolveTo(runDetail({ events: [persisted], status: 'RUNNING' }));
    await facade.load('run-1');

    const retryable = new RunStreamError('Mất kết nối tạm thời', 'transport', true);
    streamOptions.onConnectionChange?.('reconnecting');
    streamOptions.onError?.(retryable);

    expect(facade.connection()).toBe('reconnecting');
    expect(facade.streamError()).toBe(retryable);
    expect(facade.events()).toEqual([persisted]);

    const fatal = new RunStreamError('Phiên đăng nhập đã hết hạn', 'auth', false, 401);
    streamOptions.onError?.(fatal);
    streamDeferred.reject(fatal);
    await flushPromises();

    expect(facade.streamError()).toBe(fatal);
    expect(facade.fatalStreamError()).toBe(fatal);
    expect(facade.events()).toEqual([persisted]);
  });

  it('reloads the REST snapshot for approval-required and terminal events', async () => {
    const initial = runDetail({ status: 'RUNNING' });
    const awaitingApproval = runDetail({ status: 'AWAITING_APPROVAL', version: 2 });
    const completed = runDetail({ status: 'COMPLETED', version: 3 });
    api.getRun.and.returnValues(
      Promise.resolve(initial),
      Promise.resolve(awaitingApproval),
      Promise.resolve(completed),
    );
    await facade.load(initial.id);

    streamOptions.onEvent(runEvent(1, 'approval.required'));
    await flushPromises();
    expect(facade.run()).toBe(awaitingApproval);

    streamOptions.onEvent(runEvent(2, 'run.completed'));
    await flushPromises();
    expect(facade.run()).toBe(completed);
    expect(api.getRun).toHaveBeenCalledTimes(3);
  });

  it('does not let a stale reload overwrite a newer versioned snapshot', async () => {
    const staleReload = deferred<RunDetail>();
    const freshReload = deferred<RunDetail>();
    api.getRun.and.returnValues(
      Promise.resolve(runDetail({ version: 1 })),
      staleReload.promise,
      freshReload.promise,
    );
    await facade.load('run-1');

    const stalePromise = facade.reload();
    const freshPromise = facade.reload();
    freshReload.resolve(runDetail({ status: 'AWAITING_APPROVAL', version: 3 }));
    await freshPromise;
    staleReload.resolve(runDetail({ status: 'RUNNING', version: 2 }));
    await stalePromise;

    expect(facade.run()?.version).toBe(3);
    expect(facade.run()?.status).toBe('AWAITING_APPROVAL');
  });

  it('derives partial impact from run status or a failed specialist result', async () => {
    api.getRun.and.resolveTo(
      runDetail({
        agentResults: [agentResult('CREDIT', 'FAILED')],
        status: 'RUNNING',
      }),
    );

    await facade.load('run-1');

    expect(facade.isPartial()).toBeTrue();
    expect(facade.failedAgents()).toEqual(['CREDIT']);
  });

  it('aborts its active per-instance stream during cleanup', async () => {
    api.getRun.and.resolveTo(runDetail({ status: 'RUNNING' }));
    await facade.load('run-1');

    const signal = streamOptions.signal;
    expect(signal.aborted).toBeFalse();

    facade.ngOnDestroy();

    expect(signal.aborted).toBeTrue();
    expect(facade.connection()).toBe('closed');
  });
});

function runDetail(overrides: Partial<RunDetail> = {}): RunDetail {
  return {
    id: '10000000-0000-4000-8000-000000000000',
    caseId: '20000000-0000-4000-8000-000000000000',
    status: 'RUNNING',
    createdAt: '2026-07-18T00:00:00.000Z',
    completedAt: null,
    finalDecisionStatus: null,
    version: 1,
    plan: [],
    agentResults: [],
    finalDecision: null,
    events: [],
    approval: null,
    actionTicket: null,
    ...overrides,
  };
}

function runEvent(sequence: number, type: RunEvent['type']): RunEvent {
  return {
    id: `00000000-0000-4000-8000-${sequence.toString().padStart(12, '0')}`,
    runId: '10000000-0000-4000-8000-000000000000',
    sequence,
    type,
    agent: null,
    occurredAt: '2026-07-18T00:00:00.000Z',
    correlationId: '30000000-0000-4000-8000-000000000000',
    idempotencyKey: `event-${sequence.toString().padStart(3, '0')}`,
    payload: {},
  };
}

function agentResult(agent: AgentResult['agent'], status: AgentResult['status']): AgentResult {
  return {
    agent,
    status,
    summary: 'Không thể hoàn tất phân tích',
    confidence: 0.25,
    findings: [],
    toolNames: [],
    errorCode: status === 'FAILED' ? 'TOOL_FAILED' : null,
  };
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
}

async function flushPromises(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}
