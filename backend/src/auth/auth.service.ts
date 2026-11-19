import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectEnv, type Env } from '../config/config.module.js';
import type { AccessTokenPayload, AuthUser } from '../common/auth.js';
import { hashPassword, randomToken, sha256, verifyPassword } from '../common/utils/crypto.js';
import { maskPhone, toE164 } from '../common/utils/phone.js';
import { InvitationModel, SessionModel, UserModel, WeddingMemberModel, WeddingModel, type UserDoc, type WeddingDoc } from '../models/schemas.js';
import { NotificationsService } from '../notifications/notifications.service.js';
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
      const wedding = await WeddingModel.findOne({ slug: input.slug }).select('_id');
      if (!wedding) throw new NotFoundException('Wedding not found');
      const account = await UserModel.findOne({ phone }).select('_id');
      const [invitation, member] = await Promise.all([
        InvitationModel.findOne({ weddingId: wedding._id, phone }).select('_id'),
        account ? WeddingMemberModel.findOne({ weddingId: wedding._id, userId: account._id }).select('_id') : null,
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

  async verifyOtp(
    input: { phone: string; otp: string; name?: string; occupation?: string; password?: string },
    userAgent?: string,
  ) {
    const phone = this.normalisePhone(input.phone);
    await this.otp.verify(phone, input.otp);

    const isPlatformAdmin = this.env.PLATFORM_ADMIN_PHONES.includes(phone);
    const existing = await UserModel.findOne({ phone });
    let user: UserDoc;
    const passwordHash = input.password ? await hashPassword(input.password) : undefined;
    if (existing) {
      this.assertActive(existing);
      const patch: { isPlatformAdmin?: boolean; name?: string; occupation?: string; passwordHash?: string; deletedAt?: null } = {};
      if (isPlatformAdmin && !existing.isPlatformAdmin) patch.isPlatformAdmin = true;
      if (input.name) patch.name = input.name;
      if (input.occupation) patch.occupation = input.occupation;
      if (passwordHash) patch.passwordHash = passwordHash;
      if (existing.deletedAt) patch.deletedAt = null;
      user = Object.keys(patch).length
        ? ((await UserModel.findByIdAndUpdate(existing._id, { $set: patch }, { new: true })) ?? existing)
        : existing;
    } else {
      user = await UserModel.create({
        phone,
        name: input.name ?? null,
        occupation: input.occupation ?? null,
        passwordHash: passwordHash ?? null,
        isPlatformAdmin,
      });
    }

    await InvitationModel.updateMany(
      { phone, userId: null },
      { $set: { userId: user._id, ...(user.occupation ? { occupation: user.occupation } : {}) } },
    );
    return this.issueTokens(user, userAgent);
  }

  async login(input: { phone: string; password: string }, userAgent?: string) {
    const phone = this.normalisePhone(input.phone);
    const user = await UserModel.findOne({ phone });
    if (!user?.passwordHash || !(await verifyPassword(input.password, user.passwordHash))) {
      throw new UnauthorizedException({ code: 'INVALID_LOGIN', message: 'Mobile number or password is incorrect' });
    }
    this.assertActive(user);
    return this.issueTokens(user, userAgent);
  }

  async completeProfile(authUser: AuthUser, input: { name: string; occupation: string; password: string }) {
    const passwordHash = await hashPassword(input.password);
    const user = await UserModel.findByIdAndUpdate(
      authUser.id,
      { $set: { name: input.name, occupation: input.occupation, passwordHash, deletedAt: null } },
      { new: true },
    );
    if (!user) throw new NotFoundException('Record not found');
    await InvitationModel.updateMany({ phone: user.phone }, { $set: { occupation: input.occupation } });
    return this.publicUser(user);
  }

  async refresh(refreshToken: string, userAgent?: string) {
    const hash = sha256(refreshToken);
    const session = await SessionModel.findOne({ refreshTokenHash: hash }).populate<{ user: UserDoc }>('user');
    if (!session) throw new UnauthorizedException('Invalid refresh token');
    const user = session.get('user') as UserDoc | undefined;
    if (!user) throw new UnauthorizedException('Invalid refresh token');
    this.assertActive(user);
    if (session.revokedAt) {
      await SessionModel.updateMany({ userId: session.userId, revokedAt: null }, { $set: { revokedAt: new Date() } });
      throw new UnauthorizedException('Refresh token reuse detected. Please sign in again.');
    }
    if (session.expiresAt < new Date()) throw new UnauthorizedException('Session expired. Please sign in again.');
    await SessionModel.updateOne({ _id: session._id }, { $set: { revokedAt: new Date() } });
    return this.issueTokens(user, userAgent);
  }

  async logout(refreshToken: string) {
    await SessionModel.updateMany({ refreshTokenHash: sha256(refreshToken), revokedAt: null }, { $set: { revokedAt: new Date() } });
  }

  async me(authUser: AuthUser) {
    const user = await UserModel.findById(authUser.id);
    if (!user) throw new UnauthorizedException();
    return { user: this.publicUser(user), weddings: await this.accessibleWeddings(user) };
  }

  async updateProfile(
    authUser: AuthUser,
    data: { name?: string; email?: string | null; occupation?: string | null; locale?: string; messageOptOut?: boolean },
  ) {
    const patch: { name?: string; email?: string | null; occupation?: string | null; locale?: string; messageOptOut?: boolean } = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.email !== undefined) patch.email = data.email;
    if (data.occupation !== undefined) patch.occupation = data.occupation;
    if (data.locale !== undefined) patch.locale = data.locale;
    if (data.messageOptOut !== undefined) patch.messageOptOut = data.messageOptOut;
    const user = await UserModel.findByIdAndUpdate(authUser.id, { $set: patch }, { new: true });
    if (!user) throw new NotFoundException('Record not found');
    if (data.messageOptOut !== undefined) {
      await InvitationModel.updateMany({ phone: user.phone }, { $set: { messageOptOut: data.messageOptOut } });
    }
    if (data.occupation) await InvitationModel.updateMany({ phone: user.phone }, { $set: { occupation: data.occupation } });
    return this.publicUser(user);
  }

  /** DPDP erasure: drop profile fields and sign-in secrets. The phone stays so wedding records remain consistent. */
  async erase(authUser: AuthUser) {
    await UserModel.updateOne(
      { _id: authUser.id },
      {
        $set: {
          name: null,
          email: null,
          occupation: null,
          passwordHash: null,
          messageOptOut: true,
          deletedAt: new Date(),
        },
      },
    );
    await SessionModel.updateMany({ userId: authUser.id, revokedAt: null }, { $set: { revokedAt: new Date() } });
    await InvitationModel.updateMany({ phone: authUser.phone }, { $set: { messageOptOut: true, occupation: null } });
  }

  async accessibleWeddings(user: { id: string; phone: string }): Promise<AccessibleWedding[]> {
    const [memberships, invitations] = await Promise.all([
      WeddingMemberModel.find({ userId: user.id }).populate<{ wedding: WeddingDoc }>('wedding'),
      InvitationModel.find({ phone: user.phone }).populate<{ wedding: WeddingDoc }>('wedding'),
    ]);
    const map = new Map<string, AccessibleWedding>();
    for (const inv of invitations) {
      const wedding = inv.get('wedding') as WeddingDoc | undefined;
      if (!wedding) continue;
      map.set(wedding.slug, {
        slug: wedding.slug,
        brideName: wedding.brideName,
        groomName: wedding.groomName,
        weddingDate: wedding.weddingDate,
        coverPhotoUrl: wedding.coverPhotoUrl,
        role: 'GUEST',
      });
    }
    for (const membership of memberships) {
      const wedding = membership.get('wedding') as WeddingDoc | undefined;
      if (!wedding) continue;
      map.set(wedding.slug, {
        slug: wedding.slug,
        brideName: wedding.brideName,
        groomName: wedding.groomName,
        weddingDate: wedding.weddingDate,
        coverPhotoUrl: wedding.coverPhotoUrl,
        role: membership.role,
      });
    }
    return [...map.values()].sort((a, b) => (a.weddingDate?.getTime() ?? 0) - (b.weddingDate?.getTime() ?? 0));
  }

  private async issueTokens(user: UserDoc, userAgent?: string) {
    const weddings = await this.accessibleWeddings({ id: user.id, phone: user.phone });
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
    await SessionModel.create({
      userId: user._id,
      refreshTokenHash: sha256(refreshToken),
      userAgent: userAgent?.slice(0, 255) ?? null,
      expiresAt: new Date(Date.now() + this.env.REFRESH_TOKEN_TTL_DAYS * 86_400_000),
    });
    return {
      accessToken,
      refreshToken,
      expiresInSec: this.env.JWT_ACCESS_TTL_SEC,
      user: this.publicUser(user),
      weddings,
    };
  }

  private assertActive(user: UserDoc) {
    if (user.blockedAt) {
      throw new ForbiddenException({
        code: 'ACCOUNT_BLOCKED',
        message: user.blockedReason ? `This account is blocked: ${user.blockedReason}` : 'This account is blocked. Contact support.',
      });
    }
  }

  private publicUser(user: UserDoc) {
    return {
      id: user.id,
      phone: user.phone,
      name: user.name,
      email: user.email,
      occupation: user.occupation,
      isPlatformAdmin: user.isPlatformAdmin,
      profileComplete: Boolean(user.name && user.occupation && user.passwordHash),
      messageOptOut: user.messageOptOut,
      locale: user.locale || 'en',
    };
  }
}
