'use client';

import {
  Bot,
  CheckCircle2,
  ChevronRight,
  File,
  FileUp,
  History,
  LoaderCircle,
  LockKeyhole,
  MessageSquarePlus,
  Paperclip,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserRound,
  Workflow,
  X,
} from 'lucide-react';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { useAuth } from '@/src/auth/auth-context';
import { Badge, type BadgeTone } from '@/src/components/ui/badge';
import { Button } from '@/src/components/ui/button';
import { PageHeader } from '@/src/components/ui/page-header';
import { Panel } from '@/src/components/ui/panel';
import type {
  AssistantAgentTask,
  AssistantHistoryItem,
  AssistantResponse,
} from '@/src/lib/assistant-types';

interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  files?: string[];
  response?: AssistantResponse;
}

interface StoredConversation {
  id: string;
  title: string;
  updatedAt: string;
  messages: ConversationMessage[];
}

const MAX_SAVED_CONVERSATIONS = 12;

const suggestions = [
  'Tóm tắt tài liệu và chỉ ra các điểm cần nhân viên kiểm tra.',
  'Sàng lọc danh sách khách hàng tiềm năng, chấm ưu tiên và giải thích từng tiêu chí.',
  'Kiểm tra bộ hồ sơ KYC này còn thiếu gì và có dấu hiệu bất thường không?',
  'Phân tích file giao dịch, tìm giao dịch đáng ngờ và giải thích lý do.',
];

const initialMessage: ConversationMessage = {
  id: 'welcome',
  role: 'assistant',
  content:
    'Xin chào. Tôi là trợ lý nghiệp vụ nội bộ StartFlow. Hãy đặt câu hỏi hoặc tải tài liệu lên; Planner sẽ phân rã yêu cầu và giao từng phần cho các agent phù hợp.',
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function taskTone(status: AssistantAgentTask['status']): BadgeTone {
  if (status === 'completed') return 'success';
  if (status === 'failed' || status === 'rejected') return 'danger';
  if (status === 'awaiting_approval') return 'warning';
  return 'info';
}

const statusLabels: Record<AssistantAgentTask['status'], string> = {
  queued: 'Chờ xử lý',
  running: 'Đang chạy',
  completed: 'Hoàn tất',
  awaiting_approval: 'Chờ phê duyệt',
  rejected: 'Đã từ chối',
  failed: 'Có lỗi',
};

export function AssistantWorkspace() {
  const { getAccessToken, hasRole } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([initialMessage]);
  const [conversationId, setConversationId] = useState('new-conversation');
  const [savedConversations, setSavedConversations] = useState<StoredConversation[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyReady, setHistoryReady] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [approvalBusy, setApprovalBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const latestResponse = useMemo(
    () => [...messages].reverse().find((message) => message.response)?.response ?? null,
    [messages],
  );
  const historyStorageKey = 'startflow-demo-conversations-shared';
  const canApprove = hasRole('approver');

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(historyStorageKey);
      const parsed = raw ? (JSON.parse(raw) as unknown) : [];
      if (Array.isArray(parsed)) {
        setSavedConversations(
          parsed
            .filter(
              (item): item is StoredConversation =>
                typeof item === 'object' &&
                item !== null &&
                'id' in item &&
                'title' in item &&
                'updatedAt' in item &&
                'messages' in item &&
                typeof item.id === 'string' &&
                typeof item.title === 'string' &&
                typeof item.updatedAt === 'string' &&
                Array.isArray(item.messages),
            )
            .slice(0, MAX_SAVED_CONVERSATIONS),
        );
      }
    } catch {
      setSavedConversations([]);
    }
    setConversationId(crypto.randomUUID());
    setHistoryReady(true);
  }, [historyStorageKey]);

  useEffect(() => {
    if (!historyReady || messages.length <= 1) return;
    const firstQuestion = messages.find((message) => message.role === 'user')?.content ?? 'Cuộc trò chuyện';
    const stored: StoredConversation = {
      id: conversationId,
      title: firstQuestion.replace(/\s+/g, ' ').trim().slice(0, 72),
      updatedAt: new Date().toISOString(),
      messages: messages.slice(-24),
    };
    setSavedConversations((current) => {
      const next = [stored, ...current.filter((item) => item.id !== conversationId)].slice(
        0,
        MAX_SAVED_CONVERSATIONS,
      );
      try {
        window.localStorage.setItem(historyStorageKey, JSON.stringify(next));
      } catch {
        // Keep the in-memory history when browser storage is unavailable or full.
      }
      return next;
    });
  }, [conversationId, historyReady, historyStorageKey, messages]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: submitting ? 'smooth' : 'auto', block: 'end' });
  }, [messages, submitting]);

  function addFiles(nextFiles: File[]) {
    setError(null);
    setFiles((current) => {
      const map = new Map(current.map((file) => [`${file.name}:${file.size}:${file.lastModified}`, file]));
      for (const file of nextFiles) map.set(`${file.name}:${file.size}:${file.lastModified}`, file);
      const selected = [...map.values()];
      if (selected.length > 12) setError('Mỗi yêu cầu chỉ được đính kèm tối đa 12 tệp.');
      return selected.slice(0, 12);
    });
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    addFiles(Array.from(event.dataTransfer.files));
  }

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    const question = prompt.trim();
    if (!question || submitting) return;
    const normalizedQuestion = question
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    const pendingApproval = latestResponse?.tasks.find(
      (task) => task.status === 'awaiting_approval',
    );
    if (pendingApproval && ['approve', 'phe duyet', 'dong y'].includes(normalizedQuestion)) {
      if (!canApprove) {
        setError('Tác vụ này cần tài khoản manager có quyền approver.');
        return;
      }
      setPrompt('');
      await decideTask(pendingApproval, 'approve');
      return;
    }
    if (pendingApproval && ['reject', 'tu choi', 'khong dong y'].includes(normalizedQuestion)) {
      if (!canApprove) {
        setError('Tác vụ này cần tài khoản manager có quyền approver.');
        return;
      }
      setPrompt('');
      await decideTask(pendingApproval, 'reject');
      return;
    }
    if (files.some((file) => file.size > 50 * 1024 * 1024)) {
      setError('Mỗi tệp phải nhỏ hơn hoặc bằng 50 MB.');
      return;
    }
    if (files.reduce((total, file) => total + file.size, 0) > 120 * 1024 * 1024) {
      setError('Tổng dung lượng tệp phải nhỏ hơn hoặc bằng 120 MB.');
      return;
    }

    const selectedFiles = files;
    const userMessage: ConversationMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: question,
      files: selectedFiles.map((file) => file.name),
    };
    const history: AssistantHistoryItem[] = messages.slice(-8).map(({ role, content }) => ({ role, content }));
    setMessages((current) => [...current, userMessage]);
    setPrompt('');
    setFiles([]);
    setError(null);
    setSubmitting(true);

    try {
      const body = new FormData();
      body.set('prompt', question);
      body.set('history', JSON.stringify(history));
      for (const file of selectedFiles) body.append('files', file, file.name);
      const token = await getAccessToken();
      const response = await fetch('/api/assistant', {
        method: 'POST',
        body,
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = (await response.json()) as AssistantResponse | { error?: string };
      if (!response.ok || !('answer' in payload)) {
        throw new Error('error' in payload && payload.error ? payload.error : 'Không xử lý được yêu cầu.');
      }
      setMessages((current) => [
        ...current,
        {
          id: payload.requestId,
          role: 'assistant',
          content: payload.answer,
          response: payload,
        },
      ]);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Không kết nối được trợ lý local.';
      setError(message);
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `Tôi chưa thể hoàn tất yêu cầu: ${message} Các tệp chưa được lưu lại; bạn có thể thử gửi lại.`,
        },
      ]);
    } finally {
      setSubmitting(false);
    }
  }

  async function decideTask(task: AssistantAgentTask, decision: 'approve' | 'reject') {
    if (!latestResponse || approvalBusy) return;
    if (!canApprove) {
      setError('Chỉ tài khoản manager có quyền phê duyệt hoặc từ chối tác vụ này.');
      return;
    }
    setApprovalBusy(task.id);
    setError(null);
    const command = decision === 'approve' ? `APPROVE ${task.agentId}` : `REJECT ${task.agentId}`;
    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: 'user', content: command },
    ]);
    try {
      const body = new FormData();
      body.set('prompt', command);
      body.set('approvalDecision', decision);
      body.set('approvalTask', JSON.stringify(task));
      body.set(
        'history',
        JSON.stringify(messages.slice(-8).map(({ role, content }) => ({ role, content }))),
      );
      const token = await getAccessToken();
      const response = await fetch('/api/assistant', {
        method: 'POST',
        body,
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = (await response.json()) as AssistantResponse | { error?: string };
      if (!response.ok || !('answer' in payload)) {
        throw new Error('error' in payload && payload.error ? payload.error : 'Không ghi nhận được quyết định.');
      }
      const decidedTask = payload.tasks[0];
      const merged: AssistantResponse = {
        ...payload,
        tasks: latestResponse.tasks.map((item) =>
          item.id === task.id && decidedTask ? { ...item, ...decidedTask } : item,
        ),
        files: latestResponse.files,
        evidence: payload.evidence.length ? payload.evidence : latestResponse.evidence,
      };
      setMessages((current) => [
        ...current,
        { id: payload.requestId, role: 'assistant', content: payload.answer, response: merged },
      ]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không ghi nhận được quyết định.');
    } finally {
      setApprovalBusy(null);
    }
  }

  function onComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void submit();
    }
  }

  function reset() {
    setMessages([initialMessage]);
    setConversationId(crypto.randomUUID());
    setFiles([]);
    setPrompt('');
    setError(null);
    setHistoryOpen(false);
  }

  function openConversation(conversation: StoredConversation) {
    setConversationId(conversation.id);
    setMessages(conversation.messages.length ? conversation.messages : [initialMessage]);
    setFiles([]);
    setPrompt('');
    setError(null);
    setHistoryOpen(false);
  }

  function deleteConversation(id: string) {
    setSavedConversations((current) => {
      const next = current.filter((item) => item.id !== id);
      try {
        window.localStorage.setItem(historyStorageKey, JSON.stringify(next));
      } catch {
        // The current in-memory list still updates when storage is unavailable.
      }
      return next;
    });
    if (id === conversationId) reset();
  }

  return (
    <>
      <PageHeader
        eyebrow="StartFlow · Internal AI"
        title="Hỏi trợ lý nghiệp vụ"
        description="Một cửa vào cho nhân viên: tải tài liệu, mô tả công việc và theo dõi Planner điều phối agent chuyên môn."
        actions={
          <div className="assistant-header-actions">
            <Badge tone="success"><LockKeyhole aria-hidden="true" /> Local-first</Badge>
            <Button variant="secondary" onClick={() => setHistoryOpen((value) => !value)}>
              <History aria-hidden="true" /> Lịch sử ({savedConversations.length})
            </Button>
            <Button variant="secondary" onClick={reset}>
              <RotateCcw aria-hidden="true" /> Cuộc trò chuyện mới
            </Button>
          </div>
        }
      />

      <div className="assistant-safety" role="note">
        <ShieldCheck aria-hidden="true" />
        <p>
          <strong>Dữ liệu nội bộ:</strong> file gốc được gửi tới runtime local và không lưu trong lịch sử trình duyệt;
          câu hỏi, câu trả lời và trích dẫn hiển thị được lưu cục bộ cho bản demo. Không tải dữ liệu thật lên Quick Tunnel.
        </p>
      </div>

      <div className="assistant-layout">
        <Panel className="assistant-chat-panel">
          {historyOpen ? (
            <section className="assistant-history" aria-label="Lịch sử cuộc trò chuyện">
              <header>
                <div><strong>Lịch sử demo</strong><span>Lưu cục bộ trên trình duyệt demo này</span></div>
                <Button variant="secondary" onClick={reset}>
                  <MessageSquarePlus aria-hidden="true" /> Cuộc trò chuyện mới
                </Button>
              </header>
              {savedConversations.length ? (
                <div className="assistant-history-list">
                  {savedConversations.map((conversation) => (
                    <article key={conversation.id} data-current={conversation.id === conversationId}>
                      <button type="button" onClick={() => openConversation(conversation)}>
                        <strong>{conversation.title}</strong>
                        <span>{new Date(conversation.updatedAt).toLocaleString('vi-VN')}</span>
                      </button>
                      <button
                        className="assistant-history-delete"
                        type="button"
                        aria-label={`Xóa ${conversation.title}`}
                        onClick={() => deleteConversation(conversation.id)}
                      >
                        <Trash2 aria-hidden="true" />
                      </button>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="muted">Chưa có cuộc trò chuyện đã lưu.</p>
              )}
            </section>
          ) : null}
          <div className="assistant-thread" aria-live="polite">
            {messages.map((message) => (
              <article
                className={`assistant-message assistant-message--${message.role}`}
                key={message.id}
              >
                <div className="assistant-avatar" aria-hidden="true">
                  {message.role === 'assistant' ? <Bot /> : <UserRound />}
                </div>
                <div className="assistant-bubble">
                  <div className="assistant-message-meta">
                    <strong>{message.role === 'assistant' ? 'StartFlow AI' : 'Bạn'}</strong>
                    {message.response ? (
                      <Badge tone={message.response.mode === 'local-vlm' ? 'success' : 'warning'}>
                        {message.response.mode === 'local-vlm' ? 'Local VLM' : 'Demo fallback'}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="assistant-answer">{message.content}</p>
                  {message.files?.length ? (
                    <div className="assistant-inline-files">
                      {message.files.map((name) => (
                        <span key={name}><File aria-hidden="true" /> {name}</span>
                      ))}
                    </div>
                  ) : null}
                  {message.response?.warnings.map((warning) => (
                    <p className="assistant-warning" key={warning}>{warning}</p>
                  ))}
                  {message.response?.evidence.length ? (
                    <details className="assistant-evidence">
                      <summary>Dẫn chứng từ dữ liệu ({message.response.evidence.length})</summary>
                      {message.response.evidence.map((item) => (
                        <blockquote key={item.id}>
                          <strong>{item.source}</strong>
                          <span>{item.label} · confidence {Math.round(item.confidence * 100)}%</span>
                          <p>{item.excerpt}</p>
                        </blockquote>
                      ))}
                    </details>
                  ) : null}
                  {message.id === latestResponse?.requestId &&
                  message.response?.tasks.some((task) => task.status === 'awaiting_approval') ? (
                    <section className="assistant-inline-approval" aria-label="Yêu cầu phê duyệt">
                      <div className="assistant-inline-approval__intro">
                        <ShieldCheck aria-hidden="true" />
                        <div>
                          <strong>Cần người có thẩm quyền xác nhận</strong>
                          <span>Workflow đã dừng trước hành động có tác động.</span>
                        </div>
                      </div>
                      {message.response.tasks
                        .filter((task) => task.status === 'awaiting_approval')
                        .map((task) => (
                          <article key={task.id}>
                            <div>
                              <strong>{task.agentId} · {task.agentName}</strong>
                              <p>{task.objective}</p>
                            </div>
                            {canApprove ? (
                              <div className="assistant-inline-approval__actions">
                                <Button
                                  disabled={approvalBusy !== null}
                                  onClick={() => void decideTask(task, 'approve')}
                                >
                                  {approvalBusy === task.id ? <LoaderCircle aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}
                                  Phê duyệt
                                </Button>
                                <Button
                                  variant="secondary"
                                  disabled={approvalBusy !== null}
                                  onClick={() => void decideTask(task, 'reject')}
                                >
                                  <X aria-hidden="true" /> Từ chối
                                </Button>
                              </div>
                            ) : (
                              <p className="assistant-inline-approval__manager-note">
                                Đăng nhập tài khoản manager để phê duyệt hoặc từ chối.
                              </p>
                            )}
                          </article>
                        ))}
                      {canApprove ? <small>Bạn cũng có thể gõ “approve” hoặc “reject”.</small> : null}
                    </section>
                  ) : null}
                </div>
              </article>
            ))}
            {submitting ? (
              <article className="assistant-message assistant-message--assistant">
                <div className="assistant-avatar" aria-hidden="true"><Bot /></div>
                <div className="assistant-bubble assistant-thinking">
                  <LoaderCircle aria-hidden="true" />
                  <div><strong>Planner đang phân tích yêu cầu…</strong><span>Đọc tệp và chọn agent phù hợp</span></div>
                </div>
              </article>
            ) : null}
            <div ref={threadEndRef} aria-hidden="true" />
          </div>

          {messages.length === 1 ? (
            <div className="assistant-suggestions" aria-label="Yêu cầu gợi ý">
              {suggestions.map((suggestion) => (
                <button key={suggestion} type="button" onClick={() => setPrompt(suggestion)}>
                  <Sparkles aria-hidden="true" /> <span>{suggestion}</span><ChevronRight aria-hidden="true" />
                </button>
              ))}
            </div>
          ) : null}

          <form className="assistant-composer" onSubmit={(event) => void submit(event)}>
            {error ? <p className="assistant-error" role="alert">{error}</p> : null}
            {files.length ? (
              <div className="assistant-file-list">
                {files.map((file, index) => (
                  <span className="assistant-file-chip" key={`${file.name}:${file.lastModified}`}>
                    <File aria-hidden="true" />
                    <span><strong>{file.name}</strong><small>{formatBytes(file.size)}</small></span>
                    <button
                      type="button"
                      aria-label={`Bỏ tệp ${file.name}`}
                      onClick={() => setFiles((current) => current.filter((_, item) => item !== index))}
                    ><X aria-hidden="true" /></button>
                  </span>
                ))}
              </div>
            ) : null}
            <div
              className={`assistant-input-row${dragging ? ' assistant-input-row--dragging' : ''}`}
              onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
            >
              <input
                className="visually-hidden"
                ref={inputRef}
                type="file"
                multiple
                onChange={(event) => {
                  addFiles(Array.from(event.target.files ?? []));
                  event.target.value = '';
                }}
              />
              <Button
                className="assistant-attach"
                variant="ghost"
                aria-label="Đính kèm tệp"
                onClick={() => inputRef.current?.click()}
              ><Paperclip aria-hidden="true" /></Button>
              <textarea
                aria-label="Câu hỏi cho trợ lý"
                placeholder="Hỏi bất kỳ nghiệp vụ nào hoặc kéo thả tệp vào đây…"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                onKeyDown={onComposerKeyDown}
                maxLength={8_000}
              />
              <Button className="assistant-send" type="submit" disabled={!prompt.trim() || submitting}>
                <Send aria-hidden="true" /><span>Gửi</span>
              </Button>
            </div>
            <div className="assistant-composer-meta">
              <span><FileUp aria-hidden="true" /> Mọi định dạng · tối đa 12 tệp · 50 MB/tệp</span>
              <span>Enter để gửi · Shift + Enter xuống dòng</span>
            </div>
          </form>
        </Panel>

        <aside className="assistant-task-panel" aria-label="Kế hoạch thực thi">
          <Panel>
            <header className="assistant-task-header">
              <div><p className="eyebrow">Planner execution</p><h2>Kế hoạch agent</h2></div>
              <Workflow aria-hidden="true" />
            </header>
            {latestResponse ? (
              <>
                <div className="assistant-run-summary">
                  <span><strong>{latestResponse.tasks.length}</strong> nhiệm vụ</span>
                  <span><strong>{new Set(latestResponse.tasks.map((task) => task.domain)).size}</strong> domain</span>
                </div>
                <ol className="assistant-task-list">
                  {latestResponse.tasks.map((task, index) => (
                    <li key={task.id}>
                      <span className="assistant-task-index">{String(index + 1).padStart(2, '0')}</span>
                      <div>
                        <div className="assistant-task-title">
                          <strong>{task.agentId} · {task.agentName}</strong>
                          <Badge tone={taskTone(task.status)}>{statusLabels[task.status]}</Badge>
                        </div>
                        <p>{task.domain}</p>
                        <small>{task.reason}</small>
                        <small className="assistant-task-core">
                          {task.coreDependencies.join(' · ')}
                          {task.modelId ? ` → ${task.modelId}` : ''}
                        </small>
                      </div>
                    </li>
                  ))}
                </ol>
                <div className="assistant-task-footer">
                  <CheckCircle2 aria-hidden="true" />
                  <span>Planner chỉ kích hoạt agent cần thiết, không chạy đồng thời 128 model.</span>
                </div>
              </>
            ) : (
              <div className="assistant-task-empty">
                <Workflow aria-hidden="true" />
                <h3>Chưa có kế hoạch</h3>
                <p>Gửi một yêu cầu để xem Planner phân rã và giao việc theo thời gian thực.</p>
                <div><strong>128</strong><span>agents · 16 domains</span></div>
              </div>
            )}
          </Panel>
          {files.length ? (
            <button className="assistant-clear-files" type="button" onClick={() => setFiles([])}>
              <Trash2 aria-hidden="true" /> Bỏ tất cả tệp
            </button>
          ) : null}
        </aside>
      </div>
    </>
  );
}
