import type { RunEvent } from '@prisma/client';
import { firstValueFrom } from 'rxjs';

import { EventStreamService } from '../src/modules/events/event-stream.service';

const persistedEvent = {
  agent: null,
  correlationId: '3bbcee9d-78f0-43ea-b878-3d31c07cf86e',
  createdAt: new Date('2026-07-17T10:00:00.000Z'),
  id: '9efcc432-f147-454f-97e2-137b62cc24df',
  idempotencyKey: 'event-key-0002',
  occurredAt: new Date('2026-07-17T10:00:00.000Z'),
  payload: { summary: 'Planner created a plan' },
  runId: '2204e944-bf3d-48fa-b613-a226124dc9b8',
  sequence: 2,
  type: 'plan.created',
} as RunEvent;

describe('resumable event streaming', () => {
  it('replays only persisted events after Last-Event-ID using sequence as SSE ID', async () => {
    const prisma = { runEvent: { findMany: jest.fn().mockResolvedValue([persistedEvent]) } };
    const service = new EventStreamService(prisma as never);

    const message = await firstValueFrom(service.stream(persistedEvent.runId, 1));

    expect(prisma.runEvent.findMany).toHaveBeenCalledWith({
      where: { runId: persistedEvent.runId, sequence: { gt: 1 } },
      orderBy: { sequence: 'asc' },
    });
    expect(message.id).toBe('2');
    expect(message.type).toBe('plan.created');
  });

  it('releases the in-memory channel after a terminal event', () => {
    const prisma = { runEvent: { findMany: jest.fn() } };
    const service = new EventStreamService(prisma as never);
    const terminal = { ...persistedEvent, type: 'run.completed' } as RunEvent;

    service.publish(terminal);

    const channels = (service as unknown as { channels: Map<string, unknown> }).channels;
    expect(channels.size).toBe(0);
  });
});
