import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import type { Namespace, Socket } from 'socket.io';
import { z } from 'zod';
import { InjectEnv, type Env } from '../config/config.module.js';
import type { AccessTokenPayload, AuthUser } from '../common/auth.js';
import { ADMIN_ROLES, STAFF_ROLES, WeddingAccessService } from '../access/wedding-access.service.js';
import { LIVE_NAMESPACE, RealtimeService, rooms } from './realtime.service.js';

const joinSchema = z.object({
  slug: z.string().min(1),
  channel: z.enum(['wedding', 'admin', 'stage']).default('wedding'),
});

@WebSocketGateway({ namespace: LIVE_NAMESPACE, cors: { origin: true, credentials: true } })
export class LiveGateway implements OnGatewayInit {
  private readonly logger = new Logger(LiveGateway.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly access: WeddingAccessService,
    private readonly realtime: RealtimeService,
    @InjectEnv() private readonly env: Env,
  ) {}

  afterInit(server: Namespace) {
    this.realtime.attach(server);
    server.use((socket, next) => {
      const token = (socket.handshake.auth as { token?: string })?.token;
      if (!token) return next(new Error('unauthorized'));
      this.jwt
        .verifyAsync<AccessTokenPayload>(token, { secret: this.env.JWT_ACCESS_SECRET })
        .then((p) => {
          socket.data.user = { id: p.sub, phone: p.phone, isPlatformAdmin: p.adm } satisfies AuthUser;
          next();
        })
        .catch(() => next(new Error('unauthorized')));
    });
  }

  @SubscribeMessage('join')
  async join(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown) {
    const parsed = joinSchema.safeParse(body);
    if (!parsed.success) return { ok: false, error: 'Invalid join payload' };
    const { slug, channel } = parsed.data;
    try {
      const access = await this.access.resolve(socket.data.user as AuthUser, slug);
      const allowed =
        channel === 'wedding' ||
        (channel === 'admin' && [...ADMIN_ROLES, 'LEAD'].includes(access.role)) ||
        (channel === 'stage' && (STAFF_ROLES.includes(access.role) || access.role === 'PLATFORM'));
      if (!allowed) return { ok: false, error: 'Forbidden' };
      const room = rooms[channel](access.wedding.id);
      await socket.join(room);
      return { ok: true, room };
    } catch (err) {
      this.logger.debug(`join rejected: ${(err as Error).message}`);
      return { ok: false, error: 'Forbidden' };
    }
  }

  @SubscribeMessage('leave')
  async leave(@ConnectedSocket() socket: Socket, @MessageBody() body: { room?: string }) {
    if (body?.room) await socket.leave(body.room);
    return { ok: true };
  }
}
