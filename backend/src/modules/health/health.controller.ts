import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { Public } from '../auth/public.decorator';
import { HealthService } from './health.service';

@ApiTags('health')
@Controller()
@Public()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('health')
  @ApiOperation({ summary: 'Process liveness' })
  health() {
    return this.healthService.health();
  }

  @Get('ready')
  @ApiOperation({ summary: 'External PostgreSQL and Keycloak readiness' })
  ready() {
    return this.healthService.readiness();
  }
}
