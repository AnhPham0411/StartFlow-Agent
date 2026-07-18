/**
 * EXPLAINER_MODE=model — chỗ cắm model riêng khi có.
 *
 * Bật mode này là nhánh LLM tạm (llm.explainer.ts) không còn được nạp nữa.
 * Hợp đồng vào/ra giữ nguyên `ExplainInput` → `ExplainOutput`, nên chỉ cần map phản hồi
 * của model về `narrative` là xong, không phải sửa gì ở service hay UI.
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppEnvironment } from '../../../../config/env.validation';
import type { AssessmentExplainer, ExplainInput, ExplainOutput } from './explainer.interface';

@Injectable()
export class ModelExplainer implements AssessmentExplainer {
  readonly mode = 'model' as const;
  private readonly logger = new Logger(ModelExplainer.name);
  private readonly endpoint: string;

  constructor(config: ConfigService<AppEnvironment, true>) {
    this.endpoint = config.get('EXTERNAL_MODEL_URL', { infer: true }) ?? '';
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async explain(_input: ExplainInput): Promise<ExplainOutput> {
    // Chưa hiện thực: trả degraded thay vì ném lỗi, để bảng tiêu chí vẫn hiển thị được.
    this.logger.warn(`EXPLAINER_MODE=model chưa được hiện thực (endpoint: ${this.endpoint})`);
    return {
      narrative: null,
      degradedReason:
        'EXPLAINER_MODE=model: chưa map phản hồi model riêng sang narrative. ' +
        'Hiện thực ModelExplainer.explain() để bật.',
    };
  }
}
