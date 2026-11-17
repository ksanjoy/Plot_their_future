import { Injectable, Logger } from '@nestjs/common';
import { InjectEnv, type Env } from '../config/config.module.js';
import type { SendResult } from './whatsapp.service.js';

@Injectable()
export class SmsService {
  private readonly logger = new Logger('SMS');

  constructor(@InjectEnv() private readonly env: Env) {}

  async sendOtp(to: string, otp: string): Promise<SendResult> {
    if (this.env.SMS_DRIVER === 'console') {
      this.logger.log(`[console] OTP for ${to}: ${otp}`);
      return { providerMessageId: `console-${Date.now()}` };
    }
    const url = new URL('https://control.msg91.com/api/v5/otp');
    url.searchParams.set('template_id', this.env.MSG91_OTP_TEMPLATE_ID);
    url.searchParams.set('mobile', to.replace(/^\+/, ''));
    url.searchParams.set('otp', otp);
    const res = await fetch(url, {
      method: 'POST',
      headers: { authkey: this.env.MSG91_AUTH_KEY, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });
    const body = (await res.json().catch(() => ({}))) as { type?: string; request_id?: string; message?: string };
    if (!res.ok || body.type === 'error') throw new Error(`MSG91 ${res.status}: ${body.message ?? 'unknown error'}`);
    return { providerMessageId: body.request_id };
  }
}
