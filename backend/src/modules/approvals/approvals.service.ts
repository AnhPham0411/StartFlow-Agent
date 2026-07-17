import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ApprovalDecision, ApprovalState, Prisma, RunStatus } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import {
  ActionTicketsService,
  type ProposedAction,
} from '../action-tickets/action-tickets.service';
import { AuditService } from '../audit/audit.service';
import type { CreateApprovalDto } from './dto/create-approval.dto';

@Injectable()
export class ApprovalsService {
  constructor(
    private readonly actionTickets: ActionTicketsService,
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
  ) {}

  async decide(
    runId: string,
    input: CreateApprovalDto,
    actorSubject: string,
    correlationId: string,
  ) {
    try {
      return await this.prisma.$transaction(
        async (transaction) => {
          const run = await transaction.workflowRun.findUnique({
            where: { id: runId },
            include: { approval: true },
          });
          if (!run) throw new NotFoundException('Run not found');
          if (run.approval || run.approvalState !== ApprovalState.PENDING) {
            throw new ConflictException('Run is not awaiting approval');
          }
          if (run.version !== input.expectedVersion) {
            throw new ConflictException(`Run version is ${run.version}`);
          }

          const changed = await transaction.workflowRun.updateMany({
            where: {
              approvalState: ApprovalState.PENDING,
              id: runId,
              version: input.expectedVersion,
            },
            data: {
              approvalState:
                input.decision === 'APPROVE' ? ApprovalState.APPROVED : ApprovalState.REJECTED,
              status: RunStatus.COMPLETED,
              version: { increment: 1 },
            },
          });
          if (changed.count !== 1) throw new ConflictException('Run was approved concurrently');

          const approval = await transaction.approval.create({
            data: {
              actorSubject,
              decision:
                input.decision === 'APPROVE' ? ApprovalDecision.APPROVE : ApprovalDecision.REJECT,
              reason: input.reason.trim(),
              runId,
              runVersion: input.expectedVersion + 1,
            },
          });

          let actionTicket = null;
          if (input.decision === 'APPROVE') {
            const proposal = this.extractProposedAction(run.decision);
            if (!proposal) throw new ConflictException('Run has no valid proposed action');
            actionTicket = await this.actionTickets.createApprovedTicket(transaction, {
              approvalId: approval.id,
              proposal,
              runId,
            });
          }

          await this.audit.appendWith(transaction, {
            action: input.decision === 'APPROVE' ? 'approval.approved' : 'approval.rejected',
            actorSubject,
            correlationId,
            entityId: runId,
            entityType: 'run',
            payload: { actionTicketId: actionTicket?.id ?? null, reason: input.reason },
          });
          return { actionTicket, approval, version: input.expectedVersion + 1 };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ['P2002', 'P2034'].includes(error.code)
      ) {
        throw new ConflictException('Run was approved concurrently');
      }
      throw error;
    }
  }

  private extractProposedAction(decision: Prisma.JsonValue | null): ProposedAction | undefined {
    if (!decision || Array.isArray(decision) || typeof decision !== 'object') return undefined;
    const proposed = decision.proposedAction;
    if (!proposed || Array.isArray(proposed) || typeof proposed !== 'object') return undefined;
    if (
      proposed.type !== 'CREATE_ACTION_TICKET' ||
      typeof proposed.title !== 'string' ||
      typeof proposed.description !== 'string'
    ) {
      return undefined;
    }
    return { description: proposed.description, title: proposed.title, type: proposed.type };
  }
}
