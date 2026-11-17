import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { z } from 'zod';
import { ADMIN_ROLES, WeddingAccessService } from '../access/wedding-access.service.js';
import { CurrentUser, type AuthUser } from '../common/auth.js';
import { CeremoniesService } from './ceremonies.service.js';

const url = z.union([z.url(), z.literal('').transform(() => null)]).nullish();
const ceremonyBase = z.object({
    title: z.string().trim().min(1).max(80),
    description: z.string().trim().max(1000).nullish(),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date().nullish(),
    venueName: z.string().trim().min(1).max(100),
    venueAddress: z.string().trim().max(300).nullish(),
    venueMapsUrl: url,
    streamUrl: url,
    dressCode: z.string().trim().max(40).nullish(),
    sortOrder: z.number().int().min(0).max(1000).optional(),
});
const ceremonySchema = ceremonyBase.refine((c) => !c.endsAt || c.endsAt > c.startsAt, {
  message: 'endsAt must be after startsAt',
  path: ['endsAt'],
});
const updateSchema = ceremonyBase.partial();

@ApiTags('ceremonies')
@ApiBearerAuth()
@Controller('weddings/:slug/ceremonies')
export class CeremoniesController {
  constructor(
    private readonly ceremonies: CeremoniesService,
    private readonly access: WeddingAccessService,
  ) {}

  @Get()
  async list(@CurrentUser() user: AuthUser, @Param('slug') slug: string) {
    return this.ceremonies.list(await this.access.resolve(user, slug));
  }

  @Post()
  async create(@CurrentUser() user: AuthUser, @Param('slug') slug: string, @Body({ schema: ceremonySchema }) body: z.infer<typeof ceremonySchema>) {
    return this.ceremonies.create(await this.access.require(user, slug, ADMIN_ROLES), body);
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('slug') slug: string,
    @Param('id', { schema: z.uuid() }) id: string,
    @Body({ schema: updateSchema }) body: z.infer<typeof updateSchema>,
  ) {
    return this.ceremonies.update(await this.access.require(user, slug, ADMIN_ROLES), id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentUser() user: AuthUser, @Param('slug') slug: string, @Param('id', { schema: z.uuid() }) id: string) {
    await this.ceremonies.remove(await this.access.require(user, slug, ADMIN_ROLES), id);
  }

  @Get(':id/calendar.ics')
  async ics(
    @CurrentUser() user: AuthUser,
    @Param('slug') slug: string,
    @Param('id', { schema: z.uuid() }) id: string,
    @Res() res: Response,
  ) {
    const { filename, body } = await this.ceremonies.ics(await this.access.resolve(user, slug), id);
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(body);
  }
}
