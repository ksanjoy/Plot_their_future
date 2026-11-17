import { InjectQueue } from '@nestjs/bullmq';
import {
  BadGatewayException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Queue } from 'bullmq';
import type { WeddingAccess } from '../access/wedding-access.service.js';
import { ADMIN_ROLES } from '../access/wedding-access.service.js';
import { LinkTokenService } from '../auth/link-token.service.js';
import type { AuthUser } from '../common/auth.js';
import { randomCode } from '../common/utils/crypto.js';
import { initialsOf } from '../common/utils/format.js';
import { InjectEnv, type Env } from '../config/config.module.js';
import type { Contribution, ContributionStatus, RoomZone, StageDisplayMode, Wedding } from '../generated/prisma/client.js';
import { QUEUES } from '../jobs/queues.js';
import { PAYMENT_PROVIDER, type PaymentProvider } from '../payments/providers/payment-provider.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RealtimeService, rooms as liveRooms } from '../realtime/realtime.service.js';
import { RedisService } from '../redis/redis.service.js';

export interface LockTilesInput {
  roomKey: string;
  units: number;
  donorName?: string;
  relationship?: string;
  blessing?: string;
  anonymous?: boolean;
  tableNumber?: string;
  refLead?: string;
}

const MAX_OPEN_HOLDS_PER_USER = 3;
export const ANONYMOUS_NAME = 'A Well-Wisher';

type ContributionWithRoom = Contribution & { room: RoomZone };

@Injectable()
export class RegistryService {
  private readonly logger = new Logger(RegistryService.name);

  constructor(
    @InjectEnv() private readonly env: Env,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly realtime: RealtimeService,
    private readonly links: LinkTokenService,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
    @InjectQueue(QUEUES.receipts) private readonly receiptsQueue: Queue,
  ) {}

  private lockKey = (weddingId: string) => `lock:registry:${weddingId}`;

  // ---------------------------------------------------------------- reads

  /** Full floor-plan state: per-room totals plus a compact per-tile status string. */
  async state(weddingId: string) {
    const wedding = await this.prisma.wedding.findUniqueOrThrow({ where: { id: weddingId } });
    const [rooms, tiles] = await Promise.all([
      this.prisma.roomZone.findMany({ where: { weddingId }, orderBy: { sortOrder: 'asc' } }),
      this.prisma.floorTile.findMany({
        where: { weddingId },
        orderBy: { index: 'asc' },
        select: {
          index: true,
          roomId: true,
          status: true,
          lockedUntil: true,
          contribution: { select: { donorName: true, anonymous: true } },
        },
      }),
    ]);
    const now = Date.now();
    const byRoom = new Map(
      rooms.map((r) => [r.id, { cells: [] as string[], donors: {} as Record<number, string>, startIndex: -1, funded: 0, held: 0 }]),
    );
    for (const t of tiles) {
      const bucket = byRoom.get(t.roomId)!;
      if (bucket.startIndex < 0) bucket.startIndex = t.index;
      let code = 'O';
      if (t.status === 'FUNDED') {
        code = 'F';
        bucket.funded++;
        if (t.contribution) bucket.donors[t.index] = t.contribution.anonymous ? '♥' : initialsOf(t.contribution.donorName);
      } else if (t.status === 'HOLD' && t.lockedUntil && t.lockedUntil.getTime() > now) {
        code = 'H';
        bucket.held++;
      }
      bucket.cells.push(code);
    }

    const roomViews = rooms.map((r) => {
      const b = byRoom.get(r.id)!;
      return {
        id: r.id,
        key: r.key,
        name: r.name,
        description: r.description,
        icon: r.icon,
        sft: r.sft,
        fundedSft: b.funded,
        heldSft: b.held,
        openSft: r.sft - b.funded - b.held,
        startIndex: b.startIndex,
        cells: b.cells.join(''),
        donors: b.donors,
      };
    });
    const fundedSft = roomViews.reduce((s, r) => s + r.fundedSft, 0);
    const heldSft = roomViews.reduce((s, r) => s + r.heldSft, 0);
    return {
      totalSft: wedding.totalSft,
      fundedSft,
      heldSft,
      openSft: wedding.totalSft - fundedSft - heldSft,
      progress: wedding.totalSft ? fundedSft / wedding.totalSft : 0,
      ratePerSftPaise: wedding.ratePerSftPaise,
      raisedPaise: await this.raisedPaise(weddingId),
      targetPaise: wedding.totalSft * wedding.ratePerSftPaise,
      presetTiers: wedding.presetTiers,
      holdTtlSec: wedding.cartHoldTtlSec,
      rooms: roomViews,
    };
  }

  async summary(wedding: Wedding) {
    const now = new Date();
    const [funded, held] = await Promise.all([
      this.prisma.floorTile.count({ where: { weddingId: wedding.id, status: 'FUNDED' } }),
      this.prisma.floorTile.count({ where: { weddingId: wedding.id, status: 'HOLD', lockedUntil: { gt: now } } }),
    ]);
    return {
      totalSft: wedding.totalSft,
      fundedSft: funded,
      heldSft: held,
      progress: wedding.totalSft ? funded / wedding.totalSft : 0,
      ratePerSftPaise: wedding.ratePerSftPaise,
      raisedPaise: await this.raisedPaise(wedding.id),
      targetPaise: wedding.totalSft * wedding.ratePerSftPaise,
      presetTiers: wedding.presetTiers,
      holdTtlSec: wedding.cartHoldTtlSec,
    };
  }

  private async raisedPaise(weddingId: string) {
    const agg = await this.prisma.contribution.aggregate({
      where: { weddingId, status: 'SUCCESS' },
      _sum: { amountPaise: true },
    });
    return agg._sum.amountPaise ?? 0;
  }

  async donorWall(wedding: Wedding, limit = 50, mode: StageDisplayMode = 'NAMES_AND_BLESSINGS') {
    const rows = await this.prisma.contribution.findMany({
      where: { weddingId: wedding.id, status: 'SUCCESS' },
      orderBy: { paidAt: 'desc' },
      take: limit,
      include: { room: true },
    });
    return rows.map((c) => this.wallEntry(c, mode));
  }

  wallEntry(c: ContributionWithRoom, mode: StageDisplayMode = 'NAMES_AND_BLESSINGS') {
    const hideName = c.anonymous || mode !== 'NAMES_AND_BLESSINGS';
    return {
      id: c.id,
      donorName: hideName ? ANONYMOUS_NAME : c.donorName,
      initials: hideName ? '♥' : initialsOf(c.donorName),
      relationship: hideName ? null : c.relationship,
      units: c.units,
      room: { key: c.room.key, name: c.room.name },
      blessing: mode === 'PROGRESS_ONLY' ? null : c.blessing,
      tableNumber: c.tableNumber,
      paidAt: c.paidAt,
    };
  }

  async listContributions(weddingId: string, status?: ContributionStatus) {
    const rows = await this.prisma.contribution.findMany({
      where: { weddingId, ...(status ? { status } : {}) },
      orderBy: { createdAt: 'desc' },
      include: { room: true },
      take: 1000,
    });
    return rows.map((c) => this.ownerView(c));
  }

  async myContributions(user: AuthUser, weddingId: string) {
    const rows = await this.prisma.contribution.findMany({
      where: { weddingId, userId: user.id, status: { in: ['SUCCESS', 'PENDING', 'REFUND_REQUIRED'] } },
      orderBy: { createdAt: 'desc' },
      include: { room: true },
    });
    return rows.map((c) => ({ ...this.ownerView(c), links: this.linksFor(c) }));
  }

  async getContribution(user: AuthUser, id: string) {
    const c = await this.prisma.contribution.findUnique({
      where: { id },
      include: { room: true, wedding: true, tiles: { select: { index: true }, orderBy: { index: 'asc' } } },
    });
    if (!c) throw new NotFoundException('Contribution not found');
    if (c.userId !== user.id) {
      const member = await this.prisma.weddingMember.findUnique({
        where: { weddingId_userId: { weddingId: c.weddingId, userId: user.id } },
      });
      if (!member || !ADMIN_ROLES.includes(member.role)) throw new NotFoundException('Contribution not found');
    }
    return {
      ...this.ownerView(c),
      tileIndexes: c.status === 'SUCCESS' ? c.tiles.map((t) => t.index) : [],
      wedding: { slug: c.wedding.slug, brideName: c.wedding.brideName, groomName: c.wedding.groomName },
      links: this.linksFor(c),
    };
  }

  ownerView(c: ContributionWithRoom) {
    return {
      id: c.id,
      status: c.status,
      units: c.units,
      ratePaise: c.ratePaise,
      amountPaise: c.amountPaise,
      room: { key: c.room.key, name: c.room.name },
      donorName: c.donorName,
      donorPhone: c.donorPhone,
      relationship: c.relationship,
      blessing: c.blessing,
      anonymous: c.anonymous,
      tableNumber: c.tableNumber,
      refLead: c.refLead,
      provider: c.provider,
      providerPaymentId: c.providerPaymentId,
      receiptNumber: c.receiptNumber,
      receiptHash: c.receiptHash,
      holdExpiresAt: c.holdExpiresAt,
      paidAt: c.paidAt,
      failureReason: c.failureReason,
      createdAt: c.createdAt,
    };
  }

  linksFor(c: Pick<Contribution, 'id' | 'status' | 'holdExpiresAt'>) {
    const web = this.env.WEB_PUBLIC_URL.replace(/\/$/, '');
    const api = this.env.API_PUBLIC_URL.replace(/\/$/, '');
    const holdLeftSec = Math.max(0, Math.ceil((c.holdExpiresAt.getTime() - Date.now()) / 1000));
    return {
      checkoutUrl:
        c.status === 'PENDING' && holdLeftSec > 0
          ? `${web}/pay/${c.id}?t=${this.links.sign(c.id, 'checkout', holdLeftSec + 900)}`
          : null,
      receiptUrl:
        c.status === 'SUCCESS' ? `${api}/api/v1/receipts/${c.id}/pdf?t=${this.links.sign(c.id, 'receipt', 7 * 86_400)}` : null,
      thankYouUrl: c.status === 'SUCCESS' ? `${web}/thank-you/${c.id}?t=${this.links.sign(c.id, 'receipt', 7 * 86_400)}` : null,
    };
  }

  // ---------------------------------------------------------------- writes

  async lockTiles(access: WeddingAccess, input: LockTilesInput) {
    const { wedding, user, invitation } = access;
    if (access.role === 'GUEST' && invitation && !invitation.enableRegistry) {
      throw new ForbiddenException({ code: 'REGISTRY_DISABLED', message: 'The gift registry is not enabled for your invitation' });
    }
    const room = await this.prisma.roomZone.findUnique({ where: { weddingId_key: { weddingId: wedding.id, key: input.roomKey } } });
    if (!room) throw new NotFoundException('Room not found');

    const now = new Date();
    const openHolds = await this.prisma.contribution.count({
      where: { userId: user.id, weddingId: wedding.id, status: 'PENDING', holdExpiresAt: { gt: now } },
    });
    if (openHolds >= MAX_OPEN_HOLDS_PER_USER) {
      throw new HttpException(
        { code: 'TOO_MANY_HOLDS', message: 'Finish or cancel your pending gifts before reserving more square feet' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const profile = await this.prisma.user.findUnique({ where: { id: user.id } });
    const donorName = (input.donorName || invitation?.guestName || profile?.name || 'Loving Guest').trim();
    const holdExpiresAt = new Date(now.getTime() + wedding.cartHoldTtlSec * 1000);

    const contribution = await this.redis.withLock(this.lockKey(wedding.id), () =>
      this.prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM "FloorTile"
          WHERE "roomId" = ${room.id}::uuid
            AND (status = 'OPEN' OR (status = 'HOLD' AND "lockedUntil" < ${now}))
          ORDER BY index
          LIMIT ${input.units}
          FOR UPDATE SKIP LOCKED`;
        if (rows.length < input.units) {
          throw new ConflictException({
            code: 'INSUFFICIENT_SFT',
            message: rows.length
              ? `Only ${rows.length} sq.ft. are still available in the ${room.name}`
              : `The ${room.name} is fully gifted. Please choose another room.`,
            available: rows.length,
          });
        }
        const created = await tx.contribution.create({
          data: {
            weddingId: wedding.id,
            userId: user.id,
            roomId: room.id,
            units: input.units,
            ratePaise: wedding.ratePerSftPaise,
            amountPaise: input.units * wedding.ratePerSftPaise,
            donorName,
            donorPhone: user.phone,
            relationship: input.relationship?.trim() || null,
            blessing: input.blessing?.trim() || null,
            anonymous: input.anonymous ?? false,
            tableNumber: input.tableNumber?.trim() || null,
            refLead: input.refLead?.trim() || invitation?.refLead || null,
            provider: this.provider.name,
            holdExpiresAt,
          },
          include: { room: true },
        });
        await tx.floorTile.updateMany({
          where: { id: { in: rows.map((r) => r.id) } },
          data: { status: 'HOLD', lockedUntil: holdExpiresAt, contributionId: created.id },
        });
        return created;
      }),
    );

    try {
      const order = await this.provider.createOrder({
        amountPaise: contribution.amountPaise,
        receipt: contribution.id,
        notes: { contributionId: contribution.id, wedding: wedding.slug, room: room.key, units: String(input.units) },
      });
      await this.prisma.contribution.update({ where: { id: contribution.id }, data: { providerOrderId: order.orderId } });
    } catch (err) {
      this.logger.error(`Order creation failed for ${contribution.id}: ${(err as Error).message}`);
      await this.releaseTiles(contribution.id, 'FAILED', 'Payment gateway unavailable');
      throw err instanceof HttpException ? err : new BadGatewayException('Payment gateway unavailable, please retry');
    }

    void this.broadcastState(wedding.id);
    return { contribution: this.ownerView(contribution), links: this.linksFor(contribution) };
  }

  async cancel(user: AuthUser, contributionId: string) {
    const c = await this.prisma.contribution.findUnique({ where: { id: contributionId } });
    if (!c || c.userId !== user.id) throw new NotFoundException('Contribution not found');
    if (c.status !== 'PENDING') throw new ConflictException('Only pending gifts can be cancelled');
    await this.releaseTiles(c.id, 'CANCELLED');
    void this.broadcastState(c.weddingId);
  }

  async markFailed(contributionId: string, reason: string) {
    const c = await this.prisma.contribution.findUnique({ where: { id: contributionId } });
    if (!c || c.status !== 'PENDING') return;
    await this.releaseTiles(c.id, 'FAILED', reason);
    void this.broadcastState(c.weddingId);
  }

  private async releaseTiles(contributionId: string, status: 'FAILED' | 'CANCELLED' | 'EXPIRED', reason?: string) {
    await this.prisma.$transaction([
      this.prisma.floorTile.updateMany({
        where: { contributionId, status: 'HOLD' },
        data: { status: 'OPEN', lockedUntil: null, contributionId: null },
      }),
      this.prisma.contribution.updateMany({
        where: { id: contributionId, status: 'PENDING' },
        data: { status, failureReason: reason ?? null },
      }),
    ]);
  }

  /**
   * Idempotently settles a paid contribution. Tiles still held by the
   * contribution are funded; if its hold lapsed, equivalent open tiles are
   * allocated (same room first). When nothing is left the contribution is
   * flagged REFUND_REQUIRED for the finance team.
   */
  async confirmPaid(contributionId: string, paymentId: string) {
    const existing = await this.prisma.contribution.findUnique({ where: { id: contributionId } });
    if (!existing) throw new NotFoundException('Contribution not found');
    if (existing.status === 'SUCCESS' || existing.status === 'REFUND_REQUIRED') {
      return { contribution: existing, alreadyProcessed: true };
    }

    const result = await this.redis.withLock(this.lockKey(existing.weddingId), () =>
      this.prisma.$transaction(async (tx) => {
        const c = await tx.contribution.findUniqueOrThrow({ where: { id: contributionId } });
        if (c.status === 'SUCCESS' || c.status === 'REFUND_REQUIRED') return { contribution: c, alreadyProcessed: true };
        const now = new Date();

        const held = await tx.floorTile.findMany({ where: { contributionId: c.id, status: 'HOLD' }, select: { id: true } });
        const tileIds = held.map((t) => t.id).slice(0, c.units);
        if (tileIds.length < c.units) {
          const extra = await tx.$queryRaw<{ id: string }[]>`
            SELECT t.id FROM "FloorTile" t
            JOIN "RoomZone" r ON r.id = t."roomId"
            WHERE t."weddingId" = ${c.weddingId}::uuid
              AND (t.status = 'OPEN' OR (t.status = 'HOLD' AND t."lockedUntil" < ${now}))
              AND t."contributionId" IS DISTINCT FROM ${c.id}::uuid
            ORDER BY (t."roomId" = ${c.roomId}::uuid) DESC, r."sortOrder", t.index
            LIMIT ${c.units - tileIds.length}
            FOR UPDATE OF t SKIP LOCKED`;
          tileIds.push(...extra.map((t) => t.id));
        }

        if (tileIds.length < c.units) {
          await tx.floorTile.updateMany({
            where: { contributionId: c.id, status: 'HOLD' },
            data: { status: 'OPEN', lockedUntil: null, contributionId: null },
          });
          const flagged = await tx.contribution.update({
            where: { id: c.id },
            data: {
              status: 'REFUND_REQUIRED',
              providerPaymentId: paymentId,
              paidAt: now,
              failureReason: 'Payment received after the registry was fully gifted',
            },
          });
          return { contribution: flagged, alreadyProcessed: false };
        }

        await tx.floorTile.updateMany({
          where: { id: { in: tileIds } },
          data: { status: 'FUNDED', lockedUntil: null, contributionId: c.id },
        });
        const paid = await tx.contribution.update({
          where: { id: c.id },
          data: {
            status: 'SUCCESS',
            providerPaymentId: paymentId,
            paidAt: now,
            failureReason: null,
            receiptNumber: `PTF-${now.getFullYear()}-${randomCode(8).toUpperCase()}`,
          },
        });
        await tx.ledgerEntry.create({
          data: {
            weddingId: c.weddingId,
            contributionId: c.id,
            type: 'CREDIT',
            amountPaise: c.amountPaise,
            reference: paymentId,
          },
        });
        return { contribution: paid, alreadyProcessed: false };
      }),
    );

    if (!result.alreadyProcessed) {
      if (result.contribution.status === 'SUCCESS') {
        await this.receiptsQueue.add('issue', { contributionId }, { jobId: `receipt-${contributionId}` });
        void this.announceFunded(contributionId);
      } else {
        this.logger.warn(`Contribution ${contributionId} needs a refund: registry fully funded`);
      }
      void this.broadcastState(result.contribution.weddingId);
    }
    return result;
  }

  /** Releases expired checkout holds. Runs on a BullMQ job scheduler (one instance at a time). */
  async expireHolds() {
    const now = new Date();
    const affected = await this.prisma.floorTile.findMany({
      where: { status: 'HOLD', lockedUntil: { lt: now } },
      distinct: ['weddingId'],
      select: { weddingId: true },
    });
    const tiles = await this.prisma.floorTile.updateMany({
      where: { status: 'HOLD', lockedUntil: { lt: now } },
      data: { status: 'OPEN', lockedUntil: null, contributionId: null },
    });
    const contributions = await this.prisma.contribution.updateMany({
      where: { status: 'PENDING', holdExpiresAt: { lt: now } },
      data: { status: 'EXPIRED', failureReason: 'Checkout hold expired' },
    });
    for (const { weddingId } of affected) void this.broadcastState(weddingId);
    return { releasedTiles: tiles.count, expiredContributions: contributions.count };
  }

  async broadcastState(weddingId: string) {
    try {
      const state = await this.state(weddingId);
      this.realtime.emit([liveRooms.wedding(weddingId), liveRooms.stage(weddingId)], 'registry.updated', state);
    } catch (err) {
      this.logger.warn(`broadcastState failed: ${(err as Error).message}`);
    }
  }

  private async announceFunded(contributionId: string) {
    const c = await this.prisma.contribution.findUnique({ where: { id: contributionId }, include: { room: true, wedding: true } });
    if (!c) return;
    this.realtime.emit(liveRooms.wedding(c.weddingId), 'contribution.funded', this.wallEntry(c));
    this.realtime.emit(liveRooms.stage(c.weddingId), 'contribution.funded', this.wallEntry(c, c.wedding.stageDisplayMode));
    this.realtime.emit(liveRooms.admin(c.weddingId), 'contribution.funded', this.ownerView(c));
  }
}
