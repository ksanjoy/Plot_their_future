import { ForbiddenException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectEnv, type Env } from '../config/config.module.js';

export type LinkPurpose = 'checkout' | 'receipt';

interface LinkPayload {
  cid: string;
  typ: LinkPurpose;
}

/**
 * Short-lived signed links that let a browser (e.g. one opened from the mobile
 * app or a WhatsApp message) act on exactly one contribution without a session.
 */
@Injectable()
export class LinkTokenService {
  constructor(
    private readonly jwt: JwtService,
    @InjectEnv() private readonly env: Env,
  ) {}

  sign(contributionId: string, typ: LinkPurpose, ttlSec: number): string {
    return this.jwt.sign({ cid: contributionId, typ } satisfies LinkPayload, {
      secret: this.env.JWT_LINK_SECRET,
      expiresIn: ttlSec,
    });
  }

  verify(token: string | undefined, contributionId: string, typ: LinkPurpose): void {
    if (!token) throw new ForbiddenException('Link token missing');
    try {
      const payload = this.jwt.verify<LinkPayload>(token, { secret: this.env.JWT_LINK_SECRET });
      if (payload.cid === contributionId && payload.typ === typ) return;
    } catch {
      // fall through
    }
    throw new ForbiddenException('This link is invalid or has expired');
  }
}
