/**
 * EXPLAINER_MODE=llm — TẠM THỜI. Gọi LLM ngoài (OpenAI-compatible) để diễn đạt bảng
 * tiêu chí đã chấm thành câu cho sale đọc qua điện thoại.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TOÀN BỘ FILE NÀY LÀ CODE TẠM. Khi có model riêng:
 *   1. Đặt EXPLAINER_MODE=model + EXTERNAL_MODEL_URL trong .env
 *   2. Hiện thực ModelExplainer.explain()
 *   3. Xoá file này + gỡ khỏi assessment.module.ts
 * Không có chỗ nào khác trong codebase gọi LLM trực tiếp cho chức năng đánh giá.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Ràng buộc an toàn:
 * - Chỉ gửi dữ liệu ĐÃ CHE PII (mã tham chiếu, không tên/CIF/số điện thoại).
 * - Mọi con số trong câu phải nằm trong `evidence`; số lạ bị chặn ở postCheck (tương đương
 *   V2 của validator trong BUILD_SPEC: số trong hook chỉ được lấy từ slots_used).
 * - LLM hỏng thì trả degradedReason, KHÔNG ném lỗi — sale vẫn phải xem được bảng tiêu chí.
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppEnvironment } from '../../../../config/env.validation';
import type { AssessmentExplainer, ExplainInput, ExplainOutput } from './explainer.interface';

/** Cấm hứa hẹn tuyệt đối — tương đương nhóm CAM_KET của validator. */
const FORBIDDEN = /(cam kết|chắc chắn|đảm bảo|100%|tuyệt đối|bao đậu|duyệt ngay)/i;
const TIMEOUT_MS = 8_000;

@Injectable()
export class LlmExplainer implements AssessmentExplainer {
  readonly mode = 'llm' as const;
  private readonly logger = new Logger(LlmExplainer.name);
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;

  constructor(config: ConfigService<AppEnvironment, true>) {
    this.apiKey = config.get('LLM_API_KEY', { infer: true }) ?? '';
    this.baseUrl = config.get('LLM_BASE_URL', { infer: true });
    this.model = config.get('LLM_MODEL', { infer: true });
  }

  async explain(input: ExplainInput): Promise<ExplainOutput> {
    const top = input.top[0];
    if (!top) return { narrative: null, degradedReason: 'Không có gói nào đủ điều kiện' };

    const prompt = this.buildPrompt(input, top.product, top.package);

    try {
      const narrative = await this.call(prompt);
      const rejected = this.postCheck(narrative, input.evidence);
      if (rejected) {
        this.logger.warn(`Lời giải thích bị từ chối: ${rejected}`);
        return { narrative: null, degradedReason: rejected };
      }
      return { narrative, degradedReason: null };
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'lỗi không xác định';
      this.logger.warn(`Gọi LLM thất bại: ${reason}`);
      return { narrative: null, degradedReason: `Không gọi được LLM: ${reason}` };
    }
  }

  private buildPrompt(input: ExplainInput, product: string, pkg: string): string {
    return [
      'Bạn viết gợi ý cho nhân viên bán hàng ngân hàng SHB gọi điện tư vấn khách.',
      `Khách tham chiếu: ${input.ref}. Sản phẩm gợi ý: ${product} — gói "${pkg}".`,
      '',
      'Căn cứ đã được hệ thống kiểm tra (chỉ dùng đúng những con số này, không tự thêm số nào khác):',
      ...input.evidence.map((e) => `- ${e}`),
      '',
      'Viết 2-3 câu tiếng Việt, giọng tự nhiên, cho nhân viên đọc qua điện thoại.',
      'Tuyệt đối không hứa hẹn chắc chắn, không dùng từ "cam kết"/"đảm bảo"/"100%".',
      'Không bịa thêm số liệu. Chỉ trả về đoạn văn, không thêm tiêu đề hay giải thích.',
    ].join('\n');
  }

  private async call(prompt: string): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.4,
          max_tokens: 300,
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = data.choices?.[0]?.message?.content?.trim();
      if (!text) throw new Error('phản hồi rỗng');
      return text;
    } finally {
      clearTimeout(timer);
    }
  }

  /** Trả về lý do từ chối, hoặc null nếu đạt. */
  private postCheck(text: string, evidence: string[]): string | null {
    if (FORBIDDEN.test(text)) return 'Lời giải thích chứa từ ngữ hứa hẹn bị cấm';

    // V2: mọi số xuất hiện trong câu phải truy được về evidence.
    const allowed = new Set(
      evidence.flatMap((e) => e.match(/[\d.,]+/g) ?? []).map((n) => n.replace(/[.,]/g, '')),
    );
    const used = (text.match(/[\d.,]+/g) ?? []).map((n) => n.replace(/[.,]/g, ''));
    const invented = used.filter((n) => n.length > 1 && !allowed.has(n));
    if (invented.length > 0) {
      return `Lời giải thích chứa số liệu không có trong căn cứ: ${invented.join(', ')}`;
    }
    return null;
  }
}
