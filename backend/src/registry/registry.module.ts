import { Module } from '@nestjs/common';
import { workersEnabled } from '../jobs/queues.js';
import { PaymentProvidersModule } from '../payments/providers/payment-providers.module.js';
import { MaintenanceProcessor } from './maintenance.processor.js';
import { RegistryController } from './registry.controller.js';
import { RegistryService } from './registry.service.js';

@Module({
  imports: [PaymentProvidersModule],
  controllers: [RegistryController],
  providers: [RegistryService, ...(workersEnabled() ? [MaintenanceProcessor] : [])],
  exports: [RegistryService, PaymentProvidersModule],
})
export class RegistryModule {}
