import type { AgentPlanTask, AgentResult, RunEvent } from '@startflow/contracts';
import { buildAgentLaneView } from './agent-lane.component';
import { extractCitations, extractToolEvents } from './evidence-panel.component';
import { buildTimelineItems } from './timeline.component';

describe('run workspace presenters', () => {
  it('derives active, failed and accessible lane state from plan, result and events', () => {
    const task = planTask('CREDIT');
    const active = buildAgentLaneView(task, null, [runEvent(1, 'agent.started', 'CREDIT')]);

    expect(active.status).toBe('RUNNING');
    expect(active.isActive).toBeTrue();
    expect(active.accessibleLabel).toContain('Tín dụng');
    expect(active.accessibleLabel).toContain('Đang xử lý');

    const failed = buildAgentLaneView(task, agentResult('CREDIT', 'FAILED'), [
      runEvent(1, 'agent.started', 'CREDIT'),
    ]);
    expect(failed.isFailed).toBeTrue();
    expect(failed.summary).toBe('Không thể hoàn tất phân tích');
    expect(failed.confidenceDisplay).toBe('25%');
  });

  it('sorts timeline events and maps public event types to Vietnamese labels', () => {
    const items = buildTimelineItems([
      runEvent(3, 'agent.completed', 'CREDIT'),
      runEvent(1, 'run.started', null),
      runEvent(2, 'tool.completed', 'CREDIT'),
    ]);

    expect(items.map((item) => item.sequence)).toEqual([1, 2, 3]);
    expect(items.map((item) => item.title)).toEqual([
      'Bắt đầu lượt đánh giá',
      'Công cụ hoàn tất',
      'Chuyên gia hoàn tất',
    ]);
    expect(items[1]?.source).toBe('Tín dụng');
  });

  it('deduplicates citations and extracts direct or nested tool event payloads', () => {
    const citedResult = agentResult('COMPLIANCE', 'COMPLETED');
    citedResult.findings = [
      {
        code: 'KYC_OK',
        severity: 'INFO',
        title: 'KYC hợp lệ',
        detail: 'Không có cảnh báo.',
        citations: [citation('citation-1')],
      },
    ];
    const events = [
      runEvent(1, 'citation.added', 'COMPLIANCE', { citation: citation('citation-1') }),
      runEvent(2, 'citation.added', 'COMPLIANCE', citation('citation-2')),
      runEvent(3, 'tool.completed', 'COMPLIANCE', { tool: toolData('mock_kyc_aml') }),
      runEvent(4, 'tool.completed', 'CREDIT', toolData('financial_calculator')),
    ];

    expect(extractCitations([citedResult], events).map((item) => item.id)).toEqual([
      'citation-1',
      'citation-2',
    ]);
    expect(extractToolEvents(events).map((item) => item.toolName)).toEqual([
      'mock_kyc_aml',
      'financial_calculator',
    ]);
  });
});

function planTask(agent: AgentPlanTask['agent']): AgentPlanTask {
  return {
    id: `task-${agent.toLowerCase()}`,
    agent,
    title: 'Phân tích hồ sơ',
    objective: 'Xác định mức độ rủi ro',
    dependencies: [],
    successCriteria: ['Có kết luận và bằng chứng'],
    status: 'RUNNING',
  };
}

function agentResult(agent: AgentResult['agent'], status: AgentResult['status']): AgentResult {
  return {
    agent,
    status,
    summary: status === 'FAILED' ? 'Không thể hoàn tất phân tích' : 'Đã hoàn tất phân tích',
    confidence: 0.25,
    findings: [],
    toolNames: [],
    errorCode: status === 'FAILED' ? 'TOOL_FAILED' : null,
  };
}

function runEvent(
  sequence: number,
  type: RunEvent['type'],
  agent: RunEvent['agent'],
  payload: Record<string, unknown> = {},
): RunEvent {
  return {
    id: `00000000-0000-4000-8000-${sequence.toString().padStart(12, '0')}`,
    runId: '10000000-0000-4000-8000-000000000000',
    sequence,
    type,
    agent,
    occurredAt: `2026-07-18T00:00:0${sequence}.000Z`,
    correlationId: '30000000-0000-4000-8000-000000000000',
    idempotencyKey: `event-${sequence.toString().padStart(3, '0')}`,
    payload,
  };
}

function citation(id: string) {
  return {
    id,
    documentId: `doc-${id}`,
    documentTitle: 'Chính sách tín dụng SME',
    section: 'Khả năng trả nợ',
    chunkId: `chunk-${id}`,
    excerpt: 'Doanh nghiệp phải duy trì hệ số thanh toán tối thiểu.',
    relevanceScore: 0.91,
  };
}

function toolData(toolName: 'mock_kyc_aml' | 'financial_calculator') {
  return {
    toolName,
    latencyMs: 120,
    inputSummary: { caseId: 'case-1' },
    outputSummary: { outcome: 'ok' },
  };
}
