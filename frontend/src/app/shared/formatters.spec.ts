import { formatCurrency, formatDateTime, formatPercent } from './formatters';

describe('formatters', () => {
  it('formats VND currency using Vietnamese separators', () => {
    const result = formatCurrency(1_500_000);
    expect(result).toContain('1.500.000');
    expect(result).toContain('₫');
  });

  it('formats percentages from fractional values', () => {
    expect(formatPercent(0.756)).toContain('76');
  });

  it('formats dates in a deterministic portal timezone', () => {
    expect(formatDateTime('2026-07-18T00:30:00.000Z')).toContain('18/7/2026');
  });

  it('returns an em dash for invalid date input', () => {
    expect(formatDateTime('not-a-date')).toBe('—');
  });
});
