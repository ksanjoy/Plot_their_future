import { randomUUID } from 'node:crypto';
import { UnauthorizedException } from '@nestjs/common';
import type { CheckoutContext, CreateOrderInput, PaymentProvider, WebhookResult } from './payment-provider.js';

/**
 * Development/demo gateway. Orders are local; payments are completed through
 * POST /payments/mock/:id/complete. Refused at startup when NODE_ENV=production.
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly name = 'mock' as const;

  async createOrder(_input: CreateOrderInput) {
    return { orderId: `mock_order_${randomUUID().replaceAll('-', '')}` };
  }

  checkoutParams(ctx: CheckoutContext) {
    return {
      provider: this.name,
      orderId: ctx.orderId,
      amount: ctx.amountPaise,
      currency: 'INR',
      description: ctx.description,
    };
  }

  verifyCheckout() {
    return false;
  }

  parseWebhook(): WebhookResult {
    throw new UnauthorizedException('The mock payment provider does not accept webhooks');
  }
}
