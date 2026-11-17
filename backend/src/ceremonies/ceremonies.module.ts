import { Module } from '@nestjs/common';
import { workersEnabled } from '../jobs/queues.js';
import { CeremoniesController } from './ceremonies.controller.js';
import { CeremoniesService } from './ceremonies.service.js';
import { RemindersProcessor } from './reminders.processor.js';

@Module({
  controllers: [CeremoniesController],
  providers: [CeremoniesService, ...(workersEnabled() ? [RemindersProcessor] : [])],
  exports: [CeremoniesService],
})
export class CeremoniesModule {}
