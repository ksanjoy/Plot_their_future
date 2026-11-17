import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { ADMIN_ROLES, WeddingAccessService } from '../access/wedding-access.service.js';
import { CurrentUser, type AuthUser } from '../common/auth.js';
import type { UploadedFileData } from '../common/upload.js';
import { GuestsService } from './guests.service.js';

const cohort = z.enum(['CLOSE_FAMILY', 'FAMILY', 'FRIENDS', 'COLLEAGUES', 'VIP', 'OTHER']);
const guestSchema = z.object({
  guestName: z.string().trim().min(1).max(80),
  phone: z.string().min(6).max(20),
  email: z.email().nullish(),
  cohort: cohort.optional(),
  maxAttendees: z.number().int().min(1).max(10).optional(),
  enableRegistry: z.boolean().optional(),
  ceremonyIds: z.array(z.uuid()).max(50).optional(),
  refLead: z.string().trim().max(30).nullish(),
});
const querySchema = z.object({
  search: z.string().trim().max(80).optional(),
  cohort: cohort.optional(),
  ceremonyId: z.uuid().optional(),
  rsvp: z.enum(['ATTENDING', 'DECLINED', 'MAYBE', 'PENDING']).optional(),
});
const MANAGERS = [...ADMIN_ROLES, 'LEAD' as const];

@ApiTags('guests')
@ApiBearerAuth()
@Controller('weddings/:slug/guests')
export class GuestsController {
  constructor(
    private readonly guests: GuestsService,
    private readonly access: WeddingAccessService,
  ) {}

  @Get()
  async list(@CurrentUser() user: AuthUser, @Param('slug') slug: string, @Query({ schema: querySchema }) q: z.infer<typeof querySchema>) {
    return this.guests.list(await this.access.require(user, slug, MANAGERS), q);
  }

  @Get('export.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="guests.csv"')
  async export(@CurrentUser() user: AuthUser, @Param('slug') slug: string) {
    return this.guests.exportCsv(await this.access.require(user, slug, MANAGERS));
  }

  @Post()
  async create(@CurrentUser() user: AuthUser, @Param('slug') slug: string, @Body({ schema: guestSchema }) body: z.infer<typeof guestSchema>) {
    return this.guests.create(await this.access.require(user, slug, MANAGERS), body);
  }

  @Post('import')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async import(@CurrentUser() user: AuthUser, @Param('slug') slug: string, @UploadedFile() file?: UploadedFileData) {
    if (!file) throw new BadRequestException('Attach a CSV file in the "file" field');
    return this.guests.importCsv(await this.access.require(user, slug, MANAGERS), file.buffer);
  }

  @Get(':id')
  async get(@CurrentUser() user: AuthUser, @Param('slug') slug: string, @Param('id', { schema: z.uuid() }) id: string) {
    return this.guests.get(await this.access.require(user, slug, MANAGERS), id);
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('slug') slug: string,
    @Param('id', { schema: z.uuid() }) id: string,
    @Body({ schema: guestSchema.partial() }) body: Partial<z.infer<typeof guestSchema>>,
  ) {
    return this.guests.update(await this.access.require(user, slug, MANAGERS), id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentUser() user: AuthUser, @Param('slug') slug: string, @Param('id', { schema: z.uuid() }) id: string) {
    await this.guests.remove(await this.access.require(user, slug, MANAGERS), id);
  }
}
