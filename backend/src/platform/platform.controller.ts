import { Body, Controller, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { ADMIN_ROLES, WeddingAccessService } from '../access/wedding-access.service.js';
import { CurrentUser, Public, type AuthUser } from '../common/auth.js';
import { objectId } from '../common/id.js';
import { SLUG_REGEX } from '../common/utils/format.js';
import { InjectEnv, type Env } from '../config/config.module.js';
import { InvitationModel, RsvpModel } from '../models/schemas.js';
import { FollowupsService } from '../notifications/followups.service.js';
import { assertPlatform } from './admin.js';
import { ApprovalsService, type RegistrationInput } from './approvals.service.js';
import { ContentService } from './content.service.js';
import { DirectoryService } from './directory.service.js';
import { FlatsService, type FlatInput } from './flats.service.js';

const locale = z.enum(['en', 'hi', 'te']);
const localized = z.object({ en: z.string().max(8000), hi: z.string().max(8000).optional().default(''), te: z.string().max(8000).optional().default('') });
const areaSchema = z.object({
  name: z.string().trim().min(1).max(60),
  sft: z.number().int().min(1).max(5000),
  description: z.string().trim().max(300).nullish(),
  icon: z.string().trim().max(40).nullish(),
  x: z.number().min(0).max(100).optional(),
  y: z.number().min(0).max(100).optional(),
  w: z.number().min(1).max(100).optional(),
  h: z.number().min(1).max(100).optional(),
});
const flatSchema = z.object({
  name: z.string().trim().min(1).max(120),
  projectName: z.string().trim().max(120).nullish(),
  location: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).nullish(),
  flatType: z.string().trim().min(1).max(40),
  pricePerSft: z.number().int().min(1).max(100_000),
  brickRatio: z.number().int().min(1).max(100).optional(),
  floorPlanUrl: z.string().trim().max(500).nullish(),
  photos: z.array(z.string().trim().max(500)).max(12).optional(),
  amenities: z.array(z.string().trim().max(80)).max(30).optional(),
  highlights: z.array(z.string().trim().max(160)).max(20).optional(),
  targetAmount: z.number().positive().max(100_00_00_000),
  minGift: z.number().min(0).max(10_00_000).optional(),
  areas: z.array(areaSchema).min(1).max(20),
});
const flatPatchSchema = flatSchema.partial().extend({ status: z.enum(['AVAILABLE', 'COMPLETED']).optional() });
const ceremonySchema = z.object({
  title: z.string().trim().min(1).max(80),
  description: z.string().trim().max(1000).nullish(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date().nullish(),
  venueName: z.string().trim().min(1).max(120),
  venueAddress: z.string().trim().max(300).nullish(),
  venueMapsUrl: z.string().trim().max(500).nullish(),
  dressCode: z.string().trim().max(80).nullish(),
  coverImageUrl: z.string().trim().max(500).nullish(),
});
const registrationSchema = z.object({
  brideName: z.string().trim().min(1).max(50),
  groomName: z.string().trim().min(1).max(50),
  welcomeNote: z.string().trim().max(2000).nullish(),
  city: z.string().trim().max(80).nullish(),
  weddingDate: z.coerce.date().nullish(),
  contactMobile: z.string().min(6).max(20),
  coverPhotoUrl: z.string().trim().max(500).nullish(),
  cardImageUrl: z.string().trim().max(500).nullish(),
  flatId: objectId,
  slug: z.string().regex(SLUG_REGEX).min(3).max(60).optional(),
  ceremonies: z.array(ceremonySchema).min(1).max(12),
});
const decisionSchema = z
  .object({
    decision: z.enum(['APPROVED', 'REJECTED', 'CHANGES_REQUESTED']),
    reason: z.string().trim().max(500).optional(),
  })
  .refine((value) => value.decision === 'APPROVED' || (value.reason?.length ?? 0) >= 3, { path: ['reason'], message: 'A reason is required' });
const contentSchema = z.object({
  disclaimer: localized.optional(),
  intro: z.array(z.object({ title: localized, body: localized })).max(6).optional(),
  supportPhone: z.string().trim().max(20).nullable().optional(),
  supportEmail: z.email().nullable().optional(),
  terms: localized.optional(),
  privacy: localized.optional(),
  templates: z.record(z.string().max(40), localized).optional(),
});
const blockSchema = z.object({ reason: z.string().trim().min(3).max(300) });
const complaintSchema = z.object({
  subject: z.string().trim().min(3).max(120),
  message: z.string().trim().min(3).max(2000),
  weddingId: objectId.optional(),
});
const complaintPatch = z.object({
  status: z.enum(['OPEN', 'IN_REVIEW', 'RESOLVED']),
  resolution: z.string().trim().max(500).nullish(),
});
const kycSchema = z.object({
  legalName: z.string().trim().min(2).max(120),
  idLast4: z.string().regex(/^\d{4}$/, 'Last 4 digits only'),
});
const kycReviewSchema = z.object({
  decision: z.enum(['VERIFIED', 'REJECTED']),
  reason: z.string().trim().max(300).optional(),
});

@ApiTags('platform')
@Controller()
export class PlatformController {
  constructor(
    @InjectEnv() private readonly env: Env,
    private readonly flats: FlatsService,
    private readonly approvals: ApprovalsService,
    private readonly content: ContentService,
    private readonly directory: DirectoryService,
    private readonly followups: FollowupsService,
    private readonly access: WeddingAccessService,
  ) {}

  @Public()
  @Get('public/content')
  publicContent(@Query({ schema: z.object({ locale: locale.optional() }) }) query: { locale?: 'en' | 'hi' | 'te' }) {
    return this.content.publicView(query.locale);
  }

  @Public()
  @Get('public/weddings/:slug')
  card(@Param('slug') slug: string) {
    return this.approvals.publicCard(slug);
  }

  @ApiBearerAuth()
  @Get('flats')
  browseFlats() {
    return this.flats.available();
  }

  @ApiBearerAuth()
  @Get('flats/:id')
  flat(@Param('id', { schema: objectId }) id: string) {
    return this.flats.get(id);
  }

  @ApiBearerAuth()
  @Get('admin/flats')
  adminFlats(@CurrentUser() user: AuthUser, @Query({ schema: z.object({ status: z.enum(['AVAILABLE', 'RESERVED', 'COMPLETED', 'ARCHIVED']).optional() }) }) query: { status?: 'AVAILABLE' | 'RESERVED' | 'COMPLETED' | 'ARCHIVED' }) {
    assertPlatform(user);
    return this.flats.list(query.status);
  }

  @ApiBearerAuth()
  @Post('admin/flats')
  createFlat(@CurrentUser() user: AuthUser, @Body({ schema: flatSchema }) body: FlatInput) {
    assertPlatform(user);
    return this.flats.create(user.id, body);
  }

  @ApiBearerAuth()
  @Patch('admin/flats/:id')
  updateFlat(@CurrentUser() user: AuthUser, @Param('id', { schema: objectId }) id: string, @Body({ schema: flatPatchSchema }) body: z.infer<typeof flatPatchSchema>) {
    assertPlatform(user);
    return this.flats.update(user.id, id, body);
  }

  @ApiBearerAuth()
  @Post('admin/flats/:id/archive')
  archiveFlat(@CurrentUser() user: AuthUser, @Param('id', { schema: objectId }) id: string) {
    assertPlatform(user);
    return this.flats.archive(user.id, id);
  }

  @ApiBearerAuth()
  @Post('weddings/registrations')
  register(@CurrentUser() user: AuthUser, @Body({ schema: registrationSchema }) body: RegistrationInput) {
    return this.approvals.register(user, body);
  }

  @ApiBearerAuth()
  @Put('weddings/registrations/:slug')
  updateRegistration(@CurrentUser() user: AuthUser, @Param('slug') slug: string, @Body({ schema: registrationSchema }) body: RegistrationInput) {
    return this.approvals.updateRegistration(user, slug, body);
  }

  @ApiBearerAuth()
  @Get('admin/approvals')
  queue(@CurrentUser() user: AuthUser) {
    assertPlatform(user);
    return this.approvals.queue();
  }

  @ApiBearerAuth()
  @Post('admin/approvals/:weddingId/decision')
  decide(
    @CurrentUser() user: AuthUser,
    @Param('weddingId', { schema: objectId }) weddingId: string,
    @Body({ schema: decisionSchema }) body: z.infer<typeof decisionSchema>,
  ) {
    assertPlatform(user);
    return this.approvals.decide(user, weddingId, body.decision, body.reason);
  }

  @ApiBearerAuth()
  @Post('weddings/:slug/kyc')
  kyc(@CurrentUser() user: AuthUser, @Param('slug') slug: string, @Body({ schema: kycSchema }) body: z.infer<typeof kycSchema>) {
    return this.approvals.submitKyc(user, slug, body);
  }

  @ApiBearerAuth()
  @Post('admin/weddings/:weddingId/kyc')
  reviewKyc(
    @CurrentUser() user: AuthUser,
    @Param('weddingId', { schema: objectId }) weddingId: string,
    @Body({ schema: kycReviewSchema }) body: z.infer<typeof kycReviewSchema>,
  ) {
    assertPlatform(user);
    return this.approvals.reviewKyc(user, weddingId, body.decision, body.reason);
  }

  @ApiBearerAuth()
  @Get('admin/content')
  adminContent(@CurrentUser() user: AuthUser) {
    assertPlatform(user);
    return this.content.adminView();
  }

  @ApiBearerAuth()
  @Put('admin/content')
  saveContent(@CurrentUser() user: AuthUser, @Body({ schema: contentSchema }) body: z.infer<typeof contentSchema>) {
    assertPlatform(user);
    return this.content.update(user.id, body);
  }

  @ApiBearerAuth()
  @Get('admin/users')
  users(@CurrentUser() user: AuthUser, @Query({ schema: z.object({ q: z.string().max(80).optional() }) }) query: { q?: string }) {
    assertPlatform(user);
    return this.directory.users(query.q);
  }

  @ApiBearerAuth()
  @Post('admin/users/:id/block')
  block(@CurrentUser() user: AuthUser, @Param('id', { schema: objectId }) id: string, @Body({ schema: blockSchema }) body: z.infer<typeof blockSchema>) {
    assertPlatform(user);
    return this.directory.block(user.id, id, body.reason);
  }

  @ApiBearerAuth()
  @Post('admin/users/:id/unblock')
  unblock(@CurrentUser() user: AuthUser, @Param('id', { schema: objectId }) id: string) {
    assertPlatform(user);
    return this.directory.unblock(user.id, id);
  }

  @ApiBearerAuth()
  @Post('complaints')
  complain(@CurrentUser() user: AuthUser, @Body({ schema: complaintSchema }) body: z.infer<typeof complaintSchema>) {
    return this.directory.fileComplaint(user.id, body);
  }

  @ApiBearerAuth()
  @Get('admin/complaints')
  listComplaints(@CurrentUser() user: AuthUser, @Query({ schema: z.object({ status: z.enum(['OPEN', 'IN_REVIEW', 'RESOLVED']).optional() }) }) query: { status?: 'OPEN' | 'IN_REVIEW' | 'RESOLVED' }) {
    assertPlatform(user);
    return this.directory.complaints(query.status);
  }

  @ApiBearerAuth()
  @Patch('admin/complaints/:id')
  patchComplaint(@CurrentUser() user: AuthUser, @Param('id', { schema: objectId }) id: string, @Body({ schema: complaintPatch }) body: z.infer<typeof complaintPatch>) {
    assertPlatform(user);
    return this.directory.resolveComplaint(user.id, id, body);
  }

  @ApiBearerAuth()
  @Get('admin/gifts')
  gifts(
    @CurrentUser() user: AuthUser,
    @Query({ schema: z.object({ status: z.string().max(40).optional(), q: z.string().max(80).optional() }) }) query: { status?: string; q?: string },
  ) {
    assertPlatform(user);
    return this.directory.gifts(query.status, query.q);
  }

  @ApiBearerAuth()
  @Get('admin/analytics')
  analytics(@CurrentUser() user: AuthUser) {
    assertPlatform(user);
    return this.directory.analytics();
  }

  @ApiBearerAuth()
  @Get('admin/audit')
  audit(@CurrentUser() user: AuthUser) {
    assertPlatform(user);
    return this.directory.audit();
  }

  @ApiBearerAuth()
  @Post('weddings/:slug/follow-ups')
  async nudge(@CurrentUser() user: AuthUser, @Param('slug') slug: string) {
    const access = await this.access.require(user, slug, ADMIN_ROLES);
    const [invitations, rsvps] = await Promise.all([
      InvitationModel.find({ weddingId: access.wedding._id, messageOptOut: { $ne: true } }),
      RsvpModel.find({ weddingId: access.wedding._id }).select('invitationId status'),
    ]);
    const settled = new Set(rsvps.filter((row) => row.status === 'ATTENDING' || row.status === 'DECLINED').map((row) => String(row.invitationId)));
    const pending = invitations.filter((invite) => !settled.has(invite.id));
    const couple = `${access.wedding.brideName} & ${access.wedding.groomName}`;
    const link = `${this.env.WEB_PUBLIC_URL.replace(/\/$/, '')}/w/${access.wedding.slug}`;
    const sent = await this.followups.remindUndecided(
      access.wedding.id,
      couple,
      link,
      pending.map((invite) => ({
        id: invite.id,
        phone: invite.phone,
        guestName: invite.guestName,
        messageOptOut: invite.messageOptOut,
        userId: invite.userId ? String(invite.userId) : null,
        lastPromoAt: invite.lastPromoAt,
      })),
    );
    return { eligible: pending.length, sent };
  }
}
