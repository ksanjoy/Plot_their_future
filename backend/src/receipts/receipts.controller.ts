import { Controller, Get, NotFoundException, Param, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { z } from 'zod';
import { ADMIN_ROLES } from '../access/wedding-access.service.js';
import { LinkTokenService } from '../auth/link-token.service.js';
import { CurrentUser, Public, type AuthUser } from '../common/auth.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ReceiptsService } from './receipts.service.js';

const tokenQuery = z.object({ t: z.string().optional() });

@ApiTags('receipts')
@Controller('receipts')
export class ReceiptsController {
  constructor(
    private readonly receipts: ReceiptsService,
    private readonly links: LinkTokenService,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Get('verify/:receiptNumber')
  verify(@Param('receiptNumber', { schema: z.string().regex(/^PTF-\d{4}-[A-Z0-9]{8}$/) }) receiptNumber: string) {
    return this.receipts.verify(receiptNumber);
  }

  @Public()
  @Get(':id')
  async data(
    @Param('id', { schema: z.uuid() }) id: string,
    @Query({ schema: tokenQuery }) q: z.infer<typeof tokenQuery>,
    @CurrentUser() user?: AuthUser,
  ) {
    await this.authorise(id, q.t, user);
    return this.receipts.receiptData(id);
  }

  @Public()
  @Get(':id/pdf')
  async pdf(
    @Param('id', { schema: z.uuid() }) id: string,
    @Query({ schema: tokenQuery }) q: z.infer<typeof tokenQuery>,
    @Res() res: Response,
    @CurrentUser() user?: AuthUser,
  ) {
    await this.authorise(id, q.t, user);
    const { filename, buffer } = await this.receipts.renderPdf(id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(buffer);
  }

  /** Either a signed receipt link, or a session belonging to the donor or a wedding admin. */
  private async authorise(id: string, token: string | undefined, user?: AuthUser) {
    if (token) return this.links.verify(token, id, 'receipt');
    if (!user) throw new NotFoundException('Receipt not found');
    const c = await this.prisma.contribution.findUnique({ where: { id }, select: { userId: true, weddingId: true } });
    if (!c) throw new NotFoundException('Receipt not found');
    if (c.userId === user.id) return;
    const member = await this.prisma.weddingMember.findUnique({
      where: { weddingId_userId: { weddingId: c.weddingId, userId: user.id } },
    });
    if (!member || !ADMIN_ROLES.includes(member.role)) throw new NotFoundException('Receipt not found');
  }
}
