import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectEnv, type Env } from '../config/config.module.js';
import type { AccessTokenPayload, AuthUser } from '../common/auth.js';
import { randomToken, sha256 } from '../common/utils/crypto.js';
import { maskPhone, toE164 } from '../common/utils/phone.js';
import type { User } from '../generated/prisma/client.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { OtpService } from './otp.service.js';

export interface AccessibleWedding {
  slug: string;
  role: string;
  brideName: string;
  groomName: string;
  weddingDate: Date | null;
  coverPhotoUrl: string | null;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectEnv() private readonly env: Env,
    private readonly prisma: PrismaService,
    private readonly otp: OtpService,
    private readonly jwt: JwtService,
    private readonly notifications: NotificationsService,
  ) {}

  normalisePhone(input: string): string {
    const phone = toE164(input, this.env.DEFAULT_PHONE_COUNTRY);
    if (!phone) throw new BadRequestException({ code: 'INVALID_PHONE', message: 'Enter a valid mobile number' });
    return phone;
  }

  async requestOtp(input: { phone: string; slug?: string }) {
    const phone = this.normalisePhone(input.phone);

    if (input.slug) {
      const wedding = await this.prisma.wedding.findUnique({ where: { slug: input.slug }, select: { id: true } });
      if (!wedding) throw new NotFoundException('Wedding not found');
      const [invitation, member] = await Promise.all([
        this.prisma.invitation.findUnique({ where: { weddingId_phone: { weddingId: wedding.id, phone } }, select: { id: true } }),
        this.prisma.weddingMember.findFirst({ where: { weddingId: wedding.id, user: { phone } }, select: { id: true } }),
      ]);
      if (!invitation && !member && !this.env.PLATFORM_ADMIN_PHONES.includes(phone)) {
        throw new ForbiddenException({
          code: 'NOT_INVITED',
          message: 'This number is not on the guest list for this celebration. Please use the number your invitation was sent to.',
        });
      }
    }

    const { otp, requestId, resendAfterSec } = await this.otp.issue(phone);
    const delivery = await this.notifications.sendOtp(phone, otp);
    const exposeOtp = this.env.EXPOSE_DEV_OTP && this.env.NODE_ENV !== 'production';
    return {
      requestId,
      phone,
      maskedPhone: maskPhone(phone),
      channel: delivery.channel,
      expiresInSec: this.env.OTP_TTL_SEC,
      resendAfterSec,
      ...(exposeOtp ? { devOtp: otp } : {}),
    };
  }

  async verifyOtp(input: { phone: string; otp: string; name?: string }, userAgent?: string) {
    const phone = this.normalisePhone(input.phone);
    await this.otp.verify(phone, input.otp);

    const isPlatformAdmin = this.env.PLATFORM_ADMIN_PHONES.includes(phone);
    const existing = await this.prisma.user.findUnique({ where: { phone } });
    const user = existing
      ? await this.prisma.user.update({
          where: { id: existing.id },
          data: {
            ...(isPlatformAdmin && !existing.isPlatformAdmin ? { isPlatformAdmin: true } : {}),
            ...(!existing.name && input.name ? { name: input.name } : {}),
          },
        })
      : await this.prisma.user.create({ data: { phone, name: input.name, isPlatformAdmin } });

    await this.prisma.invitation.updateMany({ where: { phone, userId: null }, data: { userId: user.id } });
    return this.issueTokens(user, userAgent);
  }

  async refresh(refreshToken: string, userAgent?: string) {
    const hash = sha256(refreshToken);
    const session = await this.prisma.session.findUnique({ where: { refreshTokenHash: hash }, include: { user: true } });
    if (!session) throw new UnauthorizedException('Invalid refresh token');
    if (session.revokedAt) {
      // A rotated token was replayed: assume theft and end every session of this user.
      await this.prisma.session.updateMany({ where: { userId: session.userId, revokedAt: null }, data: { revokedAt: new Date() } });
      throw new UnauthorizedException('Refresh token reuse detected. Please sign in again.');
    }
    if (session.expiresAt < new Date()) throw new UnauthorizedException('Session expired. Please sign in again.');
    await this.prisma.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
    return this.issueTokens(session.user, userAgent);
  }

  async logout(refreshToken: string) {
    await this.prisma.session.updateMany({
      where: { refreshTokenHash: sha256(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async me(authUser: AuthUser) {
    const user = await this.prisma.user.findUnique({ where: { id: authUser.id } });
    if (!user) throw new UnauthorizedException();
    return { user: this.publicUser(user), weddings: await this.accessibleWeddings(user) };
  }

  async updateProfile(authUser: AuthUser, data: { name?: string; email?: string | null }) {
    const user = await this.prisma.user.update({ where: { id: authUser.id }, data });
    return this.publicUser(user);
  }

  async accessibleWeddings(user: Pick<User, 'id' | 'phone'>): Promise<AccessibleWedding[]> {
    const select = { slug: true, brideName: true, groomName: true, weddingDate: true, coverPhotoUrl: true } as const;
    const [memberships, invitations] = await Promise.all([
      this.prisma.weddingMember.findMany({ where: { userId: user.id }, include: { wedding: { select } } }),
      this.prisma.invitation.findMany({ where: { phone: user.phone }, include: { wedding: { select } } }),
    ]);
    const map = new Map<string, AccessibleWedding>();
    for (const inv of invitations) map.set(inv.wedding.slug, { ...inv.wedding, role: 'GUEST' });
    for (const m of memberships) map.set(m.wedding.slug, { ...m.wedding, role: m.role });
    return [...map.values()].sort((a, b) => (a.weddingDate?.getTime() ?? 0) - (b.weddingDate?.getTime() ?? 0));
  }

  private async issueTokens(user: User, userAgent?: string) {
    const weddings = await this.accessibleWeddings(user);
    const payload: AccessTokenPayload = {
      sub: user.id,
      phone: user.phone,
      adm: user.isPlatformAdmin,
      wed: Object.fromEntries(weddings.map((w) => [w.slug, w.role])),
    };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.env.JWT_ACCESS_SECRET,
      expiresIn: this.env.JWT_ACCESS_TTL_SEC,
    });
    const refreshToken = randomToken(48);
    await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash: sha256(refreshToken),
        userAgent: userAgent?.slice(0, 255),
        expiresAt: new Date(Date.now() + this.env.REFRESH_TOKEN_TTL_DAYS * 86_400_000),
      },
    });
    return {
      accessToken,
      refreshToken,
      expiresInSec: this.env.JWT_ACCESS_TTL_SEC,
      user: this.publicUser(user),
      weddings,
    };
  }

  private publicUser(user: User) {
    return { id: user.id, phone: user.phone, name: user.name, email: user.email, isPlatformAdmin: user.isPlatformAdmin };
  }
}
