import { createParamDecorator, SetMetadata, type ExecutionContext } from '@nestjs/common';

export interface AuthUser {
  id: string;
  phone: string;
  isPlatformAdmin: boolean;
}

export interface AccessTokenPayload {
  sub: string;
  phone: string;
  adm: boolean;
  /** Weddings this user could access when the token was issued (slug -> role). Informational only. */
  wed: Record<string, string>;
}

export const IS_PUBLIC = 'isPublic';

/** Route is reachable without a token. A valid token, if sent, still populates `req.user`. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser | undefined => {
  return ctx.switchToHttp().getRequest().user;
});
