/**
 * Chọn explainer theo EXPLAINER_MODE. Đây là chỗ DUY NHẤT quyết định nhánh nào được nạp —
 * đổi mode trong .env là xong, không phải sửa service hay UI.
 *
 * Khi có model riêng: đặt EXPLAINER_MODE=model, rồi xoá LlmExplainer khỏi providers
 * và xoá file llm.explainer.ts.
 */
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppEnvironment } from '../../../config/env.validation';
import { PrismaModule } from '../../../database/prisma.module';
import { AssessmentService } from './assessment.service';
import { PolicyService } from './policy.service';
import { WindowsService } from './windows.service';
import { ASSESSMENT_EXPLAINER, type AssessmentExplainer } from './explainer/explainer.interface';
import { LlmExplainer } from './explainer/llm.explainer';
import { ModelExplainer } from './explainer/model.explainer';
import { RulesExplainer } from './explainer/rules.explainer';

@Module({
  imports: [PrismaModule],
  providers: [
    AssessmentService,
    WindowsService,
    PolicyService,
    {
      provide: ASSESSMENT_EXPLAINER,
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppEnvironment, true>): AssessmentExplainer => {
        const mode = config.get('EXPLAINER_MODE', { infer: true });
        if (mode === 'llm') return new LlmExplainer(config);
        if (mode === 'model') return new ModelExplainer(config);
        return new RulesExplainer();
      },
    },
  ],
  exports: [AssessmentService],
})
export class AssessmentModule {}
