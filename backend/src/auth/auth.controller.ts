import { Body, Controller, Delete, Get, Headers, HttpCode, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import { CurrentUser, Public, type AuthUser } from '../common/auth.js';
import { SLUG_REGEX } from '../common/utils/format.js';
import { AuthService } from './auth.service.js';

const requestOtpSchema = z.object({
  phone: z.string().min(6).max(20),
  slug: z.string().regex(SLUG_REGEX).optional(),
});
const passwordSchema = z.string().min(8).max(72);
const verifyOtpSchema = z.object({
  phone: z.string().min(6).max(20),
  otp: z.string().regex(/^\d{6}$/, 'OTP must be 6 digits'),
  name: z.string().trim().min(1).max(80).optional(),
  occupation: z.string().trim().min(1).max(80).optional(),
  password: passwordSchema.optional(),
});
const loginSchema = z.object({
  phone: z.string().min(6).max(20),
  password: passwordSchema,
});
const completeProfileSchema = z.object({
  name: z.string().trim().min(1).max(80),
  occupation: z.string().trim().min(1).max(80),
  password: passwordSchema,
});
const refreshSchema = z.object({ refreshToken: z.string().min(20) });
const profileSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  email: z.email().nullable().optional(),
  occupation: z.string().trim().min(1).max(80).nullable().optional(),
  locale: z.enum(['en', 'hi', 'te']).optional(),
  messageOptOut: z.boolean().optional(),
});

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('request-otp')
  @HttpCode(200)
  requestOtp(@Body({ schema: requestOtpSchema }) body: z.infer<typeof requestOtpSchema>) {
    return this.auth.requestOtp(body);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('verify-otp')
  @HttpCode(200)
  verifyOtp(@Body({ schema: verifyOtpSchema }) body: z.infer<typeof verifyOtpSchema>, @Headers('user-agent') ua?: string) {
    return this.auth.verifyOtp(body, ua);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @HttpCode(200)
  login(@Body({ schema: loginSchema }) body: z.infer<typeof loginSchema>, @Headers('user-agent') ua?: string) {
    return this.auth.login(body, ua);
  }

  @ApiBearerAuth()
  @Post('complete-profile')
  completeProfile(@CurrentUser() user: AuthUser, @Body({ schema: completeProfileSchema }) body: z.infer<typeof completeProfileSchema>) {
    return this.auth.completeProfile(user, body);
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  refresh(@Body({ schema: refreshSchema }) body: z.infer<typeof refreshSchema>, @Headers('user-agent') ua?: string) {
    return this.auth.refresh(body.refreshToken, ua);
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(@Body({ schema: refreshSchema }) body: z.infer<typeof refreshSchema>) {
    await this.auth.logout(body.refreshToken);
  }

  @ApiBearerAuth()
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user);
  }

  @ApiBearerAuth()
  @Patch('me')
  updateMe(@CurrentUser() user: AuthUser, @Body({ schema: profileSchema }) body: z.infer<typeof profileSchema>) {
    return this.auth.updateProfile(user, body);
  }

  @ApiBearerAuth()
  @Delete('me')
  @HttpCode(204)
  async erase(@CurrentUser() user: AuthUser) {
    await this.auth.erase(user);
  }
}
