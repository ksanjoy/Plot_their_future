import { Body, Controller, Get, Header, Param, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { objectId } from '../common/id.js';
import { STAFF_ROLES, WeddingAccessService } from '../access/wedding-access.service.js';
import { CurrentUser, type AuthUser } from '../common/auth.js';
import { RsvpService } from './rsvp.service.js';

const text = (max: number) => z.string().trim().max(max).nullish();
const rsvpSchema = z.object({
  status: z.enum(['ATTENDING', 'DECLINED', 'MAYBE']),
  adults: z.number().int().min(0).max(10).default(1),
  children: z.number().int().min(0).max(10).default(0),
  infants: z.number().int().min(0).max(10).default(0),
  attendingCeremonyIds: z.array(objectId).max(50).default([]),
  dietary: z.array(z.enum(['VEG', 'NON_VEG', 'JAIN', 'VEGAN', 'SATVIK', 'GLUTEN_FREE', 'OTHER'])).max(6).default([]),
  foodPreference: z.enum(['VEG', 'NON_VEG', 'JAIN', 'OTHER']).nullish(),
  accommodationRooms: z.number().int().min(0).max(20).default(0),
  accommodationGuests: z.number().int().min(0).max(40).default(0),
  ceremonyResponses: z
    .array(
      z.object({
        ceremonyId: objectId,
        status: z.enum(['ATTENDING', 'DECLINED', 'MAYBE']),
        adults: z.number().int().min(0).max(10).default(0),
        children: z.number().int().min(0).max(10).default(0),
      }),
    )
    .max(20)
    .optional(),
  occupation: z.string().trim().min(1).max(80).optional(),
  allergies: text(200),
  arrivalMode: z.enum(['FLIGHT', 'TRAIN', 'ROAD', 'LOCAL']).nullish(),
  arrivalDetails: text(120),
  arrivalAt: z.coerce.date().nullish(),
  needsAccommodation: z.boolean().default(false),
  checkInDate: z.coerce.date().nullish(),
  checkOutDate: z.coerce.date().nullish(),
  needsShuttle: z.boolean().default(false),
  note: text(500),
  guestName: z.string().trim().min(1).max(80).optional(),
  email: z.email().nullish(),
});
const listQuery = z.object({ status: z.enum(['ATTENDING', 'DECLINED', 'MAYBE']).optional() });
const VIEWERS = [...STAFF_ROLES, 'PLATFORM' as const];

@ApiTags('rsvp')
@ApiBearerAuth()
@Controller('weddings/:slug')
export class RsvpController {
  constructor(
    private readonly rsvp: RsvpService,
    private readonly access: WeddingAccessService,
  ) {}

  @Get('rsvp/me')
  async mine(@CurrentUser() user: AuthUser, @Param('slug') slug: string) {
    return this.rsvp.mine(await this.access.resolve(user, slug));
  }

  @Put('rsvp/me')
  async upsert(@CurrentUser() user: AuthUser, @Param('slug') slug: string, @Body({ schema: rsvpSchema }) body: z.infer<typeof rsvpSchema>) {
    return this.rsvp.upsert(await this.access.resolve(user, slug), body);
  }

  @Get('rsvps')
  async list(@CurrentUser() user: AuthUser, @Param('slug') slug: string, @Query({ schema: listQuery }) q: z.infer<typeof listQuery>) {
    return this.rsvp.list(await this.access.require(user, slug, VIEWERS), q.status);
  }

  @Get('rsvps/summary')
  async summary(@CurrentUser() user: AuthUser, @Param('slug') slug: string) {
    return this.rsvp.scopedSummary(await this.access.require(user, slug, VIEWERS));
  }

  @Get('rsvps/export.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="rsvps.csv"')
  async export(@CurrentUser() user: AuthUser, @Param('slug') slug: string) {
    return this.rsvp.exportCsv(await this.access.require(user, slug, VIEWERS));
  }
}
