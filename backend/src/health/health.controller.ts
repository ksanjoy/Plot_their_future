import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../common/auth.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RedisService } from '../redis/redis.service.js';

@ApiTags('health')
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Public()
  @Get()
  async check() {
    const [db, cache] = await Promise.all([
      this.prisma.$queryRaw`SELECT 1`.then(() => 'up' as const, () => 'down' as const),
      this.redis.ping().then(() => 'up' as const, () => 'down' as const),
    ]);
    const body = { status: db === 'up' && cache === 'up' ? 'ok' : 'degraded', database: db, redis: cache, time: new Date().toISOString() };
    if (body.status !== 'ok') throw new ServiceUnavailableException(body);
    return body;
  }
}
