import { Injectable } from '@nestjs/common';
import { Prisma, type AuditLog } from '@prisma/client';

import { redactPublicPayload } from '../../common/logging/redaction';
import { PrismaService } from '../../database/prisma.service';

export interface AuditEntry {
  action: string;
  actorSubject?: string;
  correlationId: string;
  entityId: string;
  entityType: string;
  payload?: Record<string, unknown>;
}

type AuditDatabase = Prisma.TransactionClient | PrismaService;

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  append(entry: AuditEntry): Promise<AuditLog> {
    return this.appendWith(this.prisma, entry);
  }

  appendWith(database: AuditDatabase, entry: AuditEntry): Promise<AuditLog> {
    const payload = redactPublicPayload(entry.payload ?? {}) as Prisma.InputJsonValue;
    return database.auditLog.create({
      data: {
        action: entry.action,
        actorSubject: entry.actorSubject,
        correlationId: entry.correlationId,
        entityId: entry.entityId,
        entityType: entry.entityType,
        payload,
      },
    });
  }

  listForEntity(entityType: string, entityId: string): Promise<AuditLog[]> {
    return this.prisma.auditLog.findMany({
      where: { entityId, entityType },
      orderBy: { createdAt: 'asc' },
    });
  }
}
