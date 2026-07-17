'use client';

import {
  citationSchema,
  toolEventDataSchema,
  type AgentResult,
  type ApprovalRequest,
  type RunEvent,
} from '@startflow/contracts';
import {
  AlertTriangle,
  Check,
  Clock3,
  Radio,
  RotateCcw,
  ShieldCheck,
  Wrench,
  X,
} from 'lucide-react';
import type { z } from 'zod';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/src/auth/auth-context';
import { RoleGate } from '@/src/auth/role-gate';
import { Badge } from '@/src/components/ui/badge';
import { Button } from '@/src/components/ui/button';
import { ErrorState } from '@/src/components/ui/error-state';
import { LoadingState } from '@/src/components/ui/loading-state';
import { PageHeader } from '@/src/components/ui/page-header';
import { Panel, PanelBody, PanelHeader } from '@/src/components/ui/panel';
import { StatusBadge } from '@/src/components/ui/status-badge';
import { ApiError } from '@/src/lib/api-client';
import { formatCurrency, formatDateTime, formatPercent } from '@/src/lib/format';
import type { RunDetail } from '@/src/lib/models';
import { streamRunEvents, type RunStreamOptions } from '@/src/lib/sse-client';
import { useStartFlowApi } from '@/src/lib/use-api';

type ConnectionState = Parameters<NonNullable<RunStreamOptions['onConnectionChange']>>[0];
type Citation = z.infer<typeof citationSchema>;

const agentLabels: Record<string, string> = {
  CREDIT: 'Credit',
  COMPLIANCE: 'Compliance',
  OPERATIONS: 'Operations',
};
const eventLabels: Record<string, string> = {
  'run.started': 'Lượt đánh giá bắt đầu',
  'plan.created': 'Planner đã tạo kế hoạch',
  'agent.started': 'Chuyên gia bắt đầu xử lý',
  'tool.completed': 'Công cụ đã hoàn tất',
  'citation.added': 'Đã thêm căn cứ',
  'agent.completed': 'Chuyên gia đã hoàn tất',
  'synthesis.completed': 'Đã tổng hợp kết quả',
  'approval.required': 'Cần phê duyệt của con người',
  'run.completed': 'Lượt đánh giá hoàn tất',
  'run.failed': 'Lượt đánh giá gặp lỗi',
};

export function RunWorkspace({ runId }: { runId: string }) {
  const api = useStartFlowApi();
  const { getAccessToken } = useAuth();
  const [run, setRun] = useState<RunDetail | null>(null);
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connection, setConnection] = useState<ConnectionState>('closed');
  const streamStatus = run?.status;
  const streamLastSequence = run?.events?.at(-1)?.sequence;
  const load = useCallback(async () => {
    await Promise.resolve();
    setError(null);
    try {
      const result = await api.getRun(runId);
      setRun(result);
      setEvents((result.events ?? []).slice().sort((a, b) => a.sequence - b.sequence));
    } catch {
      setError('Không tải được lượt đánh giá. Dữ liệu đã lưu không bị mất; hãy thử kết nối lại.');
    } finally {
      setLoading(false);
    }
  }, [api, runId]);
  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  useEffect(() => {
    if (!streamStatus || ['COMPLETED', 'PARTIAL', 'FAILED'].includes(streamStatus)) return;
    const controller = new AbortController();
    void streamRunEvents(runId, {
      signal: controller.signal,
      getAccessToken,
      lastEventId: streamLastSequence ? String(streamLastSequence) : undefined,
      onConnectionChange: setConnection,
      onEvent: (event) => {
        setEvents((current) =>
          current.some((item) => item.id === event.id || item.sequence === event.sequence)
            ? current
            : [...current, event].sort((a, b) => a.sequence - b.sequence),
        );
        if (
          event.type === 'run.completed' ||
          event.type === 'run.failed' ||
          event.type === 'approval.required'
        )
          void load();
      },
    });
    return () => controller.abort();
  }, [streamStatus, streamLastSequence, runId, getAccessToken, load]);

  if (loading) return <LoadingState label="Đang dựng timeline từ dữ liệu đã lưu…" />;
  if (error && !run)
    return (
      <ErrorState
        message={error}
        onRetry={() => {
          setLoading(true);
          void load();
        }}
      />
    );
  if (!run) return null;

  const plan = run.plan ?? [];
  const results = run.agentResults ?? [];
  const partial = run.status === 'PARTIAL' || results.some((result) => result.status === 'FAILED');
  return (
    <>
      <PageHeader
        eyebrow={`RUN #${run.id.slice(0, 8)} · ${run.status}`}
        title={run.caseSnapshot?.companyName ?? 'Lượt đánh giá đa tác nhân'}
        description={
          run.caseSnapshot
            ? `${formatCurrency(run.caseSnapshot.requestedAmount)} · ${run.caseSnapshot.purpose}`
            : `Hồ sơ ${run.caseId}`
        }
        actions={<StatusBadge status={run.status} />}
      />
      {error ? (
        <div className="banner banner--danger" role="alert">
          <AlertTriangle aria-hidden="true" />
          <p>{error}</p>
          <Button variant="ghost" onClick={() => void load()}>
            <RotateCcw aria-hidden="true" /> Thử lại
          </Button>
        </div>
      ) : null}
      {partial ? (
        <div className="banner banner--warning">
          <AlertTriangle aria-hidden="true" />
          <p>
            <strong>Kết quả chưa đầy đủ — một chuyên gia gặp lỗi.</strong> Confidence đã được hạ và
            lane gặp lỗi vẫn được giữ để kiểm tra.
          </p>
        </div>
      ) : null}
      <ConnectionBanner
        state={connection}
        terminal={['COMPLETED', 'PARTIAL', 'FAILED'].includes(run.status)}
      />
      <PlannerStrip tasks={plan} />
      <div className="decision-rail-layout">
        <section className="agent-lanes" aria-label="Ba luồng chuyên gia">
          {(['CREDIT', 'COMPLIANCE', 'OPERATIONS'] as const).map((agent) => (
            <AgentLane
              key={agent}
              result={results.find((item) => item.agent === agent)}
              agent={agent}
              events={events}
            />
          ))}
        </section>
        <DecisionGate
          run={run}
          onUpdated={(updated) => {
            setRun(updated);
            setEvents(updated.events ?? events);
          }}
        />
      </div>
      <div className="run-lower-grid">
        <Timeline events={events} />
        <EvidencePanel results={results} events={events} />
      </div>
    </>
  );
}

function ConnectionBanner({ state, terminal }: { state: ConnectionState; terminal: boolean }) {
  if (terminal || state === 'closed') return null;
  if (state === 'reconnecting')
    return (
      <div className="banner banner--warning" role="status">
        <RotateCcw aria-hidden="true" />
        <p>Đang nối lại timeline từ sự kiện gần nhất. Các sự kiện đã lưu không bị mất.</p>
      </div>
    );
  return (
    <div
      className={`banner ${state === 'live' ? 'banner--success' : 'banner--info'}`}
      role="status"
    >
      <Radio aria-hidden="true" />
      <p>{state === 'live' ? 'Timeline trực tiếp đang hoạt động.' : 'Đang mở kênh timeline…'}</p>
    </div>
  );
}

function PlannerStrip({ tasks }: { tasks: RunDetail['plan'] }) {
  return (
    <Panel className="plan-strip">
      <p className="eyebrow">Planner · execution map</p>
      <h2>Kế hoạch của Planner</h2>
      {tasks.length ? (
        <div className="plan-tasks">
          {tasks.map((task, index) => (
            <article className="plan-task" key={task.id}>
              <span className="utility muted">
                0{index + 1} · {task.agent}
              </span>
              <h3>{task.title}</h3>
              <p className="subtle">{task.objective}</p>
              <StatusBadge status={task.status} />
            </article>
          ))}
        </div>
      ) : (
        <p className="muted">Planner đang chuẩn bị ba nhiệm vụ chuyên gia…</p>
      )}
    </Panel>
  );
}

function AgentLane({
  agent,
  result,
  events,
}: {
  agent: 'CREDIT' | 'COMPLIANCE' | 'OPERATIONS';
  result?: AgentResult;
  events: RunEvent[];
}) {
  const active =
    events.some((event) => event.agent === agent && event.type === 'agent.started') && !result;
  const status = result?.status ?? (active ? 'RUNNING' : 'PENDING');
  const agentEvents = events.filter((event) => event.agent === agent);
  return (
    <article className={`panel agent-card${status === 'FAILED' ? ' agent-card--failed' : ''}`}>
      <span
        className={`agent-card__pulse${active ? ' agent-card__pulse--running' : ''}`}
        aria-hidden="true"
      />
      <div className="panel__body">
        <p className="eyebrow">
          {agentLabels[agent]} · {agentEvents.length} events
        </p>
        <StatusBadge status={status} />
        <h2 style={{ marginTop: 16 }}>
          {result?.summary ?? (active ? 'Đang phân tích hồ sơ…' : 'Đang chờ Planner')}
        </h2>
        {result ? (
          <>
            <p className="utility muted">CONFIDENCE · {formatPercent(result.confidence)}</p>
            {result.findings.length ? (
              <ul className="finding-list">
                {result.findings.slice(0, 3).map((finding) => (
                  <li key={finding.code}>
                    <strong>{finding.title}</strong>
                    <br />
                    <span className="subtle">{finding.detail}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">Không có finding cần lưu ý.</p>
            )}
            <p className="subtle">
              <Wrench aria-hidden="true" style={{ width: 15 }} /> Công cụ đã dùng:{' '}
              {result.toolNames.join(', ') || '—'}
            </p>
          </>
        ) : null}
      </div>
    </article>
  );
}

function DecisionGate({ run, onUpdated }: { run: RunDetail; onUpdated: (run: RunDetail) => void }) {
  const decision = run.finalDecision;
  return (
    <aside className="panel decision-gate">
      <div className="panel__body">
        <div className="decision-diamond" aria-hidden="true" />
        <p className="eyebrow">Decision gate</p>
        {decision ? (
          <>
            <StatusBadge status={decision.status} />
            <h2 style={{ marginTop: 14 }}>{decision.summary}</h2>
            <div className="decision-confidence">
              <div className="inline-meta">
                <span>Độ tin cậy</span>
                <strong>{formatPercent(decision.confidence)}</strong>
              </div>
              <div
                className="meter"
                aria-label={`Độ tin cậy ${formatPercent(decision.confidence)}`}
              >
                <span style={{ width: `${decision.confidence * 100}%` }} />
              </div>
            </div>
            {decision.conflicts.length ? (
              <div className="conflict-box">
                <strong>Xung đột cần xử lý</strong>
                <ul className="condition-list">
                  {decision.conflicts.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {decision.conditions.length ? (
              <>
                <h3>Điều kiện</h3>
                <ul className="condition-list">
                  {decision.conditions.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </>
            ) : null}
            {decision.proposedAction ? (
              <div className="banner banner--info">
                <p>
                  <strong>{decision.proposedAction.title}</strong>
                  <br />
                  {decision.proposedAction.description}
                </p>
              </div>
            ) : null}
            {run.approval ? (
              <div className="banner banner--success">
                <Check aria-hidden="true" />
                <p>
                  Đã {run.approval.decision === 'APPROVE' ? 'phê duyệt' : 'từ chối'} bởi{' '}
                  {run.approval.createdBy}.
                </p>
              </div>
            ) : decision.requiresHumanApproval ? (
              <RoleGate
                allow={['approver']}
                fallback={
                  <div className="banner banner--warning">
                    <ShieldCheck aria-hidden="true" />
                    <p>
                      Cần role <strong>approver</strong> để xử lý hành động. Bạn vẫn có thể xem toàn
                      bộ căn cứ.
                    </p>
                  </div>
                }
              >
                <ApprovalPanel run={run} onUpdated={onUpdated} />
              </RoleGate>
            ) : null}
          </>
        ) : (
          <>
            <StatusBadge status={run.status} />
            <h2 style={{ marginTop: 14 }}>Đang chờ hội tụ</h2>
            <p className="muted">Cổng quyết định sẽ mở sau khi Synthesizer đối chiếu ba lane.</p>
          </>
        )}
      </div>
    </aside>
  );
}

function ApprovalPanel({
  run,
  onUpdated,
}: {
  run: RunDetail;
  onUpdated: (run: RunDetail) => void;
}) {
  const api = useStartFlowApi();
  const [decision, setDecision] = useState<ApprovalRequest['decision']>('APPROVE');
  const [reason, setReason] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!confirming) return;
    const triggerButton = triggerButtonRef.current;
    confirmButtonRef.current?.focus();
    const containFocus = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setConfirming(false);
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = [
        ...dialogRef.current.querySelectorAll<HTMLElement>('button:not(:disabled)'),
      ];
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    window.addEventListener('keydown', containFocus);
    return () => {
      window.removeEventListener('keydown', containFocus);
      triggerButton?.focus();
    };
  }, [confirming]);
  async function submit() {
    if (reason.trim().length < 5) {
      setError('Lý do cần ít nhất 5 ký tự.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      onUpdated(
        await api.submitApproval(run.id, {
          decision,
          reason: reason.trim(),
          expectedVersion: run.version,
        }),
      );
      setConfirming(false);
    } catch (caught) {
      setError(
        caught instanceof ApiError && caught.status === 409
          ? 'Lượt chạy đã được người khác xử lý. Tải lại để xem quyết định mới nhất.'
          : 'Không thể ghi nhận phê duyệt. Vui lòng thử lại.',
      );
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <div className="approval-form">
      <label htmlFor="approval-decision">Quyết định</label>
      <select
        className="select"
        id="approval-decision"
        value={decision}
        onChange={(event) => setDecision(event.target.value as ApprovalRequest['decision'])}
      >
        <option value="APPROVE">Phê duyệt hành động</option>
        <option value="REJECT">Từ chối và ghi lý do</option>
      </select>
      <label htmlFor="approval-reason">Lý do bắt buộc</label>
      <textarea
        className="textarea"
        id="approval-reason"
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder="Nêu rõ căn cứ của quyết định"
      />
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
      <Button ref={triggerButtonRef} fullWidth onClick={() => setConfirming(true)}>
        {decision === 'APPROVE' ? <Check aria-hidden="true" /> : <X aria-hidden="true" />}
        {decision === 'APPROVE' ? 'Phê duyệt hành động' : 'Từ chối và ghi lý do'}
      </Button>
      {confirming ? (
        <div
          ref={dialogRef}
          className="banner banner--warning"
          role="dialog"
          aria-modal="true"
          aria-label="Xác nhận phê duyệt"
        >
          <div>
            <p>
              <strong>Xác nhận {decision === 'APPROVE' ? 'phê duyệt' : 'từ chối'}:</strong>{' '}
              {run.finalDecision?.proposedAction?.title ?? 'hành động đề xuất'}?
            </p>
            <div className="page-actions">
              <Button ref={confirmButtonRef} onClick={() => void submit()} disabled={submitting}>
                {submitting ? 'Đang ghi nhận…' : 'Xác nhận'}
              </Button>
              <Button variant="secondary" onClick={() => setConfirming(false)}>
                Hủy
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Timeline({ events }: { events: RunEvent[] }) {
  return (
    <Panel>
      <PanelHeader title="Timeline đã lưu" eyebrow={`${events.length} filtered events`} />
      {events.length ? (
        <PanelBody>
          <ol className="timeline" aria-live="polite">
            {events.map((event) => (
              <li className="timeline-item" key={event.id}>
                <p className="utility muted">
                  #{event.sequence.toString().padStart(3, '0')} · {formatDateTime(event.occurredAt)}
                </p>
                <strong>{eventLabels[event.type] ?? event.type}</strong>
                {event.agent ? (
                  <p className="subtle">Lane: {agentLabels[event.agent] ?? event.agent}</p>
                ) : null}
              </li>
            ))}
          </ol>
        </PanelBody>
      ) : (
        <PanelBody>
          <p className="muted">Chưa có sự kiện. Timeline sẽ tự cập nhật khi run bắt đầu.</p>
        </PanelBody>
      )}
    </Panel>
  );
}

function EvidencePanel({ results, events }: { results: AgentResult[]; events: RunEvent[] }) {
  const [tab, setTab] = useState<'citations' | 'tools'>('citations');
  const citations = useMemo(() => {
    const byId = new Map<string, Citation>();
    for (const result of results)
      for (const finding of result.findings)
        for (const citation of finding.citations) byId.set(citation.id, citation);
    for (const event of events.filter((item) => item.type === 'citation.added')) {
      const direct = citationSchema.safeParse(event.payload);
      const nested = citationSchema.safeParse(event.payload.citation);
      const citation = direct.success ? direct.data : nested.success ? nested.data : null;
      if (citation) byId.set(citation.id, citation);
    }
    return [...byId.values()];
  }, [results, events]);
  const tools = useMemo(
    () =>
      events
        .filter((event) => event.type === 'tool.completed')
        .flatMap((event) => {
          const direct = toolEventDataSchema.safeParse(event.payload);
          const nested = toolEventDataSchema.safeParse(event.payload.tool);
          const data = direct.success ? direct.data : nested.success ? nested.data : null;
          return data ? [{ ...data, id: event.id, agent: event.agent }] : [];
        }),
    [events],
  );
  return (
    <Panel>
      <div className="evidence-tabs" role="tablist" aria-label="Căn cứ và công cụ">
        <button
          className="tab-button"
          role="tab"
          aria-selected={tab === 'citations'}
          onClick={() => setTab('citations')}
        >
          Căn cứ ({citations.length})
        </button>
        <button
          className="tab-button"
          role="tab"
          aria-selected={tab === 'tools'}
          onClick={() => setTab('tools')}
        >
          Công cụ ({tools.length})
        </button>
      </div>
      <PanelBody>
        {tab === 'citations' ? (
          citations.length ? (
            citations.map((citation) => (
              <article className="citation" key={citation.id}>
                <p className="eyebrow">{citation.documentTitle}</p>
                <strong>{citation.section}</strong>
                <blockquote>{citation.excerpt}</blockquote>
                <div className="inline-meta">
                  <span>Chunk {citation.chunkId}</span>
                  <span>Liên quan {formatPercent(citation.relevanceScore)}</span>
                </div>
              </article>
            ))
          ) : (
            <p className="muted">Chưa có citation được ghi nhận.</p>
          )
        ) : tools.length ? (
          tools.map((tool) => (
            <article className="tool-row" key={tool.id}>
              <div className="inline-meta">
                <Badge tone="info">{tool.toolName}</Badge>
                <span>
                  <Clock3 aria-hidden="true" /> {tool.latencyMs} ms
                </span>
                <span>{tool.agent ? agentLabels[tool.agent] : 'System'}</span>
              </div>
              <div className="tool-summary">
                <strong>Kết quả đã lọc:</strong>{' '}
                {Object.entries(tool.outputSummary)
                  .map(([key, value]) => `${key}: ${String(value)}`)
                  .join(' · ') || 'Không có tóm tắt'}
              </div>
            </article>
          ))
        ) : (
          <p className="muted">Chưa có tool event được ghi nhận.</p>
        )}
      </PanelBody>
    </Panel>
  );
}
