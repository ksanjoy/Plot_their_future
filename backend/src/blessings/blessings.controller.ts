import { Body, Controller, Get, Param, Patch, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { STAFF_ROLES, WeddingAccessService } from '../access/wedding-access.service.js';
import { CurrentUser, type AuthUser } from '../common/auth.js';
import type { UploadedFileData } from '../common/upload.js';
import { BlessingsService } from './blessings.service.js';

const createSchema = z.object({
  message: z.string().trim().max(280).nullish(),
  authorName: z.string().trim().max(60).optional(),
  tableNumber: z.string().trim().max(10).nullish(),
});
const listQuery = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'HIDDEN']).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
const moderateSchema = z.object({ status: z.enum(['APPROVED', 'HIDDEN', 'PENDING']) });
const MODERATORS = [...STAFF_ROLES, 'PLATFORM' as const];

@ApiTags('blessings')
@ApiBearerAuth()
@Controller('weddings/:slug/blessings')
export class BlessingsController {
  constructor(
    private readonly blessings: BlessingsService,
    private readonly access: WeddingAccessService,
  ) {}

  @Get()
  async list(@CurrentUser() user: AuthUser, @Param('slug') slug: string, @Query({ schema: listQuery }) q: z.infer<typeof listQuery>) {
    const access = await this.access.resolve(user, slug);
    const status = q.status && MODERATORS.includes(access.role) ? q.status : 'APPROVED';
    return this.blessings.list(access.wedding.id, status, q.limit);
  }

  @Post()
  @ApiConsumes('multipart/form-data', 'application/json')
  @UseInterceptors(FileInterceptor('photo', { limits: { fileSize: 8 * 1024 * 1024 } }))
  async create(
    @CurrentUser() user: AuthUser,
    @Param('slug') slug: string,
    @Body({ schema: createSchema }) body: z.infer<typeof createSchema>,
    @UploadedFile() photo?: UploadedFileData,
  ) {
    return this.blessings.create(await this.access.resolve(user, slug), body, photo);
  }

  @Patch(':id')
  async moderate(
    @CurrentUser() user: AuthUser,
    @Param('slug') slug: string,
    @Param('id', { schema: z.uuid() }) id: string,
    @Body({ schema: moderateSchema }) body: z.infer<typeof moderateSchema>,
  ) {
    return this.blessings.moderate(await this.access.require(user, slug, MODERATORS), id, body.status);
  }
}
