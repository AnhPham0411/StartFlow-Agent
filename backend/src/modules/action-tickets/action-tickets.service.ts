import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export interface ProposedAction {
  description: string;
  title: string;
  type: 'CREATE_ACTION_TICKET';
}

@Injectable()
export class ActionTicketsService {
  createApprovedTicket(
    transaction: Prisma.TransactionClient,
    input: { approvalId: string; proposal: ProposedAction; runId: string },
  ) {
    return transaction.actionTicket.create({
      data: {
        approvalId: input.approvalId,
        description: input.proposal.description,
        runId: input.runId,
        title: input.proposal.title,
      },
    });
  }
}
