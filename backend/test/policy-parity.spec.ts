/**
 * Chốt chặn cho vấn đề trùng lặp logic: R1..R12 tồn tại ở CẢ HAI nơi —
 *   - gốc:  apps/ai/src/ranker/rules.py + apps/ai/src/core/config.py  (Python)
 *   - bản sao: backend/src/modules/nba/assessment/policy.service.ts     (TypeScript)
 *
 * Test này đọc thẳng file Python và so ngưỡng với RULE_PARAMS bên TS.
 * Ai sửa một bên mà quên bên kia thì test đỏ ngay, thay vì lệch âm thầm tới lúc chạy thật.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { RULE_PARAMS } from '../src/modules/nba/assessment/policy.service';

const AI_ROOT = join(__dirname, '..', '..', 'apps', 'ai', 'src');

function readPy(relative: string): string {
  return readFileSync(join(AI_ROOT, relative), 'utf8');
}

describe('Đồng bộ ngưỡng rule giữa TypeScript và Python', () => {
  it('R6 contact_cooldown_d khớp core/config.py', () => {
    const config = readPy(join('core', 'config.py'));
    const match = /contact_cooldown_d:\s*int\s*=\s*(\d+)/.exec(config);

    expect(match).not.toBeNull();
    expect(Number(match![1])).toBe(RULE_PARAMS.contactCooldownDays);
  });

  it('R3 ngưỡng DTI khớp ranker/rules.py', () => {
    const rules = readPy(join('ranker', 'rules.py'));
    // r3_dti_high: `if dti is not None and dti > 0.6:`
    const match = /def r3_dti_high[\s\S]*?dti\s*>\s*([\d.]+)/.exec(rules);

    expect(match).not.toBeNull();
    expect(Number(match![1])).toBe(RULE_PARAMS.dtiMax);
  });

  it('R1 ngưỡng nhóm CIC khớp ranker/rules.py', () => {
    const rules = readPy(join('ranker', 'rules.py'));
    // r1_cic_bad: `if ctx.cic_group >= 2:`
    const match = /def r1_cic_bad[\s\S]*?cic_group\s*>=\s*(\d+)/.exec(rules);

    expect(match).not.toBeNull();
    expect(Number(match![1])).toBe(RULE_PARAMS.cicBlockFrom);
  });

  it('R11 hệ số bảo hiểm nơi khác khớp ranker/rules.py', () => {
    const rules = readPy(join('ranker', 'rules.py'));
    // r11_has_insurance_elsewhere: `multiplier=0.5`
    const match = /def r11_has_insurance_elsewhere[\s\S]*?multiplier=([\d.]+)/.exec(rules);

    expect(match).not.toBeNull();
    expect(Number(match![1])).toBe(RULE_PARAMS.insuranceElsewhereMultiplier);
  });
});
