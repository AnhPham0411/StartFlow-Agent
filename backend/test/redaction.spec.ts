import { redactPublicPayload } from '../src/common/logging/redaction';

describe('public payload redaction', () => {
  it('removes nested credentials and private reasoning while preserving filtered summaries', () => {
    const result = redactPublicPayload({
      authorization: 'Bearer private',
      inputSummary: { company: 'DEMO_DATA', password: 'private' },
      message: 'upstream returned Bearer header.payload.signature',
      outputSummary: { status: 'ok' },
      trace: [{ chainOfThought: 'private reasoning', finding: 'missing document' }],
    });

    expect(result).toEqual({
      authorization: '[REDACTED]',
      inputSummary: { company: 'DEMO_DATA', password: '[REDACTED]' },
      message: 'upstream returned Bearer [REDACTED]',
      outputSummary: { status: 'ok' },
      trace: [{ chainOfThought: '[REDACTED]', finding: 'missing document' }],
    });
  });
});
