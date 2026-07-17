import { Module } from '@nestjs/common';

import { InternalServiceGuard } from './internal-service.guard';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';

@Module({
  providers: [InternalServiceGuard, JwtAuthGuard, RolesGuard],
  exports: [InternalServiceGuard, JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
