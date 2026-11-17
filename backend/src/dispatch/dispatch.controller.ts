import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { objectId } from '../common/id.js';
import { ADMIN_ROLES, WeddingAccessService } from '../access/wedding-access.service.js';
import { CurrentUser, type AuthUser } from '../common/auth.js';
import { DispatchService } from './dispatch.service.js';

const dispatchSchema = z.object({
  ceremonyIds: z.array(objectId).max(50).optional(),
  cohorts: z.array(z.enum(['CLOSE_FAMILY', 'FAMILY', 'FRIENDS', 'COLLEAGUES', 'VIP', 'OTHER'])).max(6).optional(),
  invitationIds: z.array(objectId).max(5000).optional(),
  includeRegistry: z.boolean().default(true),
  onlyPendingRsvp: z.boolean().optional(),
});
type DispatchBody = z.infer<typeof dispatchSchema>;
const SENDERS = [...ADMIN_ROLES, 'LEAD' as const];

@ApiTags('dispatch')
@ApiBearerAuth()
@Controller('weddings/:slug/dispatches')
export class DispatchController {
  constructor(
    private readonly dispatch: DispatchService,
    private readonly access: WeddingAccessService,
  ) {}

  @Get()
  async list(@CurrentUser() user: AuthUser, @Param('slug') slug: string) {
    return this.dispatch.list(await this.access.require(user, slug, SENDERS));
  }

  @Post('preview')
  async preview(@CurrentUser() user: AuthUser, @Param('slug') slug: string, @Body({ schema: dispatchSchema }) body: DispatchBody) {
    return this.dispatch.preview(await this.access.require(user, slug, SENDERS), body);
  }

  @Post()
  async create(@CurrentUser() user: AuthUser, @Param('slug') slug: string, @Body({ schema: dispatchSchema }) body: DispatchBody) {
    return this.dispatch.create(await this.access.require(user, slug, SENDERS), body);
  }

  @Get(':id')
  async detail(@CurrentUser() user: AuthUser, @Param('slug') slug: string, @Param('id', { schema: objectId }) id: string) {
    return this.dispatch.detail(await this.access.require(user, slug, SENDERS), id);
  }
}
