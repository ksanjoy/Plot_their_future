import { Injectable, Logger } from '@nestjs/common';
import { InjectEnv, type Env } from '../config/config.module.js';

export interface TemplateMessage {
  to: string;
  template: string;
  /** Ordered body parameters ({{1}}, {{2}}, ...). */
  params: string[];
  /** Dynamic suffix for a URL button (index 0), e.g. an invite path or OTP code. */
  buttonParam?: string;
  document?: { url: string; filename: string };
  /** Human readable rendering, used by the console driver and stored in the log. */
  preview: string;
}

export interface SendResult {
  providerMessageId?: string;
}

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger('WhatsApp');

  constructor(@InjectEnv() private readonly env: Env) {}

  get driver() {
    return this.env.WHATSAPP_DRIVER;
  }

  async sendTemplate(msg: TemplateMessage): Promise<SendResult> {
    if (this.env.WHATSAPP_DRIVER === 'console') {
      this.logger.log(`[console] to=${msg.to} template=${msg.template}\n${msg.preview}`);
      return { providerMessageId: `console-${Date.now()}` };
    }

    const components: Record<string, unknown>[] = [];
    if (msg.document) {
      components.push({
        type: 'header',
        parameters: [{ type: 'document', document: { link: msg.document.url, filename: msg.document.filename } }],
      });
    }
    if (msg.params.length) {
      components.push({ type: 'body', parameters: msg.params.map((text) => ({ type: 'text', text })) });
    }
    if (msg.buttonParam) {
      components.push({
        type: 'button',
        sub_type: 'url',
        index: '0',
        parameters: [{ type: 'text', text: msg.buttonParam }],
      });
    }

    const url = `https://graph.facebook.com/${this.env.WHATSAPP_API_VERSION}/${this.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.env.WHATSAPP_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: msg.to.replace(/^\+/, ''),
        type: 'template',
        template: { name: msg.template, language: { code: this.env.WHATSAPP_TEMPLATE_LANGUAGE }, components },
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const body = (await res.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { message?: string } };
    if (!res.ok) throw new Error(`WhatsApp API ${res.status}: ${body.error?.message ?? 'unknown error'}`);
    return { providerMessageId: body.messages?.[0]?.id };
  }
}
