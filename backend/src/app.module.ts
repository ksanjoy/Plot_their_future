import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AccessModule } from './access/access.module.js';
import { AuthModule } from './auth/auth.module.js';
import { BlessingsModule } from './blessings/blessings.module.js';
import { CeremoniesModule } from './ceremonies/ceremonies.module.js';
import { JwtAuthGuard } from './common/jwt-auth.guard.js';
import { PrismaExceptionFilter } from './common/prisma-exception.filter.js';
import { AppConfigModule } from './config/config.module.js';
import { DispatchModule } from './dispatch/dispatch.module.js';
import { FinanceModule } from './finance/finance.module.js';
import { GuestsModule } from './guests/guests.module.js';
import { HealthController } from './health/health.controller.js';
import { JobsModule } from './jobs/jobs.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { PaymentsModule } from './payments/payments.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { RealtimeModule } from './realtime/realtime.module.js';
import { ReceiptsModule } from './receipts/receipts.module.js';
import { RedisModule } from './redis/redis.module.js';
import { RegistryModule } from './registry/registry.module.js';
import { RsvpModule } from './rsvp/rsvp.module.js';
import { StageModule } from './stage/stage.module.js';
import { StorageModule } from './storage/storage.module.js';
import { WeddingsModule } from './weddings/weddings.module.js';

@Module({
  imports: [
    AppConfigModule,
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 300 }]),
    PrismaModule,
    RedisModule,
    JobsModule,
    AccessModule,
    AuthModule,
    NotificationsModule,
    RealtimeModule,
    StorageModule,
    WeddingsModule,
    CeremoniesModule,
    GuestsModule,
    DispatchModule,
    RsvpModule,
    RegistryModule,
    PaymentsModule,
    ReceiptsModule,
    BlessingsModule,
    StageModule,
    FinanceModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_FILTER, useClass: PrismaExceptionFilter },
  ],
})
export class AppModule {}
