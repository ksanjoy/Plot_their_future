import { Injectable, Logger } from '@nestjs/common';
import { InjectEnv, type Env } from '../config/config.module.js';
import { NotificationLogModel } from '../models/schemas.js';
import { SmsService } from './sms.service.js';
import { WhatsAppService, type SendResult, type TemplateMessage } from './whatsapp.service.js';

export interface DeliveryOutcome extends SendResult {
  channel: 'whatsapp' | 'sms';
}

const timeFmt = (tz: string) =>
  new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: tz });

export function formatCeremonyTime(date: Date, tz: string) {
  return timeFmt(tz).format(date);
}

/**
 * Business-level messages. Each WhatsApp template's parameter order is
 * documented in docs/ENVIRONMENT.md and must match the approved Meta template.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectEnv() private readonly env: Env,
    private readonly whatsapp: WhatsAppService,
    private readonly sms: SmsService,
  ) {}

  /** OTP goes over WhatsApp first and falls back to SMS. */
  async sendOtp(phone: string, otp: string): Promise<DeliveryOutcome> {
    try {
      const res = await this.sendWhatsApp({
        to: phone,
        template: this.env.WHATSAPP_TEMPLATE_OTP,
        params: [otp],
        buttonParam: otp,
        preview: `${otp} is your PlotTheirFuture verification code. It expires in ${Math.round(this.env.OTP_TTL_SEC / 60)} minutes.`,
      });
      return { channel: 'whatsapp', ...res };
    } catch (err) {
      this.logger.warn(`WhatsApp OTP failed for ${phone}, falling back to SMS: ${(err as Error).message}`);
    }
    try {
      const res = await this.sms.sendOtp(phone, otp);
      await this.log('sms', phone, 'otp', { length: otp.length }, 'SENT', res.providerMessageId);
      return { channel: 'sms', ...res };
    } catch (err) {
      await this.log('sms', phone, 'otp', {}, 'FAILED', undefined, (err as Error).message);
      throw err;
    }
  }

  sendInvite(input: {
    phone: string;
    guestName: string;
    couple: string;
    ceremonies: string;
    includeRegistry: boolean;
    link: string;
  }) {
    const registryLine = input.includeRegistry
      ? 'Bless their first home by gifting a square foot on the 2 BHK registry.'
      : 'Your presence is the greatest gift.';
    return this.sendWhatsApp({
      to: input.phone,
      template: this.env.WHATSAPP_TEMPLATE_INVITE,
      params: [input.guestName, input.couple, input.ceremonies, registryLine],
      buttonParam: this.relativeToWeb(input.link),
      preview: `Namaste ${input.guestName}! You are invited to the wedding of ${input.couple}.\nCeremonies: ${input.ceremonies}\n${registryLine}\nOpen your invitation: ${input.link}`,
    });
  }

  sendRsvpConfirmation(input: { phone: string; guestName: string; couple: string; summary: string; details: string }) {
    return this.sendWhatsApp({
      to: input.phone,
      template: this.env.WHATSAPP_TEMPLATE_RSVP,
      params: [input.guestName, input.couple, input.summary, input.details],
      preview: `Thank you ${input.guestName}! Your RSVP for ${input.couple} is confirmed: ${input.summary}.\n${input.details}`,
    });
  }

  sendReceipt(input: {
    phone: string;
    donorName: string;
    units: number;
    roomName: string;
    amount: string;
    receiptNumber: string;
    pdfUrl: string;
  }) {
    return this.sendWhatsApp({
      to: input.phone,
      template: this.env.WHATSAPP_TEMPLATE_RECEIPT,
      params: [input.donorName, String(input.units), input.roomName, input.amount, input.receiptNumber],
      document: { url: input.pdfUrl, filename: `${input.receiptNumber}.pdf` },
      preview: `Thank you ${input.donorName}! Your gift of ${input.units} sq.ft. in the ${input.roomName} (${input.amount}) is confirmed. Receipt ${input.receiptNumber} (Sec 56(2)(x) marriage gift): ${input.pdfUrl}`,
    });
  }

  sendReminder(input: { phone: string; guestName: string; ceremony: string; when: string; venue: string }) {
    return this.sendWhatsApp({
      to: input.phone,
      template: this.env.WHATSAPP_TEMPLATE_REMINDER,
      params: [input.guestName, input.ceremony, input.when, input.venue],
      preview: `Reminder for ${input.guestName}: ${input.ceremony} starts at ${input.when} at ${input.venue}.`,
    });
  }

  private relativeToWeb(link: string) {
    const base = this.env.WEB_PUBLIC_URL.replace(/\/$/, '') + '/';
    return link.startsWith(base) ? link.slice(base.length) : link;
  }

  private async sendWhatsApp(msg: TemplateMessage): Promise<SendResult> {
    const payload = { params: msg.params, preview: msg.preview, document: msg.document ?? null };
    try {
      const res = await this.whatsapp.sendTemplate(msg);
      await this.log('whatsapp', msg.to, msg.template, payload, 'SENT', res.providerMessageId);
      return res;
    } catch (err) {
      await this.log('whatsapp', msg.to, msg.template, payload, 'FAILED', undefined, (err as Error).message);
      throw err;
    }
  }

  private async log(
    channel: string,
    recipient: string,
    template: string,
    payload: object,
    status: 'SENT' | 'FAILED',
    providerMessageId?: string,
    error?: string,
  ) {
    const safePayload = template === this.env.WHATSAPP_TEMPLATE_OTP ? { redacted: true } : payload;
    await NotificationLogModel.create({
      channel,
      recipient,
      template,
      payload: safePayload,
      status,
      providerMessageId: providerMessageId ?? null,
      error: error ?? null,
    }).catch((e: Error) => this.logger.error(`Failed to write notification log: ${e.message}`));
  }
}
