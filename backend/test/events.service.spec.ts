import { ConflictException } from '@nestjs/common';
import { RunStatus } from '@prisma/client';

import { EventsService } from '../src/modules/events/events.service';

const eventInput = {
  agent: null,
  correlationId: '3bbcee9d-78f0-43ea-b878-3d31c07cf86e',
  id: '9efcc432-f147-454f-97e2-137b62cc24df',
  idempotencyKey: 'run-started:demo',
  occurredAt: '2026-07-17T10:00:00.000Z',
  payload: { authorization: 'private', summary: 'Run started' },
  runId: '2204e944-bf3d-48fa-b613-a226124dc9b8',
  sequence: 1,
  type: 'run.started' as const,
};

function harness(advancedCount: number, duplicate = false) {
  const created = {
    ...eventInput,
    agent: null,
    createdAt: new Date(eventInput.occurredAt),
    occurredAt: new Date(eventInput.occurredAt),
    payload: { authorization: '[REDACTED]', summary: 'Run started' },
  };
  const transaction = {
    agentTask: { updateMany: jest.fn(), upsert: jest.fn() },
    runEvent: {
      create: jest.fn().mockResolvedValue(created),
      findUnique: jest.fn().mockResolvedValue(duplicate ? created : null),
    },
    workflowRun: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ approvalState: 'NONE', id: eventInput.runId, lastEventSequence: 0 }),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: advancedCount }),
    },
  };
  const prisma = {
    $transaction: jest.fn((callback: (client: typeof transaction) => unknown) =>
      callback(transaction),
    ),
  };
  const audit = { appendWith: jest.fn().mockResolvedValue({}) };
  const stream = { publish: jest.fn() };
  const service = new EventsService(audit as never, prisma as never, stream as never);
  return { audit, created, service, stream, transaction };
}

describe('persisting callback events', () => {
  it('atomically advances sequence, redacts payload and publishes only after persistence', async () => {
    const { audit, created, service, stream, transaction } = harness(1);

    await expect(service.record(eventInput)).resolves.toEqual(created);
    expect(transaction.workflowRun.update).toHaveBeenCalledWith({
      where: { id: eventInput.runId },
      data: { startedAt: new Date(eventInput.occurredAt), status: RunStatus.RUNNING },
    });
    const persistedPayload = transaction.runEvent.create.mock.calls[0]?.[0]?.data.payload;
    expect(persistedPayload).toEqual({ authorization: '[REDACTED]', summary: 'Run started' });
    expect(audit.appendWith).toHaveBeenCalledTimes(1);
    expect(stream.publish).toHaveBeenCalledWith(created);
  });

  it('rejects an out-of-order sequence before inserting an event', async () => {
    const { service, stream, transaction } = harness(0);

    await expect(service.record(eventInput)).rejects.toBeInstanceOf(ConflictException);
    expect(transaction.runEvent.create).not.toHaveBeenCalled();
    expect(stream.publish).not.toHaveBeenCalled();
  });

  it('rejects a duplicate idempotency key before advancing sequence', async () => {
    const { service, transaction } = harness(1, true);

    await expect(service.record(eventInput)).rejects.toBeInstanceOf(ConflictException);
    expect(transaction.workflowRun.updateMany).not.toHaveBeenCalled();
    expect(transaction.runEvent.create).not.toHaveBeenCalled();
  });
});
