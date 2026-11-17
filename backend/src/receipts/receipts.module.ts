import { Module } from '@nestjs/common';
import { workersEnabled } from '../jobs/queues.js';
import { ReceiptsController } from './receipts.controller.js';
import { ReceiptsProcessor } from './receipts.processor.js';
import { ReceiptsService } from './receipts.service.js';

@Module({
  controllers: [ReceiptsController],
  providers: [ReceiptsService, ...(workersEnabled() ? [ReceiptsProcessor] : [])],
  exports: [ReceiptsService],
})
export class ReceiptsModule {}
