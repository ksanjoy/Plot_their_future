import { Module } from '@nestjs/common';
import { GuestsModule } from '../guests/guests.module.js';
import { workersEnabled } from '../jobs/queues.js';
import { DispatchController } from './dispatch.controller.js';
import { DispatchProcessor } from './dispatch.processor.js';
import { DispatchService } from './dispatch.service.js';

@Module({
  imports: [GuestsModule],
  controllers: [DispatchController],
  providers: [DispatchService, ...(workersEnabled() ? [DispatchProcessor] : [])],
})
export class DispatchModule {}
