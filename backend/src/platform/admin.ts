import { ForbiddenException } from '@nestjs/common';
import type { AuthUser } from '../common/auth.js';

export function assertPlatform(user: AuthUser) {
  if (!user.isPlatformAdmin) {
    throw new ForbiddenException({ code: 'FORBIDDEN_ROLE', message: 'Platform admin only' });
  }
}
