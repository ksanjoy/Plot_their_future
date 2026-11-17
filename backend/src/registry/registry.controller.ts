import { Body, Controller, Delete, Get, Header, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { ADMIN_ROLES, WeddingAccessService } from '../access/wedding-access.service.js';
import { CurrentUser, type AuthUser } from '../common/auth.js';
import { toCsv } from '../common/csv.js';
import { SLUG_REGEX } from '../common/utils/format.js';
import { RegistryService } from './registry.service.js';

const lockSchema = z.object({
  slug: z.string().regex(SLUG_REGEX),
  roomKey: z.string().min(1).max(40),
  units: z.number().int().min(1).max(500),
  donorName: z.string().trim().max(80).optional(),
  relationship: z.string().trim().max(80).optional(),
  blessing: z.string().trim().max(500).optional(),
  anonymous: z.boolean().optional(),
  tableNumber: z.string().trim().max(20).optional(),
  refLead: z.string().trim().max(40).optional(),
});

const statusQuery = z.object({
  status: z.enum(['PENDING', 'SUCCESS', 'FAILED', 'EXPIRED', 'CANCELLED', 'REFUND_REQUIRED']).optional(),
});

@ApiTags('registry')
@ApiBearerAuth()
@Controller()
export class RegistryController {
  constructor(
    private readonly registry: RegistryService,
    private readonly access: WeddingAccessService,
  ) {}

  @Get('weddings/:slug/registry')
  async state(@CurrentUser() user: AuthUser, @Param('slug') slug: string) {
    const { wedding } = await this.access.resolve(user, slug);
    return this.registry.state(wedding.id);
  }

  @Post('registry/lock-tile')
  async lock(@CurrentUser() user: AuthUser, @Body({ schema: lockSchema }) body: z.infer<typeof lockSchema>) {
    const { slug, ...input } = body;
    const access = await this.access.resolve(user, slug);
    return this.registry.lockTiles(access, input);
  }

  @Get('registry/contributions/:id')
  get(@CurrentUser() user: AuthUser, @Param('id', { schema: z.uuid() }) id: string) {
    return this.registry.getContribution(user, id);
  }

  @Delete('registry/contributions/:id')
  @HttpCode(204)
  async cancel(@CurrentUser() user: AuthUser, @Param('id', { schema: z.uuid() }) id: string) {
    await this.registry.cancel(user, id);
  }

  @Get('weddings/:slug/donor-wall')
  async donorWall(@CurrentUser() user: AuthUser, @Param('slug') slug: string) {
    const { wedding } = await this.access.resolve(user, slug);
    return this.registry.donorWall(wedding);
  }

  @Get('weddings/:slug/contributions/mine')
  async mine(@CurrentUser() user: AuthUser, @Param('slug') slug: string) {
    const { wedding } = await this.access.resolve(user, slug);
    return this.registry.myContributions(user, wedding.id);
  }

  @Get('weddings/:slug/contributions')
  async list(
    @CurrentUser() user: AuthUser,
    @Param('slug') slug: string,
    @Query({ schema: statusQuery }) query: z.infer<typeof statusQuery>,
  ) {
    const { wedding } = await this.access.require(user, slug, [...ADMIN_ROLES, 'PLATFORM']);
    return this.registry.listContributions(wedding.id, query.status);
  }

  @Get('weddings/:slug/contributions/export.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async export(@CurrentUser() user: AuthUser, @Param('slug') slug: string) {
    const { wedding } = await this.access.require(user, slug, [...ADMIN_ROLES, 'PLATFORM']);
    const rows = await this.registry.listContributions(wedding.id);
    return toCsv(
      ['receipt_number', 'status', 'donor_name', 'donor_phone', 'relationship', 'room', 'sft', 'amount_inr', 'anonymous', 'blessing', 'payment_id', 'paid_at', 'created_at'],
      rows.map((c) => [
        c.receiptNumber,
        c.status,
        c.donorName,
        c.donorPhone,
        c.relationship,
        c.room.name,
        c.units,
        c.amountPaise / 100,
        c.anonymous,
        c.blessing,
        c.providerPaymentId,
        c.paidAt,
        c.createdAt,
      ]),
    );
  }
}
