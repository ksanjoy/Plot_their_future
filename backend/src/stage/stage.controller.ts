import { Controller, Get, NotFoundException, Param, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import QRCode from 'qrcode';
import { z } from 'zod';
import { STAFF_ROLES, WeddingAccessService } from '../access/wedding-access.service.js';
import { CurrentUser, Public, type AuthUser } from '../common/auth.js';
import { InjectEnv, type Env } from '../config/config.module.js';
import { BlessingsService } from '../blessings/blessings.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RegistryService } from '../registry/registry.service.js';

const qrQuery = z.object({
  table: z.string().trim().regex(/^[A-Za-z0-9-]{1,10}$/).optional(),
  size: z.coerce.number().int().min(128).max(1024).default(512),
});

@ApiTags('stage')
@Controller('weddings/:slug/stage')
export class StageController {
  constructor(
    @InjectEnv() private readonly env: Env,
    private readonly access: WeddingAccessService,
    private readonly registry: RegistryService,
    private readonly blessings: BlessingsService,
    private readonly prisma: PrismaService,
  ) {}

  private giftUrl(slug: string, table?: string) {
    const url = new URL(`/w/${slug}`, this.env.WEB_PUBLIC_URL);
    url.searchParams.set('gift', '1');
    if (table) url.searchParams.set('table', table);
    return url.toString();
  }

  /** Initial payload for the venue LED screen; live updates arrive on the `stage` socket channel. */
  @ApiBearerAuth()
  @Get()
  async stage(@CurrentUser() user: AuthUser, @Param('slug') slug: string) {
    const { wedding } = await this.access.require(user, slug, [...STAFF_ROLES, 'PLATFORM']);
    const mode = wedding.stageDisplayMode;
    const [registry, donors, blessings] = await Promise.all([
      this.registry.state(wedding.id),
      this.registry.donorWall(wedding, 30, mode),
      mode === 'PROGRESS_ONLY' ? Promise.resolve([]) : this.blessings.list(wedding.id, 'APPROVED', 30, mode),
    ]);
    return {
      wedding: {
        id: wedding.id,
        slug: wedding.slug,
        brideName: wedding.brideName,
        groomName: wedding.groomName,
        propertyName: wedding.propertyName,
        weddingDate: wedding.weddingDate,
        displayMode: mode,
      },
      registry: { ...registry, rooms: registry.rooms.map(({ cells: _cells, donors: _donors, ...r }) => r) },
      donors,
      blessings,
      giftUrl: this.giftUrl(wedding.slug),
    };
  }

  /** Table-tent QR codes; they only encode a link to the invite-gated microsite. */
  @Public()
  @Get('qr.png')
  async qr(@Param('slug') slug: string, @Query({ schema: qrQuery }) q: z.infer<typeof qrQuery>, @Res() res: Response) {
    const exists = await this.prisma.wedding.findUnique({ where: { slug }, select: { id: true } });
    if (!exists) throw new NotFoundException('Wedding not found');
    const png = await QRCode.toBuffer(this.giftUrl(slug, q.table), {
      type: 'png',
      width: q.size,
      margin: 1,
      color: { dark: '#8B1E2D', light: '#FFFFFF' },
      errorCorrectionLevel: 'M',
    });
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(png);
  }
}
