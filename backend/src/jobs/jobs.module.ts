import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { ENV, type Env } from '../config/config.module.js';
import { defaultJobOptions, QUEUES, redisConnectionFromUrl } from './queues.js';

const queueModule = BullModule.registerQueue(...Object.values(QUEUES).map((name) => ({ name })));

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ENV],
      useFactory: (env: Env) => ({
        connection: redisConnectionFromUrl(env.REDIS_URL),
        prefix: 'ptf',
        defaultJobOptions,
      }),
    }),
    queueModule,
  ],
  exports: [queueModule],
})
export class JobsModule {}
