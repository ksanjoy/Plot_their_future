import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Redis } from 'ioredis';
import { InjectEnv, type Env } from '../config/config.module.js';

const RELEASE_LOCK_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end`;

export class LockNotAcquiredError extends Error {
  constructor(key: string) {
    super(`Could not acquire lock ${key}`);
  }
}

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  readonly client: Redis;

  constructor(@InjectEnv() private readonly env: Env) {
    this.client = this.createConnection();
    this.client.on('error', (err) => this.logger.error(`Redis error: ${err.message}`));
  }

  createConnection(options: { maxRetriesPerRequest?: number | null } = {}): Redis {
    return new Redis(this.env.REDIS_URL, { lazyConnect: false, ...options });
  }

  /**
   * Distributed mutex (SET NX PX + token-checked release). Retries for up to
   * `waitMs` before giving up so short critical sections queue instead of failing.
   */
  async withLock<T>(key: string, fn: () => Promise<T>, ttlMs = 10_000, waitMs = 5_000): Promise<T> {
    const token = randomUUID();
    const deadline = Date.now() + waitMs;
    for (;;) {
      const ok = await this.client.set(key, token, 'PX', ttlMs, 'NX');
      if (ok === 'OK') break;
      if (Date.now() > deadline) throw new LockNotAcquiredError(key);
      await new Promise((r) => setTimeout(r, 25 + Math.random() * 50));
    }
    try {
      return await fn();
    } finally {
      await this.client.eval(RELEASE_LOCK_SCRIPT, 1, key, token).catch(() => undefined);
    }
  }

  /** Fixed-window counter; returns the number of hits in the current window. */
  async hit(key: string, windowSec: number): Promise<number> {
    const count = await this.client.incr(key);
    if (count === 1) await this.client.expire(key, windowSec);
    return count;
  }

  async ping(): Promise<boolean> {
    return (await this.client.ping()) === 'PONG';
  }

  async onModuleDestroy() {
    await this.client.quit().catch(() => undefined);
  }
}
