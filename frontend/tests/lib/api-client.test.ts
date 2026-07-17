import { afterEach, describe, expect, it, vi } from 'vitest';
import { StartFlowApi } from '@/src/lib/api-client';

describe('StartFlowApi', () => {
  afterEach(() => vi.restoreAllMocks());

  it('adds an in-memory bearer token and unwraps collection envelopes', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            items: [
              {
                id: 'case-1',
                companyName: 'Demo',
                latestRun: {
                  createdAt: '2026-07-17T10:00:00.000Z',
                  id: 'run-1',
                  status: 'AWAITING_APPROVAL',
                },
                runCount: 2,
              },
            ],
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    const api = new StartFlowApi(async () => 'ephemeral-token');
    await expect(api.listCases()).resolves.toEqual([
      expect.objectContaining({
        id: 'case-1',
        companyName: 'Demo',
        latestRun: expect.objectContaining({ id: 'run-1', status: 'AWAITING_APPROVAL' }),
        runCount: 2,
      }),
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/cases'),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer ephemeral-token' }),
      }),
    );
  });
});
