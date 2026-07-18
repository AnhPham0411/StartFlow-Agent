import { type MiddlewareConsumer, Module, type NestModule, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { PinoLoggerService } from './common/logging/pino-logger.service';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';
import { validateEnvironment } from './config/env.validation';
import { PrismaModule } from './database/prisma.module';
import { ActionTicketsModule } from './modules/action-tickets/action-tickets.module';
import { ApprovalsModule } from './modules/approvals/approvals.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './modules/auth/jwt-auth.guard';
import { RolesGuard } from './modules/auth/roles.guard';
import { CasesModule } from './modules/cases/cases.module';
import { EventsModule } from './modules/events/events.module';
import { HealthModule } from './modules/health/health.module';
import { InternalCallbackModule } from './modules/internal-callback/internal-callback.module';
import { KnowledgeModule } from './modules/knowledge/knowledge.module';
import { NbaModule } from './modules/nba/nba.module';
import { RunsModule } from './modules/runs/runs.module';

@Module({
  imports: [
    ConfigModule.forRoot({ envFilePath: '../.env', cache: true, isGlobal: true, validate: validateEnvironment }),
    ThrottlerModule.forRoot([{ limit: 100, ttl: 60_000 }]),
    PrismaModule,
    AuthModule,
    AuditModule,
    ActionTicketsModule,
    HealthModule,
    CasesModule,
    EventsModule,
    RunsModule,
    InternalCallbackModule,
    ApprovalsModule,
    NbaModule,
    KnowledgeModule,
  ],
  providers: [
    PinoLoggerService,
    { provide: APP_GUARD, useExisting: JwtAuthGuard },
    { provide: APP_GUARD, useExisting: RolesGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes({ path: '*path', method: RequestMethod.ALL });
  }
}
