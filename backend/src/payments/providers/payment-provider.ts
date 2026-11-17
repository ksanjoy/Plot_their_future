export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');

export interface CreateOrderInput {
  amountPaise: number;
  receipt: string;
  notes: Record<string, string>;
}

export interface CheckoutContext {
  contributionId: string;
  orderId: string;
  amountPaise: number;
  description: string;
  donorName: string;
  donorPhone?: string | null;
}

export interface WebhookResult {
  eventId: string;
  type: string;
  orderId?: string;
  paymentId?: string;
  outcome: 'paid' | 'failed' | 'ignored';
  reason?: string;
  payload: unknown;
}

export interface PaymentProvider {
  readonly name: 'mock' | 'razorpay';
  createOrder(input: CreateOrderInput): Promise<{ orderId: string }>;
  /** Parameters the browser needs to open the provider's checkout. */
  checkoutParams(ctx: CheckoutContext): Record<string, unknown>;
  /** Verifies the signature returned to the browser after a successful payment. */
  verifyCheckout(input: { orderId: string; paymentId: string; signature: string }): boolean;
  /** Verifies and parses a webhook. Throws when the signature is invalid. */
  parseWebhook(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): WebhookResult;
}
