import { Module } from '@nestjs/common';
import { BlessingsController } from './blessings.controller.js';
import { BlessingsService } from './blessings.service.js';

@Module({
  controllers: [BlessingsController],
  providers: [BlessingsService],
  exports: [BlessingsService],
})
export class BlessingsModule {}
