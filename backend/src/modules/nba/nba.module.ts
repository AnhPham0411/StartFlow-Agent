import { Module } from '@nestjs/common';

import { PrismaModule } from '../../database/prisma.module';
import { AssessmentModule } from './assessment/assessment.module';
import { NbaController } from './nba.controller';
import { NbaService } from './nba.service';

@Module({
  imports: [PrismaModule, AssessmentModule],
  controllers: [NbaController],
  providers: [NbaService],
})
export class NbaModule {}
