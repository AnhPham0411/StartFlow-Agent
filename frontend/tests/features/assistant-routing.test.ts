import { describe, expect, it } from 'vitest';
import {
  catalogSummary,
  planAssistantRequest,
  requiresHumanApproval,
} from '@/src/lib/assistant-routing';

describe('assistant routing', () => {
  it('uses the canonical 128-agent, 16-domain catalog', () => {
    expect(catalogSummary()).toEqual({ agents: 128, domains: 16 });
  });

  it('keeps orchestration agents and selects document specialists for a KYC upload', () => {
    const tasks = planAssistantRequest('Kiểm tra hồ sơ KYC, OCR CCCD và phát hiện giấy tờ bất thường', [
      {
        name: 'cccd-khach-hang.pdf',
        size: 42_000,
        type: 'application/pdf',
        readableText: false,
      },
    ]);

    expect(tasks.slice(0, 3).map((task) => task.agentId)).toEqual(['A002', 'A003', 'A004']);
    expect(tasks.some((task) => ['A029', 'A050', 'A051', 'A055'].includes(task.agentId))).toBe(true);
  });

  it('routes suspicious payment analysis to payment or fraud agents', () => {
    const tasks = planAssistantRequest(
      'Phân tích file giao dịch chuyển khoản và tìm dấu hiệu gian lận, AML đáng ngờ',
      [{ name: 'transactions.csv', size: 2_400, type: 'text/csv', readableText: true }],
    );

    expect(tasks.some((task) => ['Payments Cards', 'Fraud AML'].includes(task.domain))).toBe(true);
  });

  it('uses a minimal read-only policy workflow without approval', () => {
    const tasks = planAssistantRequest(
      'Hướng dẫn tôi cách kiểm tra hồ sơ KYC theo chính sách công ty',
      [],
    );

    expect(tasks.length).toBeLessThanOrEqual(2);
    expect(tasks.some((task) => task.agentId === 'A026')).toBe(true);
    expect(tasks.every((task) => !task.approvalRequired)).toBe(true);
  });

  it('keeps a long read-only analytics question to one triage and one specialist', () => {
    const tasks = planAssistantRequest(
      'Tổng quan pipeline NBA và sàng lọc khách hàng tiềm năng. Chỉ phân tích read-only, giải thích tiêu chí và nêu dẫn chứng.',
      [],
    );
    expect(tasks.length).toBe(2);
    expect(tasks[0]?.agentId).toBe('A002');
    expect(tasks.every((task) => !task.approvalRequired)).toBe(true);
  });

  it('requires approval for explicit high-impact execution, not advice', () => {
    expect(requiresHumanApproval('Hãy phê duyệt khoản vay SME 4 tỷ ngay')).toBe(true);
    expect(requiresHumanApproval('Hướng dẫn quy trình phê duyệt khoản vay SME')).toBe(false);
    expect(requiresHumanApproval('Phân tích hồ sơ và nêu điểm cần phê duyệt')).toBe(false);
    const execution = planAssistantRequest('Hãy phê duyệt khoản vay SME 4 tỷ ngay', []);
    expect(execution.some((task) => task.status === 'awaiting_approval')).toBe(true);
  });
});
