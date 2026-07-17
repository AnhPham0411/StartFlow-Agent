import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { EventsModule } from '../events/events.module';
import { InternalCallbackController } from './internal-callback.controller';

@Module({
  imports: [AuthModule, EventsModule],
  controllers: [InternalCallbackController],
})
export class InternalCallbackModule {}
