import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Emitter } from '@socket.io/redis-emitter';
import type { Redis } from 'ioredis';
import type { Namespace } from 'socket.io';
import { RedisService } from '../redis/redis.service.js';

export const LIVE_NAMESPACE = '/live';

export const rooms = {
  wedding: (weddingId: string) => `w:${weddingId}`,
  admin: (weddingId: string) => `admin:${weddingId}`,
  stage: (weddingId: string) => `stage:${weddingId}`,
};

export type LiveEvent =
  | 'registry.updated'
  | 'contribution.funded'
  | 'blessing.approved'
  | 'rsvp.updated'
  | 'dispatch.progress';

/**
 * Broadcasts live events. Inside the API process it uses the gateway's server
 * (fanned out to other instances by the Redis adapter); worker-only processes
 * publish through the Redis emitter instead.
 */
@Injectable()
export class RealtimeService implements OnModuleDestroy {
  private server?: Namespace;
  private emitter?: Emitter;
  private emitterClient?: Redis;

  constructor(private readonly redis: RedisService) {}

  attach(server: Namespace) {
    this.server = server;
  }

  emit(room: string | string[], event: LiveEvent, payload: unknown) {
    if (this.server) {
      this.server.to(room).emit(event, payload);
      return;
    }
    if (!this.emitter) {
      this.emitterClient = this.redis.createConnection();
      this.emitter = new Emitter(this.emitterClient).of(LIVE_NAMESPACE);
    }
    this.emitter.to(room).emit(event, payload);
  }

  async onModuleDestroy() {
    await this.emitterClient?.quit().catch(() => undefined);
  }
}
