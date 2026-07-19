import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { AuthProfileController, IdentityAdminController } from './identity.controller';
import { IdentityService } from './identity.service';
import { KeycloakAdminClient } from './keycloak-admin.client';

@Module({
  imports: [AuditModule],
  controllers: [AuthProfileController, IdentityAdminController],
  providers: [IdentityService, KeycloakAdminClient],
  exports: [IdentityService],
})
export class IdentityModule {}
