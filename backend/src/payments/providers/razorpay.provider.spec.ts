import { UnauthorizedException } from '@nestjs/common';
import { hmacSha256 } from '../../common/utils/crypto.js';
import type { Env } from '../../config/config.module.js';
import { RazorpayProvider } from './razorpay.provider.js';

const env = { RAZORPAY_KEY_ID: 'rzp_test_key', RAZORPAY_KEY_SECRET: 'key-secret', RAZORPAY_WEBHOOK_SECRET: 'hook-secret' } as Env;
const provider = new RazorpayProvider(env);

describe('RazorpayProvider', () => {
  it('verifies the checkout signature over order_id|payment_id', () => {
    const signature = hmacSha256('key-secret', 'order_1|pay_1');
    expect(provider.verifyCheckout({ orderId: 'order_1', paymentId: 'pay_1', signature })).toBe(true);
    expect(provider.verifyCheckout({ orderId: 'order_1', paymentId: 'pay_2', signature })).toBe(false);
  });

  it('parses a signed payment.captured webhook', () => {
    const raw = Buffer.from(JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_9', order_id: 'order_9' } } } }));
    const result = provider.parseWebhook(raw, { 'x-razorpay-signature': hmacSha256('hook-secret', raw), 'x-razorpay-event-id': 'evt_1' });
    expect(result).toMatchObject({ eventId: 'evt_1', outcome: 'paid', orderId: 'order_9', paymentId: 'pay_9' });
  });

  it('maps payment.failed and ignores unrelated events', () => {
    const failed = Buffer.from(JSON.stringify({ event: 'payment.failed', payload: { payment: { entity: { id: 'p', order_id: 'o', error_description: 'Card declined' } } } }));
    expect(provider.parseWebhook(failed, { 'x-razorpay-signature': hmacSha256('hook-secret', failed) })).toMatchObject({ outcome: 'failed', reason: 'Card declined' });
    const other = Buffer.from(JSON.stringify({ event: 'refund.created' }));
    expect(provider.parseWebhook(other, { 'x-razorpay-signature': hmacSha256('hook-secret', other) }).outcome).toBe('ignored');
  });

  it('rejects tampered webhooks', () => {
    const raw = Buffer.from('{"event":"payment.captured"}');
    expect(() => provider.parseWebhook(raw, { 'x-razorpay-signature': 'nope' })).toThrow(UnauthorizedException);
    expect(() => provider.parseWebhook(raw, {})).toThrow(UnauthorizedException);
  });
});
