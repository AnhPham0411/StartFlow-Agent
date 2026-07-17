import { createHash } from 'node:crypto';

import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type LoanCase } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { CreateCaseDto } from './dto/create-case.dto';

@Injectable()
export class CasesService {
  constructor(
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
  ) {}

  async create(input: CreateCaseDto, actorSubject: string, correlationId: string) {
    try {
      const created = await this.prisma.$transaction(async (transaction) => {
        const loanCase = await transaction.loanCase.create({
          data: {
            companyName: input.companyName.trim(),
            createdBy: actorSubject,
            demoData: true,
            financials: input.financials as unknown as Prisma.InputJsonObject,
            purpose: input.purpose.trim(),
            registrationNumber: input.registrationNumber.trim(),
            requestedAmount: new Prisma.Decimal(input.requestedAmount),
            submittedDocuments: input.submittedDocuments as Prisma.InputJsonValue,
          },
        });
        await this.audit.appendWith(transaction, {
          action: 'case.created',
          actorSubject,
          correlationId,
          entityId: loanCase.id,
          entityType: 'case',
          payload: { demoData: true, registrationNumber: loanCase.registrationNumber },
        });
        return loanCase;
      });
      return this.toRecord(created);
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('A case with this registration number already exists');
      }
      throw error;
    }
  }

  async list() {
    const cases = await this.prisma.loanCase.findMany({
      include: {
        _count: { select: { runs: true } },
        runs: {
          orderBy: { createdAt: 'desc' },
          select: { completedAt: true, createdAt: true, id: true, status: true },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return cases.map(({ _count, runs, ...loanCase }) => ({
      ...this.toRecord(loanCase),
      latestRun: runs[0] ?? null,
      runCount: _count.runs,
    }));
  }

  async get(caseId: string) {
    const loanCase = await this.prisma.loanCase.findUnique({
      where: { id: caseId },
      include: {
        runs: {
          orderBy: { createdAt: 'desc' },
          select: {
            approvalState: true,
            completedAt: true,
            createdAt: true,
            id: true,
            mode: true,
            startedAt: true,
            status: true,
          },
        },
      },
    });
    if (!loanCase) throw new NotFoundException('Case not found');
    const { runs, ...record } = loanCase;
    return { ...this.toRecord(record), runs };
  }

  async requireEntity(caseId: string): Promise<LoanCase> {
    const loanCase = await this.prisma.loanCase.findUnique({ where: { id: caseId } });
    if (!loanCase) throw new NotFoundException('Case not found');
    return loanCase;
  }

  snapshotData(loanCase: LoanCase) {
    return this.toRecord(loanCase);
  }

  snapshotHash(snapshot: Record<string, unknown>): string {
    return createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
  }

  private toRecord(loanCase: LoanCase) {
    return {
      companyName: loanCase.companyName,
      createdAt: loanCase.createdAt.toISOString(),
      createdBy: loanCase.createdBy,
      demoData: loanCase.demoData,
      financials: loanCase.financials,
      id: loanCase.id,
      purpose: loanCase.purpose,
      registrationNumber: loanCase.registrationNumber,
      requestedAmount: loanCase.requestedAmount.toNumber(),
      submittedDocuments: loanCase.submittedDocuments,
    };
  }
}
