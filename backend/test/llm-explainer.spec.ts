/**
 * LlmExplainer là code TẠM nhưng nó nói chuyện với khách qua miệng sale, nên phần chặn
 * phải có test: không được bịa số, không được hứa hẹn, và hỏng thì phải degrade êm.
 */
import type { ConfigService } from '@nestjs/config';

import type { AppEnvironment } from '../src/config/env.validation';
import { LlmExplainer } from '../src/modules/nba/assessment/explainer/llm.explainer';
import type { ExplainInput } from '../src/modules/nba/assessment/explainer/explainer.interface';

const config = {
  get: jest.fn((key: keyof AppEnvironment) => {
    if (key === 'LLM_API_KEY') return 'test-key';
    if (key === 'LLM_BASE_URL') return 'https://llm.example.test/v1';
    if (key === 'LLM_MODEL') return 'gpt-4o-mini';
    return '';
  }),
} as unknown as ConfigService<AppEnvironment, true>;

const input = {
  customerId: 262,
  ref: 'KH-000262',
  top: [{ product: 'the', package: 'Cashback Platinum', tier: 'Silver', eligible: true, criteria: [], multiplier: 1, blocked_by: [] }],
  current: {} as ExplainInput['current'],
  window3m: {} as ExplainInput['window3m'],
  window6m: {} as ExplainInput['window6m'],
  trend: {} as ExplainInput['trend'],
  evidence: ['Số dư tài khoản hiện tại: 191.592.605 đ', 'Nhóm nợ CIC: nhóm 1'],
} as ExplainInput;

function mockLlmReply(content: string) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ choices: [{ message: { content } }] }),
  }) as unknown as typeof fetch;
}

describe('LlmExplainer — chặn nội dung không an toàn', () => {
  beforeEach(() => jest.clearAllMocks());

  it('nhận câu chỉ dùng số có trong evidence', async () => {
    mockLlmReply('Anh/chị đang có số dư 191.592.605 đ, rất phù hợp gói thẻ hoàn tiền.');
    const result = await new LlmExplainer(config).explain(input);

    expect(result.narrative).toContain('191.592.605');
    expect(result.degradedReason).toBeNull();
  });

  it('từ chối câu chứa số KHÔNG có trong evidence', async () => {
    mockLlmReply('Gói này hoàn tiền tới 8.500.000 đ mỗi năm cho anh/chị.');
    const result = await new LlmExplainer(config).explain(input);

    expect(result.narrative).toBeNull();
    expect(result.degradedReason).toMatch(/không có trong căn cứ/);
  });

  it('từ chối câu hứa hẹn tuyệt đối', async () => {
    mockLlmReply('Chúng tôi cam kết anh/chị sẽ được duyệt ngay trong hôm nay.');
    const result = await new LlmExplainer(config).explain(input);

    expect(result.narrative).toBeNull();
    expect(result.degradedReason).toMatch(/hứa hẹn/);
  });

  it('LLM lỗi thì degrade êm, không ném lỗi', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED')) as unknown as typeof fetch;
    const result = await new LlmExplainer(config).explain(input);

    expect(result.narrative).toBeNull();
    expect(result.degradedReason).toContain('ECONNREFUSED');
  });

  it('không có gói nào đủ điều kiện thì không gọi LLM', async () => {
    mockLlmReply('không nên được gọi');
    const result = await new LlmExplainer(config).explain({ ...input, top: [] });

    expect(global.fetch).not.toHaveBeenCalled();
    expect(result.narrative).toBeNull();
  });
});
