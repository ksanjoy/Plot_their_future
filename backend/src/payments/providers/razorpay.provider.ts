import { BadGatewayException, UnauthorizedException } from '@nestjs/common';
import type { Env } from '../../config/config.module.js';
import { hmacSha256, safeEqual, sha256 } from '../../common/utils/crypto.js';
import type { CheckoutContext, CreateOrderInput, PaymentProvider, WebhookResult } from './payment-provider.js';

interface RazorpayWebhook {
  event: string;
  payload?: {
    payment?: { entity?: { id?: string; order_id?: string; status?: string; error_description?: string } };
    order?: { entity?: { id?: string } };
  };
}

export class RazorpayProvider implements PaymentProvider {
  readonly name = 'razorpay' as const;

  constructor(private readonly env: Env) {}

  async createOrder(input: CreateOrderInput) {
    const auth = Buffer.from(`${this.env.RAZORPAY_KEY_ID}:${this.env.RAZORPAY_KEY_SECRET}`).toString('base64');
    const res = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: input.amountPaise, currency: 'INR', receipt: input.receipt.slice(0, 40), notes: input.notes }),
      signal: AbortSignal.timeout(10_000),
    });
    const body = (await res.json().catch(() => ({}))) as { id?: string; error?: { description?: string } };
    if (!res.ok || !body.id) {
      throw new BadGatewayException(`Payment gateway error: ${body.error?.description ?? res.statusText}`);
    }
    return { orderId: body.id };
  }

  checkoutParams(ctx: CheckoutContext) {
    return {
      provider: this.name,
      keyId: this.env.RAZORPAY_KEY_ID,
      orderId: ctx.orderId,
      amount: ctx.amountPaise,
      currency: 'INR',
      name: 'PlotTheirFuture',
      description: ctx.description,
      prefill: { name: ctx.donorName, contact: ctx.donorPhone ?? undefined },
      notes: { contributionId: ctx.contributionId },
    };
  }

  verifyCheckout(input: { orderId: string; paymentId: string; signature: string }) {
    const expected = hmacSha256(this.env.RAZORPAY_KEY_SECRET, `${input.orderId}|${input.paymentId}`);
    return safeEqual(expected, input.signature);
  }

  parseWebhook(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): WebhookResult {
    const signature = String(headers['x-razorpay-signature'] ?? '');
    const expected = hmacSha256(this.env.RAZORPAY_WEBHOOK_SECRET, rawBody);
    if (!signature || !safeEqual(expected, signature)) throw new UnauthorizedException('Invalid webhook signature');

    const body = JSON.parse(rawBody.toString('utf8')) as RazorpayWebhook;
    const eventId = String(headers['x-razorpay-event-id'] ?? sha256(rawBody));
    const payment = body.payload?.payment?.entity;
    const orderId = payment?.order_id ?? body.payload?.order?.entity?.id;
    const base = { eventId, type: body.event, orderId, paymentId: payment?.id, payload: body };

    switch (body.event) {
      case 'payment.captured':
      case 'order.paid':
        return { ...base, outcome: 'paid' };
      case 'payment.failed':
        return { ...base, outcome: 'failed', reason: payment?.error_description ?? 'Payment failed' };
      default:
        return { ...base, outcome: 'ignored' };
    }
  }
}
