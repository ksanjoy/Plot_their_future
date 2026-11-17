import { Global, Module } from '@nestjs/common';
import { WeddingAccessService } from './wedding-access.service.js';

@Global()
@Module({
  providers: [WeddingAccessService],
  exports: [WeddingAccessService],
})
export class AccessModule {}
