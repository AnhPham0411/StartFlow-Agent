import { describe, expect, it } from 'vitest';
import { parseSseFrames } from '@/src/lib/sse-client';

describe('parseSseFrames', () => {
  it('parses id, event and multiline data while preserving a partial frame', () => {
    const parsed = parseSseFrames(
      'id: 4\r\nevent: tool.completed\r\ndata: {"part":\r\ndata: true}\r\n\r\nid: 5\ndata: pending',
    );
    expect(parsed.frames).toEqual([{ id: '4', event: 'tool.completed', data: '{"part":\ntrue}' }]);
    expect(parsed.remainder).toBe('id: 5\ndata: pending');
  });

  it('ignores comments and frames without data', () => {
    expect(parseSseFrames(': heartbeat\n\nid: 2\n\n').frames).toEqual([]);
  });
});
