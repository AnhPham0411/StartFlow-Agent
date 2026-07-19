import { computed, inject, Injectable, signal, type OnDestroy } from '@angular/core';
import type { AgentResult, RunEvent } from '@startflow/contracts';
import type { RunDetail } from '../../core/api/models';
import { StartFlowApiService } from '../../core/api/startflow-api.service';
import {
  RunEventStreamService,
  RunStreamError,
  type RunStreamConnectionState,
} from '../../core/streaming/run-event-stream.service';

const TERMINAL_STATUSES = new Set<RunDetail['status']>(['COMPLETED', 'PARTIAL', 'FAILED']);
const SNAPSHOT_RELOAD_EVENTS = new Set<RunEvent['type']>([
  'approval.required',
  'run.completed',
  'run.failed',
]);

@Injectable()
export class RunFacade implements OnDestroy {
  readonly #api = inject(StartFlowApiService);
  readonly #eventStream = inject(RunEventStreamService);
  readonly #run = signal<RunDetail | null>(null);
  readonly #events = signal<RunEvent[]>([]);
  readonly #loading = signal(false);
  readonly #error = signal<string | null>(null);
  readonly #connection = signal<RunStreamConnectionState>('closed');
  readonly #streamError = signal<RunStreamError | null>(null);

  #runId: string | null = null;
  #streamController: AbortController | null = null;
  #loadGeneration = 0;
  #destroyed = false;

  readonly run = this.#run.asReadonly();
  readonly events = this.#events.asReadonly();
  readonly loading = this.#loading.asReadonly();
  readonly error = this.#error.asReadonly();
  readonly connection = this.#connection.asReadonly();
  readonly streamError = this.#streamError.asReadonly();
  readonly fatalStreamError = computed(() => {
    const error = this.#streamError();
    return error && !error.retryable ? error : null;
  });
  readonly failedAgents = computed<AgentResult['agent'][]>(() => {
    const run = this.#run();
    return run
      ? run.agentResults
          .filter((result) => result.status === 'FAILED')
          .map((result) => result.agent)
      : [];
  });
  readonly isPartial = computed(
    () => this.#run()?.status === 'PARTIAL' || this.failedAgents().length > 0,
  );
  readonly isTerminal = computed(() => {
    const status = this.#run()?.status;
    return status ? TERMINAL_STATUSES.has(status) : false;
  });

  /** Loads the persisted snapshot, then opens one stream owned by this facade instance. */
  async load(runId: string): Promise<void> {
    const generation = ++this.#loadGeneration;
    this.#abortStream();
    this.#runId = runId;
    this.#run.set(null);
    this.#events.set([]);
    this.#error.set(null);
    this.#streamError.set(null);
    this.#loading.set(true);

    try {
      const snapshot = await this.#api.getRun(runId);
      if (this.#destroyed || generation !== this.#loadGeneration) return;
      this.applySnapshot(snapshot);
      if (!this.isTerminal()) this.#openStream(runId);
    } catch (error) {
      if (this.#destroyed || generation !== this.#loadGeneration) return;
      this.#error.set(
        error instanceof Error ? error.message : 'Không tải được lượt đánh giá. Vui lòng thử lại.',
      );
    } finally {
      if (!this.#destroyed && generation === this.#loadGeneration) this.#loading.set(false);
    }
  }

  /** Refreshes REST state without discarding persisted or already-received live events. */
  async reload(): Promise<void> {
    if (!this.#runId || this.#destroyed) return;
    try {
      const snapshot = await this.#api.getRun(this.#runId);
      if (this.#destroyed) return;
      this.applySnapshot(snapshot);
      this.#error.set(null);
    } catch (error) {
      if (this.#destroyed) return;
      this.#error.set(
        error instanceof Error
          ? error.message
          : 'Không thể đồng bộ dữ liệu mới nhất. Vui lòng thử lại.',
      );
    }
  }

  /** Accepts a fresh mutation snapshot, such as the result of an approval. */
  applySnapshot(snapshot: RunDetail): void {
    const current = this.#run();
    if (current?.id === snapshot.id && snapshot.version < current.version) {
      this.#mergeEvents(snapshot.events);
      return;
    }
    this.#run.set(snapshot);
    this.#mergeEvents(snapshot.events);
    if (TERMINAL_STATUSES.has(snapshot.status)) this.#abortStream();
  }

  ngOnDestroy(): void {
    if (this.#destroyed) return;
    this.#destroyed = true;
    this.#loadGeneration += 1;
    this.#abortStream();
  }

  #openStream(runId: string): void {
    const controller = new AbortController();
    this.#streamController = controller;
    const persistedEvents = this.#events();

    void this.#eventStream
      .stream(runId, {
        signal: controller.signal,
        persistedEvents,
        onConnectionChange: (state) => {
          if (controller.signal.aborted || this.#destroyed) return;
          this.#connection.set(state);
          if (state === 'live' && this.#streamError()?.retryable) this.#streamError.set(null);
        },
        onError: (error) => {
          if (!controller.signal.aborted && !this.#destroyed) this.#streamError.set(error);
        },
        onEvent: (event) => {
          if (controller.signal.aborted || this.#destroyed) return;
          this.#mergeEvents([event]);
          if (SNAPSHOT_RELOAD_EVENTS.has(event.type)) void this.reload();
        },
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || this.#destroyed) return;
        this.#streamError.set(
          error instanceof RunStreamError
            ? error
            : new RunStreamError(
                error instanceof Error ? error.message : 'Kết nối timeline thất bại.',
                'transport',
                false,
                undefined,
                { cause: error },
              ),
        );
      });
  }

  #mergeEvents(incoming: readonly RunEvent[]): void {
    const byId = new Set<string>();
    const bySequence = new Set<number>();
    const merged = [...this.#events(), ...incoming]
      .sort((left, right) => left.sequence - right.sequence)
      .filter((event) => {
        if (byId.has(event.id) || bySequence.has(event.sequence)) return false;
        byId.add(event.id);
        bySequence.add(event.sequence);
        return true;
      });
    this.#events.set(merged);
  }

  #abortStream(): void {
    this.#streamController?.abort();
    this.#streamController = null;
    this.#connection.set('closed');
  }
}
