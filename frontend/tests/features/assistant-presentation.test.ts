import { describe, expect, it } from 'vitest';
import {
  buildFallbackSummary,
  hasExecutionTrace,
  presentEvidence,
  presentFinalAnswer,
} from '@/src/lib/assistant-presentation';
import type { AssistantEvidence } from '@/src/lib/assistant-types';

const evidence: AssistantEvidence[] = [
  {
    id: 'demo-PROC-DEMO-002',
    source: 'PROC-DEMO-002 · Sàng lọc khách hàng SME tiềm năng',
    label: '**CSDL demo tổng hợp**',
    excerpt: 'Điểm ưu tiên gồm phù hợp sản phẩm, nhu cầu vốn, dòng tiền, tương tác và KYC. Nội dung chi tiết không được lặp lại nguyên khối trong câu trả lời.',
    confidence: 0.98,
  },
];

describe('assistant presentation boundary', () => {
  it('keeps audit ids internally but presents friendly evidence titles', () => {
    const [item] = presentEvidence(evidence);
    expect(item?.id).toBe('demo-PROC-DEMO-002');
    expect(item?.source).toBe('Sàng lọc khách hàng SME tiềm năng');
    expect(item?.label).toBe('CSDL demo tổng hợp');
  });

  it('maps markdown-wrapped internal citations to a numbered reference', () => {
    const answer = presentFinalAnswer('Theo **PROC-DEMO-002**, hồ sơ cần được rà soát.', evidence);
    expect(answer).toContain('[1]');
    expect(answer).not.toContain('PROC-DEMO');
    expect(answer).not.toContain('**');
  });

  it('builds a short fallback without workflow or agent dumps', () => {
    const answer = buildFallbackSummary([], presentEvidence(evidence));
    expect(answer).toContain('Kết quả tổng hợp');
    expect(answer).toContain('[1]');
    expect(answer).not.toMatch(/Planner|A002|coreDependencies|PROC-DEMO/);
  });

  it('detects workflow/json traces that must not reach the user', () => {
    expect(hasExecutionTrace('{"requestedTasks":[{"agentId":"A002"}]}')).toBe(true);
    expect(hasExecutionTrace('Kết luận cuối: hồ sơ cần bổ sung báo cáo tài chính.')).toBe(false);
  });
});
