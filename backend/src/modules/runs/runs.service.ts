import { randomUUID } from 'node:crypto';

import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, RunMode } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import { AiClientService } from '../ai-client/ai-client.service';
import { AuditService } from '../audit/audit.service';
import { CasesService } from '../cases/cases.service';
import { EventsService } from '../events/events.service';
import { buildDemoComparisonMetrics } from './comparison-metrics';

@Injectable()
export class RunsService {
  constructor(
    private readonly aiClient: AiClientService,
    private readonly audit: AuditService,
    private readonly cases: CasesService,
    private readonly events: EventsService,
    private readonly prisma: PrismaService,
  ) {}

  async create(caseId: string, actorSubject: string, correlationId: string) {
    const loanCase = await this.cases.requireEntity(caseId);
    const caseSnapshot = this.cases.snapshotData(loanCase);
    const run = await this.prisma.$transaction(async (transaction) => {
      const snapshot = await transaction.caseSnapshot.create({
        data: {
          caseId,
          contentHash: this.cases.snapshotHash(caseSnapshot),
          snapshot: caseSnapshot as Prisma.InputJsonValue,
        },
      });
      const created = await transaction.workflowRun.create({
        data: { caseId, createdBy: actorSubject, mode: RunMode.MULTI, snapshotId: snapshot.id },
      });
      await this.audit.appendWith(transaction, {
        action: 'run.created',
        actorSubject,
        correlationId,
        entityId: created.id,
        entityType: 'run',
        payload: { mode: created.mode, snapshotId: snapshot.id },
      });
      return created;
    });

    try {
      await this.aiClient.startRun({ caseSnapshot, correlationId, mode: run.mode, runId: run.id });
      return { runId: run.id, status: run.status };
    } catch {
      const failureRecorded = await this.recordDispatchFailure(run.id, correlationId);
      return { runId: run.id, status: failureRecorded ? ('FAILED' as const) : run.status };
    }
  }

  async createComparison(caseId: string, actorSubject: string, correlationId: string) {
    const loanCase = await this.cases.requireEntity(caseId);
    const caseSnapshot = this.cases.snapshotData(loanCase);
    const metrics = buildDemoComparisonMetrics(caseSnapshot);
    const created = await this.prisma.$transaction(async (transaction) => {
      const snapshot = await transaction.caseSnapshot.create({
        data: {
          caseId,
          contentHash: this.cases.snapshotHash(caseSnapshot),
          snapshot: caseSnapshot as Prisma.InputJsonValue,
        },
      });
      const single = await transaction.workflowRun.create({
        data: { caseId, createdBy: actorSubject, mode: RunMode.SINGLE, snapshotId: snapshot.id },
      });
      const multi = await transaction.workflowRun.create({
        data: { caseId, createdBy: actorSubject, mode: RunMode.MULTI, snapshotId: snapshot.id },
      });
      const comparison = await transaction.comparison.create({
        data: {
          caseId,
          createdBy: actorSubject,
          multiAgentRunId: multi.id,
          metrics: metrics as Prisma.InputJsonValue,
          singleAgentRunId: single.id,
          snapshotId: snapshot.id,
        },
      });
      await this.audit.appendWith(transaction, {
        action: 'comparison.created',
        actorSubject,
        correlationId,
        entityId: comparison.id,
        entityType: 'comparison',
        payload: {
          metricsSource: 'DETERMINISTIC_DEMO_RUBRIC',
          multiAgentRunId: multi.id,
          singleAgentRunId: single.id,
          snapshotId: snapshot.id,
        },
      });
      return { comparison, multi, single, snapshot };
    });

    const starts = await Promise.allSettled([
      this.aiClient.startRun({
        caseSnapshot,
        correlationId,
        mode: 'SINGLE',
        runId: created.single.id,
      }),
      this.aiClient.startRun({
        caseSnapshot,
        correlationId,
        mode: 'MULTI',
        runId: created.multi.id,
      }),
    ]);
    if (starts[0]?.status === 'rejected')
      await this.recordDispatchFailure(created.single.id, correlationId);
    if (starts[1]?.status === 'rejected')
      await this.recordDispatchFailure(created.multi.id, correlationId);

    return {
      comparisonId: created.comparison.id,
      metrics,
      metricsSource: 'DETERMINISTIC_DEMO_RUBRIC' as const,
      multiAgentRunId: created.multi.id,
      singleAgentRunId: created.single.id,
      snapshotId: created.snapshot.id,
    };
  }

  async get(runId: string) {
    const run = await this.prisma.workflowRun.findUnique({
      where: { id: runId },
      include: {
        actionTicket: true,
        approval: true,
        events: { orderBy: { sequence: 'asc' } },
        snapshot: true,
        tasks: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!run) throw new NotFoundException('Run not found');
    return run;
  }

  private async recordDispatchFailure(runId: string, correlationId: string): Promise<boolean> {
    try {
      await this.events.record({
        agent: null,
        correlationId,
        id: randomUUID(),
        idempotencyKey: `dispatch-failure:${runId}`,
        occurredAt: new Date().toISOString(),
        payload: { code: 'AI_SERVICE_UNAVAILABLE', summary: 'AI workflow could not be started' },
        runId,
        sequence: 1,
        type: 'run.failed',
      });
      return true;
    } catch (error: unknown) {
      if (error instanceof ConflictException) return false;
      throw error;
    }
  }
}
