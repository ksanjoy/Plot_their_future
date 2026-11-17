import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { objectId } from '../common/id.js';
import { WeddingAccessService } from '../access/wedding-access.service.js';
import { CurrentUser, type AuthUser } from '../common/auth.js';
import { FinanceService } from './finance.service.js';

const settlementSchema = z.object({
  amount: z.number().positive().max(10_00_00_000).describe('Rupees'),
  destination: z.enum(['BUILDER_ESCROW', 'HOME_LOAN']),
  beneficiaryName: z.string().trim().min(2).max(100),
  accountNumber: z.string().regex(/^\d{9,18}$/, 'Account number must be 9-18 digits'),
  ifsc: z.string().regex(/^[A-Za-z]{4}0[A-Za-z0-9]{6}$/, 'Invalid IFSC'),
});
const reasonSchema = z.object({ reason: z.string().trim().min(3).max(300) });
const disburseSchema = z.object({ bankReference: z.string().trim().min(4).max(60) });
const statusQuery = z.object({ status: z.enum(['REQUESTED', 'HOST_APPROVED', 'APPROVED', 'DISBURSED', 'REJECTED']).optional() });
const HOSTS = ['HOST' as const, 'CO_HOST' as const];

@ApiTags('finance')
@ApiBearerAuth()
@Controller()
export class FinanceController {
  constructor(
    private readonly finance: FinanceService,
    private readonly access: WeddingAccessService,
  ) {}

  @Get('weddings/:slug/ledger')
  async ledger(@CurrentUser() user: AuthUser, @Param('slug') slug: string) {
    return this.finance.ledger(await this.access.require(user, slug, [...HOSTS, 'PLATFORM']));
  }

  @Post('weddings/:slug/settlements')
  async request(@CurrentUser() user: AuthUser, @Param('slug') slug: string, @Body({ schema: settlementSchema }) body: z.infer<typeof settlementSchema>) {
    const { amount, ...rest } = body;
    return this.finance.request(await this.access.require(user, slug, HOSTS), { ...rest, amountPaise: Math.round(amount * 100) });
  }

  @Post('weddings/:slug/settlements/:id/approve')
  async hostApprove(@CurrentUser() user: AuthUser, @Param('slug') slug: string, @Param('id', { schema: objectId }) id: string) {
    return this.finance.hostApprove(await this.access.require(user, slug, ['HOST']), id);
  }

  @Post('weddings/:slug/settlements/:id/reject')
  async hostReject(
    @CurrentUser() user: AuthUser,
    @Param('slug') slug: string,
    @Param('id', { schema: objectId }) id: string,
    @Body({ schema: reasonSchema }) body: z.infer<typeof reasonSchema>,
  ) {
    return this.finance.reject(user, id, body.reason, await this.access.require(user, slug, HOSTS));
  }

  @Get('admin/settlements')
  list(@CurrentUser() user: AuthUser, @Query({ schema: statusQuery }) q: z.infer<typeof statusQuery>) {
    return this.finance.listForCompliance(user, q.status);
  }

  @Post('admin/settlements/:id/approve')
  approve(@CurrentUser() user: AuthUser, @Param('id', { schema: objectId }) id: string) {
    return this.finance.complianceApprove(user, id);
  }

  @Post('admin/settlements/:id/disburse')
  disburse(@CurrentUser() user: AuthUser, @Param('id', { schema: objectId }) id: string, @Body({ schema: disburseSchema }) body: z.infer<typeof disburseSchema>) {
    return this.finance.disburse(user, id, body.bankReference);
  }

  @Post('admin/settlements/:id/reject')
  reject(@CurrentUser() user: AuthUser, @Param('id', { schema: objectId }) id: string, @Body({ schema: reasonSchema }) body: z.infer<typeof reasonSchema>) {
    return this.finance.reject(user, id, body.reason);
  }
}
