import type { AssistantEvidence, AssistantFileSummary } from './assistant-types';

const INTERNAL_REFERENCE = /\b[A-Z]{2,12}-DEMO-\d+\b/g;
const TRACE_LINE = /WORKFLOW PLANNER|coreDependencies|requestedTasks|"agentId"|thinking process|chain[- ]of[- ]thought/i;

function stripMarkdown(value: string) {
  return value
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function friendlySource(value: string) {
  return stripMarkdown(value)
    .replace(/^(?:demo-)?[A-Z]{2,12}-DEMO-\d+\s*[·:—-]?\s*/i, '')
    .trim() || 'Nguồn dữ liệu demo';
}

export function presentEvidence(evidence: AssistantEvidence[]) {
  return evidence.map((item) => ({
    ...item,
    source: friendlySource(item.source),
    label: stripMarkdown(item.label),
    excerpt: stripMarkdown(item.excerpt),
  }));
}

export function presentFinalAnswer(answer: string, evidence: AssistantEvidence[]) {
  let result = answer;
  evidence.forEach((item, index) => {
    const internalId = item.id.replace(/^demo-/, '');
    if (!internalId) return;
    result = result.replace(
      new RegExp(`(?:\\*\\*|\`)?${escapeRegExp(internalId)}(?:\\*\\*|\`)?`, 'gi'),
      `[${index + 1}]`,
    );
  });
  result = stripMarkdown(result)
    .replace(INTERNAL_REFERENCE, '[nguồn chưa xác minh]')
    .split('\n')
    .filter((line) => !TRACE_LINE.test(line))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  const words = result.split(/\s+/).filter(Boolean);
  return words.length > 300 ? `${words.slice(0, 300).join(' ')}…` : result;
}

function firstSentence(value: string) {
  const clean = stripMarkdown(value).replace(INTERNAL_REFERENCE, '').replace(/\s+/g, ' ').trim();
  const match = clean.match(/^.{1,260}?(?:[.!?](?:\s|$)|$)/);
  return (match?.[0] ?? clean.slice(0, 260)).trim();
}

export function buildFallbackSummary(files: AssistantFileSummary[], evidence: AssistantEvidence[]) {
  const points = evidence.slice(0, 2).map((item) => firstSentence(item.excerpt)).filter(Boolean);
  if (points.length) {
    return [
      'Kết quả tổng hợp:',
      ...points.map((point, index) => `${index + 1}. ${point} [${index + 1}]`),
      '',
      'Đây là phân tích sơ bộ từ dữ liệu tổng hợp. Chi tiết nguồn nằm trong mục Dẫn chứng; mọi hành động có tác động vẫn cần người có thẩm quyền xác nhận.',
    ].join('\n');
  }
  if (files.length) {
    return `Đã tiếp nhận ${files.length} tệp và chuyển tới workflow local. Hiện chưa trích xuất được đủ dữ liệu đáng tin cậy để đưa ra kết luận; vui lòng kiểm tra định dạng hoặc bổ sung tài liệu rõ hơn.`;
  }
  return 'Chưa có đủ dữ liệu đáng tin cậy để đưa ra kết luận. Hãy bổ sung tài liệu hoặc mô tả cụ thể hơn; hệ thống sẽ chỉ kết luận khi có dẫn chứng phù hợp.';
}

export function hasExecutionTrace(answer: string) {
  const denseAgentIds = answer.match(/\bA\d{3}\b/g)?.length ?? 0;
  return TRACE_LINE.test(answer) || denseAgentIds >= 3 || /^\s*[{[]/.test(answer);
}
