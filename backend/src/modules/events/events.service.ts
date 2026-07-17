import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  AgentKind,
  AgentTaskStatus,
  ApprovalState,
  Prisma,
  RunMode,
  RunStatus,
  type RunEvent,
} from '@prisma/client';

import { redactPublicPayload } from '../../common/logging/redaction';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { RecordEventDto } from './dto/record-event.dto';
import { EventStreamService } from './event-stream.service';

@Injectable()
export class EventsService {
  constructor(
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
    private readonly stream: EventStreamService,
  ) {}

  async record(input: RecordEventDto): Promise<RunEvent> {
    const payload = redactPublicPayload(input.payload);
    try {
      const event = await this.prisma.$transaction(
        async (transaction) => {
          const run = await transaction.workflowRun.findUnique({ where: { id: input.runId } });
          if (!run) throw new NotFoundException('Run not found');

          const duplicate = await transaction.runEvent.findUnique({
            where: {
              runId_idempotencyKey: { idempotencyKey: input.idempotencyKey, runId: input.runId },
            },
          });
          if (duplicate) throw new ConflictException('Duplicate callback idempotency key');

          const advanced = await transaction.workflowRun.updateMany({
            where: { id: input.runId, lastEventSequence: input.sequence - 1 },
            data: { lastEventSequence: input.sequence },
          });
          if (advanced.count !== 1) {
            throw new ConflictException(`Expected event sequence ${run.lastEventSequence + 1}`);
          }

          const created = await transaction.runEvent.create({
            data: {
              agent: input.agent ?? null,
              correlationId: input.correlationId,
              id: input.id,
              idempotencyKey: input.idempotencyKey,
              occurredAt: new Date(input.occurredAt),
              payload: payload as Prisma.InputJsonValue,
              runId: input.runId,
              sequence: input.sequence,
              type: input.type,
            },
          });
          await this.applyEvent(transaction, input, payload, run.approvalState, run.mode);
          await this.audit.appendWith(transaction, {
            action: input.type,
            correlationId: input.correlationId,
            entityId: input.runId,
            entityType: 'run',
            payload: {
              ...payload,
              agent: input.agent ?? null,
              eventId: input.id,
              sequence: input.sequence,
            },
          });
          return created;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      this.stream.publish(event);
      return event;
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Duplicate event ID, sequence or idempotency key');
      }
      throw error;
    }
  }

  async assertRun(runId: string): Promise<void> {
    const exists = await this.prisma.workflowRun.findUnique({
      where: { id: runId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Run not found');
  }

  private async applyEvent(
    transaction: Prisma.TransactionClient,
    input: RecordEventDto,
    payload: Record<string, unknown>,
    approvalState: ApprovalState,
    runMode: RunMode,
  ): Promise<void> {
    if (input.type === 'run.started') {
      await transaction.workflowRun.update({
        where: { id: input.runId },
        data: { startedAt: new Date(input.occurredAt), status: RunStatus.RUNNING },
      });
      return;
    }
    if (input.type === 'plan.created') {
      if (runMode === RunMode.MULTI) this.assertMultiAgentPlan(payload);
      await transaction.workflowRun.update({
        where: { id: input.runId },
        data: { plan: payload as Prisma.InputJsonValue, status: RunStatus.PLANNING },
      });
      await this.upsertPlanTasks(transaction, input.runId, payload);
      return;
    }
    if (input.type === 'agent.started') {
      await this.updateTaskStatus(transaction, input.runId, payload, AgentTaskStatus.RUNNING);
      await transaction.workflowRun.update({
        where: { id: input.runId },
        data: { status: RunStatus.RUNNING },
      });
      return;
    }
    if (input.type === 'agent.completed') {
      const taskStatus =
        payload.status === 'FAILED'
          ? AgentTaskStatus.FAILED
          : payload.status === 'SKIPPED'
            ? AgentTaskStatus.SKIPPED
            : AgentTaskStatus.COMPLETED;
      await this.updateTaskStatus(transaction, input.runId, payload, taskStatus, payload);
      return;
    }
    if (input.type === 'synthesis.completed') {
      await transaction.workflowRun.update({
        where: { id: input.runId },
        data: {
          decision: (payload.decision ?? payload.finalDecision ?? payload) as Prisma.InputJsonValue,
        },
      });
      return;
    }
    if (input.type === 'approval.required') {
      await transaction.workflowRun.update({
        where: { id: input.runId },
        data: { approvalState: ApprovalState.PENDING, status: RunStatus.AWAITING_APPROVAL },
      });
      return;
    }
    if (input.type === 'run.completed') {
      const partial = payload.partial === true;
      await transaction.workflowRun.update({
        where: { id: input.runId },
        data: {
          completedAt: new Date(input.occurredAt),
          results: payload as Prisma.InputJsonValue,
          status:
            approvalState === ApprovalState.PENDING
              ? RunStatus.AWAITING_APPROVAL
              : partial
                ? RunStatus.PARTIAL
                : RunStatus.COMPLETED,
        },
      });
      return;
    }
    if (input.type === 'run.failed') {
      await transaction.workflowRun.update({
        where: { id: input.runId },
        data: {
          completedAt: new Date(input.occurredAt),
          results: payload as Prisma.InputJsonValue,
          status: RunStatus.FAILED,
        },
      });
    }
  }

  private assertMultiAgentPlan(payload: Record<string, unknown>): void {
    if (!Array.isArray(payload.tasks) || payload.tasks.length !== 3) {
      throw new UnprocessableEntityException('Multi-agent plan must contain exactly three tasks');
    }
    const agents = new Set(
      payload.tasks.map((task) =>
        task && typeof task === 'object' && 'agent' in task ? task.agent : undefined,
      ),
    );
    if (
      agents.size !== 3 ||
      !agents.has('CREDIT') ||
      !agents.has('COMPLIANCE') ||
      !agents.has('OPERATIONS')
    ) {
      throw new UnprocessableEntityException(
        'Multi-agent plan must contain Credit, Compliance and Operations tasks',
      );
    }
  }

  private async upsertPlanTasks(
    transaction: Prisma.TransactionClient,
    runId: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    if (!Array.isArray(payload.tasks)) return;
    for (const rawTask of payload.tasks) {
      if (!rawTask || typeof rawTask !== 'object') continue;
      const task = rawTask as Record<string, unknown>;
      if (
        typeof task.id !== 'string' ||
        typeof task.agent !== 'string' ||
        !Object.values(AgentKind).includes(task.agent as AgentKind)
      ) {
        continue;
      }
      await transaction.agentTask.upsert({
        where: { runId_externalTaskId: { externalTaskId: task.id, runId } },
        create: {
          agent: task.agent as AgentKind,
          dependencies: (Array.isArray(task.dependencies)
            ? task.dependencies
            : []) as Prisma.InputJsonValue,
          externalTaskId: task.id,
          objective: typeof task.objective === 'string' ? task.objective : '',
          runId,
          status: AgentTaskStatus.PENDING,
          successCriteria: (Array.isArray(task.successCriteria)
            ? task.successCriteria
            : []) as Prisma.InputJsonValue,
          title: typeof task.title === 'string' ? task.title : task.id,
        },
        update: {},
      });
    }
  }

  private async updateTaskStatus(
    transaction: Prisma.TransactionClient,
    runId: string,
    payload: Record<string, unknown>,
    status: AgentTaskStatus,
    result?: Record<string, unknown>,
  ): Promise<void> {
    const taskId = typeof payload.taskId === 'string' ? payload.taskId : undefined;
    if (!taskId) return;
    await transaction.agentTask.updateMany({
      where: { externalTaskId: taskId, runId },
      data: { status, ...(result ? { result: result as Prisma.InputJsonValue } : {}) },
    });
  }
}
