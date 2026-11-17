import { BadRequestException, GoneException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectEnv, type Env } from '../config/config.module.js';
import { isDuplicateKey } from '../database/helpers.js';
import { ContributionModel, PaymentEventModel, type RoomZoneDoc, type WeddingDoc } from '../models/schemas.js';
import { RegistryService } from '../registry/registry.service.js';
import { PAYMENT_PROVIDER, type PaymentProvider } from './providers/payment-provider.js';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectEnv() private readonly env: Env,
    private readonly registry: RegistryService,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
  ) {}

  async checkout(contributionId: string) {
    const c = await ContributionModel.findById(contributionId).populate<{ room: RoomZoneDoc }>('room').populate<{ wedding: WeddingDoc }>('wedding');
    if (!c) throw new NotFoundException('Gift not found');
    const room = c.get('room') as RoomZoneDoc;
    const wedding = c.get('wedding') as WeddingDoc;
    const base = {
      contributionId: c.id,
      status: c.status,
      units: c.units,
      amountPaise: c.amountPaise,
      ratePaise: c.ratePaise,
      room: { key: room.key, name: room.name },
      donorName: c.donorName,
      blessing: c.blessing,
      holdExpiresAt: c.holdExpiresAt,
      wedding: { slug: wedding.slug, brideName: wedding.brideName, groomName: wedding.groomName },
      links: this.registry.linksFor(c),
    };
    if (c.status === 'EXPIRED' || (c.status === 'PENDING' && c.holdExpiresAt.getTime() < Date.now())) {
      const minutes = Math.round(wedding.cartHoldTtlSec / 60);
      throw new GoneException({
        code: 'HOLD_EXPIRED',
        message: `Your ${minutes}-minute reservation expired. Please pick your square feet again.`,
        wedding: base.wedding,
      });
    }
    if (c.status !== 'PENDING') return { ...base, payment: null };
    if (!c.providerOrderId) throw new GoneException('Payment order missing, please start again');
    return {
      ...base,
      payment: this.provider.checkoutParams({
        contributionId: c.id,
        orderId: c.providerOrderId,
        amountPaise: c.amountPaise,
        description: `${c.units} sq.ft. in ${room.name} • ${wedding.brideName} & ${wedding.groomName}`,
        donorName: c.donorName,
        donorPhone: c.donorPhone,
      }),
    };
  }

  async verifyCheckout(contributionId: string, input: { orderId: string; paymentId: string; signature: string }) {
    const c = await ContributionModel.findById(contributionId);
    if (!c || c.providerOrderId !== input.orderId) throw new BadRequestException('Order does not match this gift');
    if (!this.provider.verifyCheckout(input)) throw new BadRequestException('Payment signature verification failed');
    const { contribution } = await this.registry.confirmPaid(c.id, input.paymentId);
    return { status: contribution.status, links: this.registry.linksFor(contribution) };
  }

  async completeMock(contributionId: string, outcome: 'success' | 'failure') {
    if (this.provider.name !== 'mock' || this.env.NODE_ENV === 'production') {
      throw new NotFoundException();
    }
    const c = await ContributionModel.findById(contributionId);
    if (!c) throw new NotFoundException('Gift not found');
    if (c.status !== 'PENDING' && c.status !== 'SUCCESS') {
      throw new GoneException({ code: 'HOLD_EXPIRED', message: 'This reservation is no longer active' });
    }
    if (outcome === 'failure') {
      await this.registry.markFailed(c.id, 'Payment declined (simulated)');
      const failed = await ContributionModel.findById(c.id);
      if (!failed) throw new NotFoundException('Gift not found');
      return { status: failed.status, links: this.registry.linksFor(failed) };
    }
    const { contribution } = await this.registry.confirmPaid(c.id, `mock_pay_${Date.now()}`);
    return { status: contribution.status, links: this.registry.linksFor(contribution) };
  }

  async handleWebhook(rawBody: Buffer | undefined, headers: Record<string, string | string[] | undefined>) {
    if (!rawBody) throw new BadRequestException('Missing body');
    const event = this.provider.parseWebhook(rawBody, headers);

    try {
      await PaymentEventModel.create({
        provider: this.provider.name,
        eventId: event.eventId,
        type: event.type,
        payload: event.payload as Record<string, unknown>,
      });
    } catch (err) {
      if (isDuplicateKey(err)) return { received: true, duplicate: true };
      throw err;
    }

    if (event.outcome === 'ignored' || !event.orderId) return { received: true };
    const c = await ContributionModel.findOne({ providerOrderId: event.orderId });
    if (!c) {
      this.logger.warn(`Webhook ${event.type} for unknown order ${event.orderId}`);
      return { received: true };
    }
    if (event.outcome === 'paid') await this.registry.confirmPaid(c.id, event.paymentId ?? event.eventId);
    else await this.registry.markFailed(c.id, event.reason ?? 'Payment failed');
    return { received: true };
  }
}
