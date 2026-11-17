import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { ADMIN_ROLES, WeddingAccessService } from '../access/wedding-access.service.js';
import { CurrentUser, type AuthUser } from '../common/auth.js';
import type { UploadedFileData } from '../common/upload.js';
import { WeddingsService } from './weddings.service.js';
import {
  createWeddingSchema,
  memberSchema,
  roomsSchema,
  updateWeddingSchema,
  type CreateWeddingInput,
  type MemberInput,
  type UpdateWeddingInput,
} from './weddings.schemas.js';

const roomsBody = z.object({ rooms: roomsSchema });

@ApiTags('weddings')
@ApiBearerAuth()
@Controller('weddings')
export class WeddingsController {
  constructor(
    private readonly weddings: WeddingsService,
    private readonly access: WeddingAccessService,
  ) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body({ schema: createWeddingSchema }) body: CreateWeddingInput) {
    return this.weddings.create(user, body);
  }

  @Get('mine')
  mine(@CurrentUser() user: AuthUser) {
    return this.weddings.mine(user);
  }

  @Get(':slug')
  async get(@CurrentUser() user: AuthUser, @Param('slug') slug: string) {
    return this.weddings.microsite(await this.access.resolve(user, slug));
  }

  @Patch(':slug')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('slug') slug: string,
    @Body({ schema: updateWeddingSchema }) body: UpdateWeddingInput,
  ) {
    return this.weddings.update(await this.access.require(user, slug, ADMIN_ROLES), body);
  }

  @Put(':slug/rooms')
  async rooms(@CurrentUser() user: AuthUser, @Param('slug') slug: string, @Body({ schema: roomsBody }) body: z.infer<typeof roomsBody>) {
    return this.weddings.replaceRooms(await this.access.require(user, slug, ADMIN_ROLES), body.rooms);
  }

  @Post(':slug/media/:kind')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 100 * 1024 * 1024 } }))
  async upload(
    @CurrentUser() user: AuthUser,
    @Param('slug') slug: string,
    @Param('kind', { schema: z.enum(['cover', 'video']) }) kind: 'cover' | 'video',
    @UploadedFile() file?: UploadedFileData,
  ) {
    if (!file) throw new BadRequestException('Attach a file in the "file" field');
    return this.weddings.uploadMedia(await this.access.require(user, slug, ADMIN_ROLES), kind, file);
  }

  @Get(':slug/dashboard')
  async dashboard(@CurrentUser() user: AuthUser, @Param('slug') slug: string) {
    return this.weddings.dashboard(await this.access.require(user, slug, [...ADMIN_ROLES, 'PLATFORM']));
  }

  @Get(':slug/members')
  async members(@CurrentUser() user: AuthUser, @Param('slug') slug: string) {
    const { wedding } = await this.access.require(user, slug, ADMIN_ROLES);
    return this.weddings.members(wedding.id);
  }

  @Post(':slug/members')
  async addMember(@CurrentUser() user: AuthUser, @Param('slug') slug: string, @Body({ schema: memberSchema }) body: MemberInput) {
    return this.weddings.addMember(await this.access.require(user, slug, ADMIN_ROLES), body);
  }

  @Delete(':slug/members/:memberId')
  @HttpCode(204)
  async removeMember(
    @CurrentUser() user: AuthUser,
    @Param('slug') slug: string,
    @Param('memberId', { schema: z.uuid() }) memberId: string,
  ) {
    await this.weddings.removeMember(await this.access.require(user, slug, ADMIN_ROLES), memberId);
  }
}
