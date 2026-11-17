import { Controller, Get, Inject, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { CurrentUser, Public, type AuthUser } from '../common/auth.js';
import { InjectEnv, type Env } from '../config/config.module.js';
import { PAYMENT_PROVIDER, type PaymentProvider } from '../payments/providers/payment-provider.js';
import { WeddingsService } from './weddings.service.js';

@ApiTags('public')
@Controller('public')
export class PublicController {
  constructor(
    private readonly weddings: WeddingsService,
    @InjectEnv() private readonly env: Env,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
  ) {}

  /** Home feed. Anonymous visitors see every celebration masked; invitees see theirs unlocked. */
  @Public()
  @Get('weddings')
  feed(@CurrentUser() user?: AuthUser) {
    return this.weddings.publicFeed(user);
  }

  @Public()
  @Get('invitations/:refToken')
  invitation(@Param('refToken', { schema: z.string().regex(/^[a-z0-9]{6,40}$/) }) refToken: string) {
    return this.weddings.invitationPreview(refToken);
  }

  /** Runtime flags the clients need (e.g. to show the simulated payment panel). */
  @Public()
  @Get('config')
  config() {
    return {
      paymentProvider: this.provider.name,
      razorpayKeyId: this.provider.name === 'razorpay' ? this.env.RAZORPAY_KEY_ID : null,
      otpLength: 6,
      otpTtlSec: this.env.OTP_TTL_SEC,
      defaultCountry: this.env.DEFAULT_PHONE_COUNTRY,
      devOtpExposed: this.env.EXPOSE_DEV_OTP && this.env.NODE_ENV !== 'production',
    };
  }
}
