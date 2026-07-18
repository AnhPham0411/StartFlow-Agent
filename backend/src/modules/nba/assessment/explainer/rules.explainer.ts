/**
 * EXPLAINER_MODE=rules — không gọi LLM.
 * Luôn dùng được, không tốn key, kết quả tái lập 100%. Đây là mức nền: mọi mode khác
 * đều dựng trên chuỗi bằng chứng này, nên tắt LLM thì chức năng vẫn đầy đủ ý nghĩa.
 */
import { Injectable } from '@nestjs/common';

import type { AssessmentExplainer, ExplainInput, ExplainOutput } from './explainer.interface';

@Injectable()
export class RulesExplainer implements AssessmentExplainer {
  readonly mode = 'rules' as const;

  // eslint-disable-next-line @typescript-eslint/require-await
  async explain(_input: ExplainInput): Promise<ExplainOutput> {
    // Chuỗi bằng chứng đã do AssessmentService dựng sẵn; mode này không thêm gì.
    return { narrative: null, degradedReason: null };
  }
}
