import { Global, Module } from '@nestjs/common';
import { LiveGateway } from './live.gateway.js';
import { RealtimeService } from './realtime.service.js';

@Global()
@Module({
  providers: [RealtimeService, LiveGateway],
  exports: [RealtimeService],
})
export class RealtimeModule {}
