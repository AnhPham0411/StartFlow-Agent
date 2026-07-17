import { ConflictException } from '@nestjs/common';
import { ApprovalState, RunStatus } from '@prisma/client';

import { ApprovalsService } from '../src/modules/approvals/approvals.service';

const run = {
  approval: null,
  approvalState: ApprovalState.PENDING,
  decision: {
    proposedAction: {
      description: 'Collect the missing demo document',
      title: 'Complete demo loan dossier',
      type: 'CREATE_ACTION_TICKET',
    },
  },
  id: '2204e944-bf3d-48fa-b613-a226124dc9b8',
  version: 0,
};

function harness(updatedCount: number) {
  const transaction = {
    approval: { create: jest.fn().mockResolvedValue({ id: 'approval-id' }) },
    workflowRun: {
      findUnique: jest.fn().mockResolvedValue(run),
      updateMany: jest.fn().mockResolvedValue({ count: updatedCount }),
    },
  };
  const prisma = {
    $transaction: jest.fn((callback: (client: typeof transaction) => unknown) =>
      callback(transaction),
    ),
  };
  const actionTickets = {
    createApprovedTicket: jest.fn().mockResolvedValue({ id: 'ticket-id' }),
  };
  const audit = { appendWith: jest.fn().mockResolvedValue({}) };
  const service = new ApprovalsService(actionTickets as never, audit as never, prisma as never);
  return { actionTickets, audit, service, transaction };
}

describe('human approval concurrency', () => {
  it('creates exactly one action ticket after a successful optimistic update', async () => {
    const { actionTickets, audit, service, transaction } = harness(1);

    await expect(
      service.decide(
        run.id,
        { decision: 'APPROVE', expectedVersion: 0, reason: 'Demo evidence has been reviewed' },
        'approver-subject',
        '3bbcee9d-78f0-43ea-b878-3d31c07cf86e',
      ),
    ).resolves.toEqual({
      actionTicket: { id: 'ticket-id' },
      approval: { id: 'approval-id' },
      version: 1,
    });
    expect(transaction.workflowRun.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          approvalState: ApprovalState.APPROVED,
          status: RunStatus.COMPLETED,
        }),
      }),
    );
    expect(actionTickets.createApprovedTicket).toHaveBeenCalledTimes(1);
    expect(audit.appendWith).toHaveBeenCalledTimes(1);
  });

  it('returns conflict and creates no approval or ticket when another actor wins', async () => {
    const { actionTickets, service, transaction } = harness(0);

    await expect(
      service.decide(
        run.id,
        { decision: 'APPROVE', expectedVersion: 0, reason: 'Demo evidence has been reviewed' },
        'approver-subject',
        '3bbcee9d-78f0-43ea-b878-3d31c07cf86e',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(transaction.approval.create).not.toHaveBeenCalled();
    expect(actionTickets.createApprovedTicket).not.toHaveBeenCalled();
  });
});
