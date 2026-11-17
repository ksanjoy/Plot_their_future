import { BadRequestException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectEnv, type Env } from '../config/config.module.js';
import { hmacSha256, randomOtp, randomToken, safeEqual } from '../common/utils/crypto.js';
import { RedisService } from '../redis/redis.service.js';

interface StoredOtp {
  hash: string;
  attempts: number;
  requestId: string;
}

const RESEND_COOLDOWN_SEC = 30;
const MAX_REQUESTS_PER_HOUR = 6;

@Injectable()
export class OtpService {
  constructor(
    @InjectEnv() private readonly env: Env,
    private readonly redis: RedisService,
  ) {}

  private key = (phone: string) => `otp:code:${phone}`;
  private hash = (phone: string, otp: string) => hmacSha256(this.env.OTP_PEPPER, `${phone}:${otp}`);

  async issue(phone: string): Promise<{ otp: string; requestId: string; resendAfterSec: number }> {
    const cooldown = await this.redis.client.set(`otp:cool:${phone}`, '1', 'EX', RESEND_COOLDOWN_SEC, 'NX');
    if (cooldown !== 'OK') {
      const ttl = await this.redis.client.ttl(`otp:cool:${phone}`);
      throw new HttpException(
        { code: 'OTP_COOLDOWN', message: `Please wait ${Math.max(ttl, 1)}s before requesting another code`, retryAfterSec: ttl },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const hourly = await this.redis.hit(`otp:hour:${phone}`, 3600);
    if (hourly > MAX_REQUESTS_PER_HOUR) {
      throw new HttpException({ code: 'OTP_LIMIT', message: 'Too many codes requested. Try again in an hour.' }, HttpStatus.TOO_MANY_REQUESTS);
    }

    const otp = randomOtp();
    const record: StoredOtp = { hash: this.hash(phone, otp), attempts: 0, requestId: randomToken(12) };
    await this.redis.client.set(this.key(phone), JSON.stringify(record), 'EX', this.env.OTP_TTL_SEC);
    return { otp, requestId: record.requestId, resendAfterSec: RESEND_COOLDOWN_SEC };
  }

  async verify(phone: string, otp: string): Promise<void> {
    const raw = await this.redis.client.get(this.key(phone));
    if (!raw) throw new BadRequestException({ code: 'OTP_EXPIRED', message: 'Code expired. Please request a new one.' });
    const record = JSON.parse(raw) as StoredOtp;

    if (!safeEqual(record.hash, this.hash(phone, otp))) {
      record.attempts += 1;
      if (record.attempts >= this.env.OTP_MAX_ATTEMPTS) {
        await this.redis.client.del(this.key(phone));
        throw new HttpException({ code: 'OTP_LOCKED', message: 'Too many incorrect attempts. Request a new code.' }, HttpStatus.TOO_MANY_REQUESTS);
      }
      const ttl = await this.redis.client.ttl(this.key(phone));
      await this.redis.client.set(this.key(phone), JSON.stringify(record), 'EX', Math.max(ttl, 1));
      throw new BadRequestException({
        code: 'OTP_INVALID',
        message: 'Incorrect code',
        attemptsLeft: this.env.OTP_MAX_ATTEMPTS - record.attempts,
      });
    }
    await this.redis.client.del(this.key(phone), `otp:cool:${phone}`);
  }
}
