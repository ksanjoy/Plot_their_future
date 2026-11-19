import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { InjectEnv, type Env } from '../config/config.module.js';
import { UserModel } from '../models/schemas.js';
import { IS_PUBLIC, type AccessTokenPayload, type AuthUser } from './auth.js';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    @InjectEnv() private readonly env: Env,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [context.getHandler(), context.getClass()]);
    const req = context.switchToHttp().getRequest();
    const header: string | undefined = req.headers?.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;

    if (token) {
      try {
        const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, { secret: this.env.JWT_ACCESS_SECRET });
        req.user = { id: payload.sub, phone: payload.phone, isPlatformAdmin: payload.adm } satisfies AuthUser;
        const row = await UserModel.findById(payload.sub).select('blockedAt blockedReason');
        if (row?.blockedAt) {
          throw new ForbiddenException({
            code: 'ACCOUNT_BLOCKED',
            message: row.blockedReason ? `This account is blocked: ${row.blockedReason}` : 'This account is blocked. Contact support.',
          });
        }
      } catch (err) {
        if (err instanceof ForbiddenException) throw err;
        if (!isPublic) throw new UnauthorizedException('Invalid or expired access token');
      }
    }
    if (!isPublic && !req.user) throw new UnauthorizedException('Authentication required');
    return true;
  }
}
