import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { callHpcSpool, isPendingApproval, syncApprovalQueue } from '@/src/lib/hpc-spool';
import { planAssistantRequest } from '@/src/lib/assistant-routing';
import { retrieveDemoEvidence } from '@/src/lib/demo-database';
import type {
  AssistantAgentTask,
  AssistantEvidence,
  AssistantFileSummary,
  AssistantHistoryItem,
  AssistantResponse,
} from '@/src/lib/assistant-types';

export const runtime = 'nodejs';
export const maxDuration = 300;

const MAX_FILES = 12;
const MAX_FILE_BYTES = 50 * 1024 * 1024;
const MAX_TOTAL_BYTES = 120 * 1024 * 1024;
const MAX_TEXT_BYTES = 750 * 1024;

const textExtensions = new Set([
  'csv',
  'html',
  'ini',
  'json',
  'jsonl',
  'log',
  'md',
  'sql',
  'text',
  'tsv',
  'txt',
  'xml',
  'yaml',
  'yml',
]);

function extension(name: string) {
  return name.toLowerCase().split('.').at(-1) ?? '';
}

function isReadableText(file: File) {
  return (
    file.type.startsWith('text/') ||
    ['application/json', 'application/xml', 'application/sql'].includes(file.type) ||
    textExtensions.has(extension(file.name))
  );
}

function responseError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
}

function parseHistory(value: FormDataEntryValue | null): AssistantHistoryItem[] {
  if (typeof value !== 'string' || !value) return [];
  try {
    const raw = JSON.parse(value) as unknown;
    if (!Array.isArray(raw)) return [];
    return raw.slice(-8).flatMap((item) => {
      if (
        typeof item === 'object' &&
        item !== null &&
        'role' in item &&
        'content' in item &&
        (item.role === 'user' || item.role === 'assistant') &&
        typeof item.content === 'string'
      ) {
        return [{ role: item.role, content: item.content.slice(0, 4_000) }];
      }
      return [];
    });
  } catch {
    return [];
  }
}

async function extractText(files: File[]) {
  const evidence: AssistantEvidence[] = [];
  for (const file of files) {
    if (!isReadableText(file) || file.size > MAX_TEXT_BYTES) continue;
    try {
      const value = (await file.text()).replace(/\0/g, '').trim().slice(0, 5_000);
      if (value) {
        evidence.push({
          id: `file-${evidence.length + 1}`,
          source: file.name,
          label: 'Nội dung đọc trực tiếp từ file',
          excerpt: value,
          confidence: 1,
        });
      }
    } catch {
      // A corrupt or incorrectly labelled file is still forwarded to the local VLM when available.
    }
  }
  return evidence;
}

function fallbackAnswer(
  prompt: string,
  files: AssistantFileSummary[],
  tasks: AssistantAgentTask[],
  evidence: AssistantEvidence[],
) {
  const specialists = tasks
    .filter((task) => !['A002', 'A003', 'A004'].includes(task.agentId))
    .map((task) => `${task.agentId} · ${task.agentName}`)
    .join(', ');
  const fileReport = files.length
    ? `Đã tiếp nhận ${files.length} tệp (${files.map((file) => file.name).join(', ')}).`
    : 'Yêu cầu này không kèm tệp.';
  const extracted = evidence.length
    ? `\n\nDẫn chứng từ tệp hoặc CSDL demo tổng hợp:\n${evidence
        .map((item) => `${item.source}:\n${item.excerpt}`)
        .join('\n\n')
        .slice(0, 6_000)}`
    : files.length
      ? '\n\nCác tệp nhị phân đã được giữ nguyên để VLM multimodal local xử lý; fallback hiện chỉ đọc trực tiếp text, CSV, JSON, XML và log.'
      : '';

  return [
    `Tôi đã tiếp nhận yêu cầu: “${prompt.trim()}”.`,
    fileReport,
    `Planner đã phân rã và giao việc cho: ${specialists || 'nhóm tri thức và vận hành'}.`,
    'Đây là kết quả sơ bộ từ bộ điều phối local. Những hành động làm thay đổi dữ liệu, phê duyệt tín dụng, giao dịch hoặc quyền truy cập vẫn cần nhân viên có thẩm quyền xác nhận.',
  ].join('\n\n') + extracted;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function containsHiddenReasoning(answer: string) {
  return /thinking process|analy[sz]e the request|draft the json|self-correction|let(?:'|’)s assemble|chain[- ]of[- ]thought/i.test(
    answer,
  );
}

function normalizeUpstream(
  value: unknown,
  requestId: string,
  files: AssistantFileSummary[],
  fallbackTasks: AssistantAgentTask[],
): AssistantResponse | null {
  if (!isObject(value) || typeof value.answer !== 'string' || !value.answer.trim()) return null;
  const rawTasks = Array.isArray(value.tasks) ? value.tasks : [];
  const evidence = (Array.isArray(value.evidence) ? value.evidence : []).flatMap(
    (raw, index): AssistantEvidence[] => {
      if (!isObject(raw) || typeof raw.excerpt !== 'string') return [];
      return [
        {
          id: typeof raw.id === 'string' ? raw.id : `evidence-${index + 1}`,
          source: typeof raw.source === 'string' ? raw.source : 'local-runtime',
          label: typeof raw.label === 'string' ? raw.label : 'Dẫn chứng',
          excerpt: raw.excerpt.slice(0, 6_000),
          confidence:
            typeof raw.confidence === 'number' && raw.confidence >= 0 && raw.confidence <= 1
              ? raw.confidence
              : 1,
        },
      ];
    },
  );
  const tasks = rawTasks.flatMap((raw, index): AssistantAgentTask[] => {
    if (!isObject(raw)) return [];
    const fallback = fallbackTasks[index];
    const status = raw.status;
    const normalizedStatus =
      status === 'queued' ||
      status === 'running' ||
      status === 'completed' ||
      status === 'awaiting_approval' ||
      status === 'rejected' ||
      status === 'failed'
        ? status
        : (fallback?.status ?? 'completed');
    return [
      {
        id: typeof raw.id === 'string' ? raw.id : `task-${index + 1}`,
        agentId:
          typeof raw.agentId === 'string'
            ? raw.agentId
            : typeof raw.agent_id === 'string'
              ? raw.agent_id
              : (fallback?.agentId ?? 'A004'),
        agentName:
          typeof raw.agentName === 'string'
            ? raw.agentName
            : typeof raw.agent_name === 'string'
              ? raw.agent_name
              : (fallback?.agentName ?? 'Agent Router'),
        domain: typeof raw.domain === 'string' ? raw.domain : (fallback?.domain ?? 'Orchestration'),
        objective:
          typeof raw.objective === 'string' ? raw.objective : (fallback?.objective ?? 'Xử lý yêu cầu'),
        reason: typeof raw.reason === 'string' ? raw.reason : (fallback?.reason ?? 'Được Planner lựa chọn.'),
        status: normalizedStatus,
        approvalRequired:
          typeof raw.approvalRequired === 'boolean'
            ? raw.approvalRequired
            : (fallback?.approvalRequired ?? false),
        coreDependencies: Array.isArray(raw.coreDependencies)
          ? raw.coreDependencies.filter((item): item is string => typeof item === 'string')
          : (fallback?.coreDependencies ?? []),
        modelId: typeof raw.modelId === 'string' ? raw.modelId : fallback?.modelId,
      },
    ];
  });
  return {
    requestId,
    mode: 'local-vlm',
    answer: value.answer.trim(),
    tasks: tasks.length ? tasks : fallbackTasks,
    files,
    evidence,
    warnings: Array.isArray(value.warnings)
      ? value.warnings.filter((warning): warning is string => typeof warning === 'string')
      : [],
    completedAt: new Date().toISOString(),
  };
}

async function callLocalOrchestrator(
  prompt: string,
  history: AssistantHistoryItem[],
  sourceFiles: File[],
  requestId: string,
  files: AssistantFileSummary[],
  tasks: AssistantAgentTask[],
  demoEvidence: AssistantEvidence[],
  approval?: { decision: 'approve' | 'reject'; task: AssistantAgentTask },
) {
  const endpoint = process.env.STARTFLOW_ASSISTANT_URL?.trim();
  if (!endpoint) return null;

  const payload = new FormData();
  payload.set('prompt', prompt);
  payload.set('history', JSON.stringify(history));
  payload.set('requestId', requestId);
  payload.set('requestedAgents', JSON.stringify(tasks.map((task) => task.agentId)));
  payload.set('demoEvidence', JSON.stringify(demoEvidence));
  if (approval) {
    payload.set('approvalDecision', approval.decision);
    payload.set('approvalTask', JSON.stringify(approval.task));
  }
  for (const file of sourceFiles) payload.append('files', file, file.name);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 240_000);
  try {
    const token = process.env.INTERNAL_SERVICE_TOKEN?.trim();
    const response = await fetch(endpoint, {
      method: 'POST',
      body: payload,
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        'X-Correlation-ID': requestId,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!response.ok) return null;
    return normalizeUpstream(await response.json(), requestId, files, tasks);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function parseApproval(body: FormData) {
  const decision = body.get('approvalDecision');
  const rawTask = body.get('approvalTask');
  if ((decision !== 'approve' && decision !== 'reject') || typeof rawTask !== 'string') return null;
  try {
    const value = JSON.parse(rawTask) as unknown;
    if (
      !isObject(value) ||
      typeof value.id !== 'string' ||
      typeof value.agentId !== 'string' ||
      typeof value.agentName !== 'string' ||
      typeof value.domain !== 'string' ||
      typeof value.objective !== 'string' ||
      typeof value.reason !== 'string'
    ) return null;
    const task: AssistantAgentTask = {
      id: value.id,
      agentId: value.agentId,
      agentName: value.agentName,
      domain: value.domain,
      objective: value.objective,
      reason: value.reason,
      status: decision === 'approve' ? 'completed' : 'rejected',
      approvalRequired: false,
      coreDependencies: Array.isArray(value.coreDependencies)
        ? value.coreDependencies.filter((item): item is string => typeof item === 'string')
        : [],
    };
    return { decision, task } as const;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const demoMode =
    process.env.NEXT_PUBLIC_AUTH_MODE === 'demo' &&
    process.env.NEXT_PUBLIC_DEMO_PUBLIC_WARNING === 'true';
  const authorization = request.headers.get('authorization');
  const demoRole =
    authorization === 'Bearer demo-manager-token'
      ? 'manager'
      : authorization === 'Bearer demo-banker-token'
        ? 'banker'
        : null;
  if (
    (demoMode && !demoRole) ||
    (!demoMode && !authorization?.startsWith('Bearer '))
  ) {
    return responseError('Phiên đăng nhập không hợp lệ.', 401);
  }
  if (!request.headers.get('content-type')?.includes('multipart/form-data')) {
    return responseError('Yêu cầu phải dùng multipart/form-data.', 415);
  }

  let body: FormData;
  try {
    body = await request.formData();
  } catch {
    return responseError('Không đọc được nội dung upload.', 400);
  }

  const prompt = typeof body.get('prompt') === 'string' ? String(body.get('prompt')).trim() : '';
  if (!prompt || prompt.length > 8_000) {
    return responseError('Câu hỏi phải có từ 1 đến 8.000 ký tự.', 400);
  }

  const sourceFiles = body.getAll('files').filter((entry): entry is File => entry instanceof File);
  if (sourceFiles.length > MAX_FILES) return responseError(`Chỉ gửi tối đa ${MAX_FILES} tệp.`, 413);
  if (sourceFiles.some((file) => file.size > MAX_FILE_BYTES)) {
    return responseError('Mỗi tệp phải nhỏ hơn hoặc bằng 50 MB.', 413);
  }
  if (sourceFiles.reduce((total, file) => total + file.size, 0) > MAX_TOTAL_BYTES) {
    return responseError('Tổng dung lượng upload phải nhỏ hơn hoặc bằng 120 MB.', 413);
  }

  const files: AssistantFileSummary[] = sourceFiles.map((file) => ({
    name: file.name.replace(/[\r\n]/g, ' ').slice(0, 240),
    size: file.size,
    type: file.type || 'application/octet-stream',
    readableText: isReadableText(file),
  }));
  const requestId = randomUUID();
  const history = parseHistory(body.get('history'));
  const approval = parseApproval(body);
  if (approval && demoMode && demoRole !== 'manager') {
    return responseError('Tác vụ này cần tài khoản manager phê duyệt.', 403);
  }
  if (approval && !(await isPendingApproval(approval.task))) {
    return responseError('Tác vụ không còn trong hàng đợi phê duyệt hoặc nội dung đã thay đổi.', 409);
  }
  const tasks = approval
    ? [approval.task]
    : planAssistantRequest(prompt, files).map((task) => ({
        ...task,
        id: `${requestId}-${task.id}`,
      }));
  const demoEvidence = approval ? [] : retrieveDemoEvidence(prompt, files.length ? 3 : 5);
  const hpc = await callHpcSpool({
    prompt,
    history,
    requestId,
    files,
    sourceFiles,
    tasks,
    demoEvidence,
    approval: approval ?? undefined,
  }).catch(() => null);
  const hpcResponse = normalizeUpstream(hpc, requestId, files, tasks);
  if (hpcResponse) {
    const trustedEvidence = [...(await extractText(sourceFiles)), ...demoEvidence];
    const unsafeOutput =
      containsHiddenReasoning(hpcResponse.answer) ||
      hpcResponse.warnings.some((warning) => warning.includes('không đúng JSON'));
    hpcResponse.evidence = approval ? [] : trustedEvidence;
    if (approval) {
      hpcResponse.answer =
        approval.decision === 'approve'
          ? `Đã ghi nhận manager phê duyệt cho ${approval.task.agentId} · ${approval.task.agentName}. Đây là phê duyệt để workflow tiếp tục task; không phải quyết định phê duyệt khoản vay hoặc giao dịch ngân hàng.`
          : `Đã ghi nhận manager từ chối ${approval.task.agentId} · ${approval.task.agentName}. Task đã dừng và không thực hiện hành động có tác động.`;
      hpcResponse.warnings = [];
    } else if (unsafeOutput) {
      hpcResponse.answer = fallbackAnswer(prompt, files, hpcResponse.tasks, trustedEvidence);
      hpcResponse.warnings = [
        'Output sinh tự do không đạt schema an toàn; lớp điều phối đã thay bằng câu trả lời có dẫn chứng đã xác minh.',
      ];
    }
    await syncApprovalQueue(requestId, hpcResponse.tasks).catch(() => undefined);
    return NextResponse.json(hpcResponse, { headers: { 'Cache-Control': 'no-store' } });
  }
  const local = await callLocalOrchestrator(
    prompt,
    history,
    sourceFiles,
    requestId,
    files,
    tasks,
    demoEvidence,
    approval ?? undefined,
  );
  if (local) {
    await syncApprovalQueue(requestId, local.tasks).catch(() => undefined);
    return NextResponse.json(local, { headers: { 'Cache-Control': 'no-store' } });
  }

  if (approval) {
    const fallback: AssistantResponse = {
      requestId,
      mode: 'demo-fallback',
      answer:
        approval.decision === 'approve'
          ? `Đã ghi nhận phê duyệt cho ${approval.task.agentId} · ${approval.task.agentName}. Workflow được phép tiếp tục task này và vẫn phải ghi lại evidence, tool result và audit event.`
          : `Đã ghi nhận từ chối cho ${approval.task.agentId} · ${approval.task.agentName}. Task đã dừng; workflow không được thực hiện hành động liên quan.`,
      tasks,
      files,
      evidence: [],
      warnings: process.env.STARTFLOW_ASSISTANT_URL
        ? ['Orchestrator local không phản hồi; quyết định mới chỉ được ghi nhận trong phiên demo.']
        : ['Chưa nối orchestrator local; quyết định mới chỉ được ghi nhận trong phiên demo.'],
      completedAt: new Date().toISOString(),
    };
    await syncApprovalQueue(requestId, fallback.tasks).catch(() => undefined);
    return NextResponse.json(fallback, { headers: { 'Cache-Control': 'no-store' } });
  }

  const evidence = [...(await extractText(sourceFiles)), ...demoEvidence];
  const fallback: AssistantResponse = {
    requestId,
    mode: 'demo-fallback',
    answer: fallbackAnswer(prompt, files, tasks, evidence),
    tasks,
    files,
    evidence,
    warnings: [
      process.env.STARTFLOW_ASSISTANT_URL
        ? 'Orchestrator/VLM local không phản hồi; hệ thống đã tự chuyển sang routing fallback.'
        : 'Chưa cấu hình STARTFLOW_ASSISTANT_URL; đang dùng routing fallback trên máy chủ web.',
    ],
    completedAt: new Date().toISOString(),
  };
  await syncApprovalQueue(requestId, fallback.tasks).catch(() => undefined);
  return NextResponse.json(fallback, { headers: { 'Cache-Control': 'no-store' } });
}
