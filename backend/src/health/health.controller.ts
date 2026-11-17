import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../common/auth.js';
import { DatabaseService } from '../database/database.service.js';
import { RedisService } from '../redis/redis.service.js';

@ApiTags('health')
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(
    private readonly db: DatabaseService,
    private readonly redis: RedisService,
  ) {}

  @Public()
  @Get()
  async check() {
    const [database, cache] = await Promise.all([
      this.db.ping().then(() => 'up' as const, () => 'down' as const),
      this.redis.ping().then(() => 'up' as const, () => 'down' as const),
    ]);
    const body = { status: database === 'up' && cache === 'up' ? 'ok' : 'degraded', database, redis: cache, time: new Date().toISOString() };
    if (body.status !== 'ok') throw new ServiceUnavailableException(body);
    return body;
  }
}
