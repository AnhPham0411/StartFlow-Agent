import { Module } from '@nestjs/common';

import { PrismaModule } from '../../database/prisma.module';
import { NbaController } from './nba.controller';
import { NbaService } from './nba.service';

@Module({
  imports: [PrismaModule],
  controllers: [NbaController],
  providers: [NbaService],
})
export class NbaModule {}
