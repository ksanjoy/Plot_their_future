import { Module } from '@nestjs/common';
import { RegistryModule } from '../registry/registry.module.js';
import { PublicController } from './public.controller.js';
import { WeddingsController } from './weddings.controller.js';
import { WeddingsService } from './weddings.service.js';

@Module({
  imports: [RegistryModule],
  controllers: [WeddingsController, PublicController],
  providers: [WeddingsService],
  exports: [WeddingsService],
})
export class WeddingsModule {}
