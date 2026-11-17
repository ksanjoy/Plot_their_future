import { Body, Controller, Get, Headers, HttpCode, Param, Post, Query, Req, type RawBodyRequest } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request } from 'express';
import { z } from 'zod';
import { objectId } from '../common/id.js';
import { LinkTokenService } from '../auth/link-token.service.js';
import { Public } from '../common/auth.js';
import { PaymentsService } from './payments.service.js';

const tokenQuery = z.object({ t: z.string().min(10) });
const verifySchema = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
});
const mockSchema = z.object({ outcome: z.enum(['success', 'failure']) });

/**
 * Checkout endpoints are authorised by a signed link token (`?t=`), so the
 * same /pay page works from the web microsite, the mobile app's browser hand
 * off, or a WhatsApp link.
 */
@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly links: LinkTokenService,
  ) {}

  @Public()
  @Get('checkout/:id')
  checkout(@Param('id', { schema: objectId }) id: string, @Query({ schema: tokenQuery }) q: z.infer<typeof tokenQuery>) {
    this.links.verify(q.t, id, 'checkout');
    return this.payments.checkout(id);
  }

  @Public()
  @Post('checkout/:id/verify')
  @HttpCode(200)
  verify(
    @Param('id', { schema: objectId }) id: string,
    @Query({ schema: tokenQuery }) q: z.infer<typeof tokenQuery>,
    @Body({ schema: verifySchema }) body: z.infer<typeof verifySchema>,
  ) {
    this.links.verify(q.t, id, 'checkout');
    return this.payments.verifyCheckout(id, {
      orderId: body.razorpay_order_id,
      paymentId: body.razorpay_payment_id,
      signature: body.razorpay_signature,
    });
  }

  @Public()
  @Post('mock/:id/complete')
  @HttpCode(200)
  mock(
    @Param('id', { schema: objectId }) id: string,
    @Query({ schema: tokenQuery }) q: z.infer<typeof tokenQuery>,
    @Body({ schema: mockSchema }) body: z.infer<typeof mockSchema>,
  ) {
    this.links.verify(q.t, id, 'checkout');
    return this.payments.completeMock(id, body.outcome);
  }

  @Public()
  @SkipThrottle()
  @Post('webhooks/razorpay')
  @HttpCode(200)
  webhook(@Req() req: RawBodyRequest<Request>, @Headers() headers: Record<string, string>) {
    return this.payments.handleWebhook(req.rawBody, headers);
  }
}
