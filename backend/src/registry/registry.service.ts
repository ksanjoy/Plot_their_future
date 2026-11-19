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
import type { Types } from 'mongoose';
import type { WeddingAccess } from '../access/wedding-access.service.js';
import { ADMIN_ROLES } from '../access/wedding-access.service.js';
import { LinkTokenService } from '../auth/link-token.service.js';
import type { AuthUser } from '../common/auth.js';
import { randomCode } from '../common/utils/crypto.js';
import { initialsOf } from '../common/utils/format.js';
import { InjectEnv, type Env } from '../config/config.module.js';
import { idString, oid, sameId, withTransaction } from '../database/helpers.js';
import { QUEUES } from '../jobs/queues.js';
import { ROOM_ZONES } from '../models/schemas.js';
import {
  BrickAllocationModel,
  ContributionModel,
  FloorTileModel,
  LedgerEntryModel,
  RoomZoneModel,
  UserModel,
  WeddingMemberModel,
  WeddingModel,
  type ContributionDoc,
  type FloorTileDoc,
  type RoomZoneDoc,
  type WeddingDoc,
} from '../models/schemas.js';
import type { ContributionStatus, GiftUnitKind, StageDisplayMode } from '../models/types.js';
import { FollowupsService } from '../notifications/followups.service.js';
import { PAYMENT_PROVIDER, type PaymentProvider } from '../payments/providers/payment-provider.js';
import { RealtimeService, rooms as liveRooms } from '../realtime/realtime.service.js';
import { RedisService } from '../redis/redis.service.js';

export interface LockTilesInput {
  roomKey: string;
  units?: number;
  mode?: GiftUnitKind;
  amountPaise?: number;
  indexes?: number[];
  donorName?: string;
  relationship?: string;
  blessing?: string;
  anonymous?: boolean;
  hideAmount?: boolean;
  photoKey?: string;
  tableNumber?: string;
  refLead?: string;
}

const MAX_OPEN_HOLDS_PER_USER = 3;
export const ANONYMOUS_NAME = 'A Well-Wisher';

interface RoomRef {
  key: string;
  name: string;
}

interface ContributionWithRoom extends ContributionDoc {
  room: RoomRef;
}

@Injectable()
export class RegistryService {
  private readonly logger = new Logger(RegistryService.name);

  constructor(
    @InjectEnv() private readonly env: Env,
    private readonly redis: RedisService,
    private readonly realtime: RealtimeService,
    private readonly links: LinkTokenService,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
    @InjectQueue(QUEUES.receipts) private readonly receiptsQueue: Queue,
    private readonly followups: FollowupsService,
  ) {}

  private lockKey = (weddingId: string) => `lock:registry:${weddingId}`;

  private availableTiles(now: Date) {
    return {
      $and: [
        { $or: [{ status: 'OPEN' }, { status: 'HOLD', lockedUntil: { $lt: now } }] },
        { fundedBricks: { $in: [0, null] } },
        { heldBricks: { $in: [0, null] } },
      ],
    };
  }

  private targetPaise(wedding: WeddingDoc) {
    return wedding.targetAmountPaise ?? wedding.totalSft * wedding.ratePerSftPaise;
  }

  async state(weddingId: string) {
    const wedding = await WeddingModel.findById(weddingId);
    if (!wedding) throw new NotFoundException('Wedding not found');
    const [rooms, tiles] = await Promise.all([
      RoomZoneModel.find({ weddingId }).sort({ sortOrder: 1 }),
      FloorTileModel.find({ weddingId }).sort({ index: 1 }).populate<{ contribution: { donorName: string; anonymous: boolean } | null }>('contribution', 'donorName anonymous'),
    ]);
    const now = Date.now();
    const ratio = wedding.brickRatio || 10;
    const byRoom = new Map(
      rooms.map((r) => [r.id, { cells: [] as string[], fills: [] as number[], donors: {} as Record<number, string>, startIndex: -1, funded: 0, held: 0, partial: 0, fundedBricks: 0 }]),
    );
    for (const t of tiles) {
      const bucket = byRoom.get(idString(t.roomId));
      if (!bucket) continue;
      if (bucket.startIndex < 0) bucket.startIndex = t.index;
      const contribution = t.get('contribution') as { donorName: string; anonymous: boolean } | null | undefined;
      const fundedBricks = t.fundedBricks || 0;
      const heldBricks = t.heldBricks || 0;
      let code = 'O';
      if (t.status === 'FUNDED') {
        code = 'F';
        bucket.funded++;
        if (contribution) bucket.donors[t.index] = contribution.anonymous ? '♥' : initialsOf(contribution.donorName);
      } else if (t.status === 'HOLD' && t.lockedUntil && t.lockedUntil.getTime() > now && fundedBricks === 0 && heldBricks === 0) {
        code = 'H';
        bucket.held++;
      } else if (fundedBricks > 0 || heldBricks > 0) {
        code = 'P';
        bucket.partial++;
      }
      bucket.cells.push(code);
      bucket.fills.push(t.status === 'FUNDED' ? ratio : fundedBricks);
      bucket.fundedBricks += t.status === 'FUNDED' ? ratio : fundedBricks;
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
        openSft: r.sft - b.funded - b.held - b.partial,
        fundedBricks: b.fundedBricks,
        startIndex: b.startIndex,
        cells: b.cells.join(''),
        fills: b.fills,
        donors: b.donors,
      };
    });
    const fundedSft = roomViews.reduce((s, r) => s + r.fundedSft, 0);
    const heldSft = roomViews.reduce((s, r) => s + r.heldSft, 0);
    const openSft = roomViews.reduce((s, r) => s + r.openSft, 0);
    return {
      totalSft: wedding.totalSft,
      fundedSft,
      heldSft,
      openSft,
      progress: wedding.totalSft ? fundedSft / wedding.totalSft : 0,
      ratePerSftPaise: wedding.ratePerSftPaise,
      brickRatio: ratio,
      pricePerBrickPaise: Math.round(wedding.ratePerSftPaise / ratio),
      raisedPaise: await this.raisedPaise(weddingId),
      targetPaise: this.targetPaise(wedding),
      presetTiers: wedding.presetTiers,
      minGiftPaise: wedding.minGiftPaise || 0,
      holdTtlSec: wedding.cartHoldTtlSec,
      rooms: roomViews,
    };
  }

  async summary(wedding: WeddingDoc) {
    const now = new Date();
    const [funded, held] = await Promise.all([
      FloorTileModel.countDocuments({ weddingId: wedding._id, status: 'FUNDED' }),
      FloorTileModel.countDocuments({ weddingId: wedding._id, status: 'HOLD', lockedUntil: { $gt: now } }),
    ]);
    return {
      totalSft: wedding.totalSft,
      fundedSft: funded,
      heldSft: held,
      progress: wedding.totalSft ? funded / wedding.totalSft : 0,
      ratePerSftPaise: wedding.ratePerSftPaise,
      raisedPaise: await this.raisedPaise(wedding.id),
      targetPaise: this.targetPaise(wedding),
      brickRatio: wedding.brickRatio || 10,
      minGiftPaise: wedding.minGiftPaise || 0,
      presetTiers: wedding.presetTiers,
      holdTtlSec: wedding.cartHoldTtlSec,
    };
  }

  private async raisedPaise(weddingId: string) {
    const [row] = await ContributionModel.aggregate<{ amount: number }>([
      { $match: { weddingId: oid(weddingId), status: 'SUCCESS' } },
      { $group: { _id: null, amount: { $sum: '$amountPaise' } } },
    ]);
    return row?.amount ?? 0;
  }

  async donorWall(wedding: WeddingDoc, limit = 50, mode: StageDisplayMode = 'NAMES_AND_BLESSINGS', staff = false) {
    const rows = await ContributionModel.find({ weddingId: wedding._id, status: 'SUCCESS' })
      .sort({ paidAt: -1 })
      .limit(limit)
      .populate<{ room: RoomZoneDoc }>('room');
    return rows.map((c) => this.wallEntry(this.withRoom(c), mode, staff, wedding.hideAmountsFromGuests));
  }

  wallEntry(c: ContributionWithRoom, mode: StageDisplayMode = 'NAMES_AND_BLESSINGS', staff = true, hideAllAmounts = false) {
    const hideName = c.anonymous || mode !== 'NAMES_AND_BLESSINGS';
    const hideAmount = !staff && (c.hideAmount || hideAllAmounts);
    return {
      id: c.id,
      donorName: hideName ? ANONYMOUS_NAME : c.donorName,
      initials: hideName ? '♥' : initialsOf(c.donorName),
      relationship: hideName ? null : c.relationship,
      units: hideAmount ? null : c.units,
      brickCount: hideAmount ? null : c.brickCount || 0,
      unitKind: c.unitKind || 'SQFT',
      amountPaise: hideAmount ? null : c.amountPaise,
      room: { key: c.room.key, name: c.room.name },
      blessing: mode === 'PROGRESS_ONLY' ? null : c.blessing,
      tableNumber: c.tableNumber,
      paidAt: c.paidAt,
    };
  }

  async listContributions(weddingId: string, status?: ContributionStatus) {
    const rows = await ContributionModel.find({ weddingId, ...(status ? { status } : {}) })
      .sort({ createdAt: -1 })
      .limit(1000)
      .populate('room');
    return rows.map((c) => this.ownerView(this.withRoom(c)));
  }

  async myContributions(user: AuthUser, weddingId: string) {
    const rows = await ContributionModel.find({
      weddingId,
      userId: user.id,
      status: { $in: ['SUCCESS', 'PENDING', 'REFUND_REQUIRED'] },
    })
      .sort({ createdAt: -1 })
      .populate('room');
    return rows.map((c) => {
      const view = this.withRoom(c);
      return { ...this.ownerView(view), links: this.linksFor(view) };
    });
  }

  async getContribution(user: AuthUser, id: string) {
    const c = await ContributionModel.findById(id).populate('room').populate<{ wedding: WeddingDoc }>('wedding').populate('tiles');
    if (!c) throw new NotFoundException('Contribution not found');
    if (!sameId(c.userId, user.id)) {
      const member = await WeddingMemberModel.findOne({ weddingId: c.weddingId, userId: user.id });
      if (!member || !ADMIN_ROLES.includes(member.role)) throw new NotFoundException('Contribution not found');
    }
    const tiles = (c.get('tiles') as { index: number }[] | undefined) ?? [];
    const wedding = c.get('wedding') as WeddingDoc;
    const view = this.withRoom(c);
    return {
      ...this.ownerView(view),
      tileIndexes: c.status === 'SUCCESS' ? tiles.map((t) => t.index).sort((a, b) => a - b) : [],
      wedding: { slug: wedding.slug, brideName: wedding.brideName, groomName: wedding.groomName },
      links: this.linksFor(view),
    };
  }

  ownerView(c: ContributionWithRoom) {
    return {
      id: c.id,
      status: c.status,
      units: c.units,
      unitKind: c.unitKind || 'SQFT',
      brickCount: c.brickCount || 0,
      ratePaise: c.ratePaise,
      amountPaise: c.amountPaise,
      hideAmount: c.hideAmount || false,
      photoKey: c.photoKey ?? null,
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

  linksFor(c: Pick<ContributionDoc, 'id' | 'status' | 'holdExpiresAt'>) {
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

  async lockTiles(access: WeddingAccess, input: LockTilesInput) {
    const { wedding, user, invitation } = access;
    if (access.role === 'GUEST' && invitation && !invitation.enableRegistry) {
      throw new ForbiddenException({ code: 'REGISTRY_DISABLED', message: 'The gift registry is not enabled for your invitation' });
    }
    const room = await RoomZoneModel.findOne({ weddingId: wedding._id, key: input.roomKey });
    if (!room) throw new NotFoundException('Room not found');

    const now = new Date();
    const openHolds = await ContributionModel.countDocuments({
      userId: user.id,
      weddingId: wedding._id,
      status: 'PENDING',
      holdExpiresAt: { $gt: now },
    });
    if (openHolds >= MAX_OPEN_HOLDS_PER_USER) {
      throw new HttpException(
        { code: 'TOO_MANY_HOLDS', message: 'Finish or cancel your pending gifts before reserving more square feet' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const profile = await UserModel.findById(user.id);
    const donorName = (input.donorName || invitation?.guestName || profile?.name || 'Loving Guest').trim();
    const holdExpiresAt = new Date(now.getTime() + wedding.cartHoldTtlSec * 1000);
    const mode = input.mode ?? 'SQFT';
    if (mode === 'BRICK' || mode === 'AMOUNT') {
      return this.lockPartial(access, input, room, donorName, holdExpiresAt, now);
    }
    const units = input.indexes?.length || input.units || 0;

    const contribution = await this.redis.withLock(this.lockKey(wedding.id), () =>
      withTransaction(async (session) => {
        const tileFilter = input.indexes?.length
          ? { roomId: room._id, index: { $in: input.indexes }, ...this.availableTiles(now) }
          : { roomId: room._id, ...this.availableTiles(now) };
        const rows = await FloorTileModel.find(tileFilter).sort({ index: 1 }).limit(units).select('_id').session(session);
        if (rows.length < units) {
          throw new ConflictException({
            code: 'INSUFFICIENT_SFT',
            message: rows.length
              ? `Only ${rows.length} sq.ft. are still available in the ${room.name}`
              : `The ${room.name} is fully gifted. Please choose another room.`,
            available: rows.length,
          });
        }
        const amountPaise = units * wedding.ratePerSftPaise;
        this.assertMinGift(wedding, amountPaise);
        const [created] = await ContributionModel.create(
          [
            {
              weddingId: wedding._id,
              userId: user.id,
              roomId: room._id,
              units,
              unitKind: 'SQFT',
              brickCount: units * (wedding.brickRatio || 10),
              ratePaise: wedding.ratePerSftPaise,
              amountPaise,
              donorName,
              donorPhone: user.phone,
              relationship: input.relationship?.trim() || null,
              blessing: input.blessing?.trim() || null,
              anonymous: input.anonymous ?? false,
              hideAmount: input.hideAmount ?? false,
              photoKey: input.photoKey?.trim() || null,
              tableNumber: input.tableNumber?.trim() || null,
              refLead: input.refLead?.trim() || invitation?.refLead || null,
              provider: this.provider.name,
              holdExpiresAt,
            },
          ],
          { session },
        );
        if (!created) throw new Error('Failed to create contribution');
        const claimed = await FloorTileModel.updateMany(
          { _id: { $in: rows.map((row) => row._id) }, ...this.availableTiles(now) },
          { $set: { status: 'HOLD', lockedUntil: holdExpiresAt, contributionId: created._id } },
          { session },
        );
        if (claimed.modifiedCount < units) {
          throw new ConflictException({
            code: 'INSUFFICIENT_SFT',
            message: `Only ${claimed.modifiedCount} sq.ft. are still available in the ${room.name}`,
            available: claimed.modifiedCount,
          });
        }
        return created;
      }),
    );

    try {
      const order = await this.provider.createOrder({
        amountPaise: contribution.amountPaise,
        receipt: contribution.id,
        notes: { contributionId: contribution.id, wedding: wedding.slug, room: room.key, units: String(units) },
      });
      await ContributionModel.updateOne({ _id: contribution._id }, { $set: { providerOrderId: order.orderId } });
    } catch (err) {
      this.logger.error(`Order creation failed for ${contribution.id}: ${(err as Error).message}`);
      await this.releaseTiles(contribution.id, 'FAILED', 'Payment gateway unavailable');
      throw err instanceof HttpException ? err : new BadGatewayException('Payment gateway unavailable, please retry');
    }

    void this.broadcastState(wedding.id);
    const view = Object.assign(contribution, { room });
    return { contribution: this.ownerView(view), links: this.linksFor(contribution) };
  }

  private assertMinGift(wedding: WeddingDoc, amountPaise: number) {
    const min = wedding.minGiftPaise || 0;
    if (min > 0 && amountPaise < min) {
      throw new ConflictException({ code: 'BELOW_MINIMUM', message: `The smallest gift on this home is ₹${Math.round(min / 100)}` });
    }
  }

  private async lockPartial(
    access: WeddingAccess,
    input: LockTilesInput,
    room: RoomZoneDoc,
    donorName: string,
    holdExpiresAt: Date,
    now: Date,
  ) {
    const { wedding, user, invitation } = access;
    const ratio = wedding.brickRatio || 10;
    const brickPrice = Math.max(1, Math.round(wedding.ratePerSftPaise / ratio));
    const mode = input.mode === 'AMOUNT' ? 'AMOUNT' : 'BRICK';
    const requested = mode === 'AMOUNT' ? Math.floor((input.amountPaise ?? 0) / brickPrice) : input.units ?? 0;
    if (requested < 1) {
      throw new ConflictException({ code: 'BELOW_MINIMUM', message: 'That amount is smaller than one brick' });
    }
    const amountPaise = requested * brickPrice;
    this.assertMinGift(wedding, amountPaise);

    const contribution = await this.redis.withLock(this.lockKey(wedding.id), () =>
      withTransaction(async (session) => {
        const tiles = await FloorTileModel.find({ roomId: room._id, status: { $ne: 'FUNDED' } })
          .sort({ index: 1 })
          .session(session);
        const preferred = new Set(input.indexes ?? []);
        const ordered = [...tiles].sort((a, b) => Number(preferred.has(b.index)) - Number(preferred.has(a.index)) || a.index - b.index);
        let remaining = requested;
        const picks: { tile: FloorTileDoc; bricks: number }[] = [];
        for (const tile of ordered) {
          if (remaining <= 0) break;
          const wholeHold = tile.status === 'HOLD' && tile.lockedUntil && tile.lockedUntil > now && !(tile.fundedBricks || tile.heldBricks);
          if (wholeHold) continue;
          const capacity = ratio - (tile.fundedBricks || 0) - (tile.heldBricks || 0);
          if (capacity <= 0) continue;
          const bricks = Math.min(capacity, remaining);
          picks.push({ tile, bricks });
          remaining -= bricks;
        }
        if (remaining > 0) {
          throw new ConflictException({
            code: 'INSUFFICIENT_SFT',
            message: `Only ${requested - remaining} bricks are still open in the ${room.name}`,
            available: requested - remaining,
          });
        }
        const [created] = await ContributionModel.create(
          [
            {
              weddingId: wedding._id,
              userId: user.id,
              roomId: room._id,
              units: requested / ratio,
              unitKind: mode,
              brickCount: requested,
              ratePaise: brickPrice,
              amountPaise,
              donorName,
              donorPhone: user.phone,
              relationship: input.relationship?.trim() || null,
              blessing: input.blessing?.trim() || null,
              anonymous: input.anonymous ?? false,
              hideAmount: input.hideAmount ?? false,
              photoKey: input.photoKey?.trim() || null,
              tableNumber: input.tableNumber?.trim() || null,
              refLead: input.refLead?.trim() || invitation?.refLead || null,
              provider: this.provider.name,
              holdExpiresAt,
            },
          ],
          { session },
        );
        if (!created) throw new Error('Failed to create contribution');
        for (const pick of picks) {
          const claimed = await FloorTileModel.updateOne(
            { _id: pick.tile._id, heldBricks: pick.tile.heldBricks || 0, status: { $ne: 'FUNDED' } },
            { $inc: { heldBricks: pick.bricks } },
            { session },
          );
          if (!claimed.modifiedCount) throw new ConflictException({ code: 'INSUFFICIENT_SFT', message: 'Those bricks were just taken. Please try again.' });
          await BrickAllocationModel.create([{ weddingId: wedding._id, tileId: pick.tile._id, contributionId: created._id, bricks: pick.bricks, status: 'HOLD' }], { session });
        }
        return created;
      }),
    );

    try {
      const order = await this.provider.createOrder({
        amountPaise: contribution.amountPaise,
        receipt: contribution.id,
        notes: { contributionId: contribution.id, wedding: wedding.slug, room: room.key, bricks: String(requested) },
      });
      await ContributionModel.updateOne({ _id: contribution._id }, { $set: { providerOrderId: order.orderId } });
    } catch (err) {
      this.logger.error(`Order creation failed for ${contribution.id}: ${(err as Error).message}`);
      await this.releaseTiles(contribution.id, 'FAILED', 'Payment gateway unavailable');
      throw err instanceof HttpException ? err : new BadGatewayException('Payment gateway unavailable, please retry');
    }
    void this.broadcastState(wedding.id);
    const view = Object.assign(contribution, { room });
    return { contribution: this.ownerView(view), links: this.linksFor(contribution) };
  }

  async cancel(user: AuthUser, contributionId: string) {
    const c = await ContributionModel.findById(contributionId);
    if (!c || !sameId(c.userId, user.id)) throw new NotFoundException('Contribution not found');
    if (c.status !== 'PENDING') throw new ConflictException('Only pending gifts can be cancelled');
    await this.releaseTiles(c.id, 'CANCELLED');
    void this.broadcastState(idString(c.weddingId));
  }

  async markFailed(contributionId: string, reason: string) {
    const c = await ContributionModel.findById(contributionId);
    if (!c || c.status !== 'PENDING') return;
    await this.releaseTiles(c.id, 'FAILED', reason);
    void this.broadcastState(idString(c.weddingId));
  }

  private async releaseBrickHolds(contributionId: string, session: import('mongoose').ClientSession) {
    const allocs = await BrickAllocationModel.find({ contributionId, status: 'HOLD' }).session(session);
    for (const alloc of allocs) {
      await FloorTileModel.updateOne({ _id: alloc.tileId }, { $inc: { heldBricks: -alloc.bricks } }, { session });
      await BrickAllocationModel.updateOne({ _id: alloc._id }, { $set: { status: 'RELEASED' } }, { session });
    }
  }

  private async releaseTiles(contributionId: string, status: 'FAILED' | 'CANCELLED' | 'EXPIRED', reason?: string) {
    await withTransaction(async (session) => {
      await this.releaseBrickHolds(contributionId, session);
      await FloorTileModel.updateMany(
        { contributionId, status: 'HOLD' },
        { $set: { status: 'OPEN', lockedUntil: null, contributionId: null } },
        { session },
      );
      await ContributionModel.updateMany(
        { _id: contributionId, status: 'PENDING' },
        { $set: { status, failureReason: reason ?? null } },
        { session },
      );
    });
  }

  /**
   * Idempotently settles a paid contribution. Tiles still held by the
   * contribution are funded; if its hold lapsed, equivalent open tiles are
   * allocated (same room first). When nothing is left the contribution is
   * flagged REFUND_REQUIRED for the finance team.
   *
   * Postgres used `FOR UPDATE SKIP LOCKED`. MongoDB has no row lock skip, so
   * the per-wedding Redis lock plus a conditional update inside a transaction
   * keeps two checkouts from funding the same square foot.
   */
  async confirmPaid(contributionId: string, paymentId: string) {
    const existing = await ContributionModel.findById(contributionId);
    if (!existing) throw new NotFoundException('Contribution not found');
    if (existing.status === 'SUCCESS' || existing.status === 'REFUND_REQUIRED') {
      return { contribution: existing, alreadyProcessed: true };
    }

    const result = await this.redis.withLock(this.lockKey(idString(existing.weddingId)), () =>
      withTransaction(async (session) => {
        const c = await ContributionModel.findById(contributionId).session(session);
        if (!c) throw new NotFoundException('Contribution not found');
        if (c.status === 'SUCCESS' || c.status === 'REFUND_REQUIRED') return { contribution: c, alreadyProcessed: true };
        const now = new Date();
        if (c.unitKind === 'BRICK' || c.unitKind === 'AMOUNT') return this.settleBricks(c, paymentId, session, now);

        const held = await FloorTileModel.find({ contributionId: c._id, status: 'HOLD' }).select('_id').session(session);
        const tileIds: Types.ObjectId[] = held.map((t) => t._id).slice(0, c.units);
        if (tileIds.length < c.units) {
          const extra = await FloorTileModel.aggregate<{ _id: Types.ObjectId }>([
            {
              $match: {
                weddingId: c.weddingId,
                _id: { $nin: tileIds },
                contributionId: { $ne: c._id },
                ...this.availableTiles(now),
              },
            },
            { $lookup: { from: ROOM_ZONES, localField: 'roomId', foreignField: '_id', as: 'room' } },
            { $unwind: '$room' },
            { $addFields: { sameRoom: { $cond: [{ $eq: ['$roomId', c.roomId] }, 1, 0] } } },
            { $sort: { sameRoom: -1, 'room.sortOrder': 1, index: 1 } },
            { $limit: c.units - tileIds.length },
            { $project: { _id: 1 } },
          ]).session(session);
          tileIds.push(...extra.map((t) => t._id));
        }

        if (tileIds.length < c.units) {
          await FloorTileModel.updateMany(
            { contributionId: c._id, status: 'HOLD' },
            { $set: { status: 'OPEN', lockedUntil: null, contributionId: null } },
            { session },
          );
          const flagged = await ContributionModel.findByIdAndUpdate(
            c._id,
            {
              $set: {
                status: 'REFUND_REQUIRED',
                providerPaymentId: paymentId,
                paidAt: now,
                failureReason: 'Payment received after the registry was fully gifted',
              },
            },
            { new: true, session },
          );
          if (!flagged) throw new NotFoundException('Contribution not found');
          return { contribution: flagged, alreadyProcessed: false };
        }

        await FloorTileModel.updateMany(
          { _id: { $in: tileIds } },
          { $set: { status: 'FUNDED', lockedUntil: null, contributionId: c._id } },
          { session },
        );
        const paid = await ContributionModel.findByIdAndUpdate(
          c._id,
          {
            $set: {
              status: 'SUCCESS',
              providerPaymentId: paymentId,
              paidAt: now,
              failureReason: null,
              receiptNumber: `PTF-${now.getFullYear()}-${randomCode(8).toUpperCase()}`,
            },
          },
          { new: true, session },
        );
        if (!paid) throw new NotFoundException('Contribution not found');
        await LedgerEntryModel.create(
          [
            {
              weddingId: c.weddingId,
              contributionId: c._id,
              type: 'CREDIT',
              amountPaise: c.amountPaise,
              reference: paymentId,
            },
          ],
          { session },
        );
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
      void this.broadcastState(idString(result.contribution.weddingId));
    }
    return result;
  }

  private async settleBricks(c: ContributionDoc, paymentId: string, session: import('mongoose').ClientSession, now: Date) {
    const wedding = await WeddingModel.findById(c.weddingId).session(session);
    const ratio = wedding?.brickRatio || 10;
    const allocs = await BrickAllocationModel.find({ contributionId: c._id, status: 'HOLD' }).session(session);
    if (!allocs.length) {
      const flagged = await ContributionModel.findByIdAndUpdate(
        c._id,
        { $set: { status: 'REFUND_REQUIRED', providerPaymentId: paymentId, paidAt: now, failureReason: 'Payment received after the brick hold expired' } },
        { new: true, session },
      );
      if (!flagged) throw new NotFoundException('Contribution not found');
      return { contribution: flagged, alreadyProcessed: false as const };
    }
    for (const alloc of allocs) {
      const tile = await FloorTileModel.findById(alloc.tileId).session(session);
      if (!tile) continue;
      const fundedBricks = (tile.fundedBricks || 0) + alloc.bricks;
      const heldBricks = Math.max(0, (tile.heldBricks || 0) - alloc.bricks);
      const full = fundedBricks >= ratio;
      await FloorTileModel.updateOne(
        { _id: tile._id },
        { $set: { fundedBricks, heldBricks, status: full ? 'FUNDED' : tile.status === 'HOLD' ? 'HOLD' : 'OPEN', lockedUntil: full ? null : tile.lockedUntil, contributionId: full ? c._id : tile.contributionId } },
        { session },
      );
      await BrickAllocationModel.updateOne({ _id: alloc._id }, { $set: { status: 'FUNDED' } }, { session });
    }
    const paid = await ContributionModel.findByIdAndUpdate(
      c._id,
      { $set: { status: 'SUCCESS', providerPaymentId: paymentId, paidAt: now, failureReason: null, receiptNumber: `PTF-${now.getFullYear()}-${randomCode(8).toUpperCase()}` } },
      { new: true, session },
    );
    if (!paid) throw new NotFoundException('Contribution not found');
    await LedgerEntryModel.create([{ weddingId: c.weddingId, contributionId: c._id, type: 'CREDIT', amountPaise: c.amountPaise, reference: paymentId }], { session });
    return { contribution: paid, alreadyProcessed: false as const };
  }

  /** Releases expired checkout holds. Runs on a BullMQ job scheduler (one instance at a time). */
  async expireHolds() {
    const now = new Date();
    const expiringBricks = await ContributionModel.find({
      status: 'PENDING',
      holdExpiresAt: { $lt: now },
      unitKind: { $in: ['BRICK', 'AMOUNT'] },
    }).select('_id');
    for (const row of expiringBricks) {
      await withTransaction(async (session) => {
        await this.releaseBrickHolds(row.id, session);
      });
    }
    const affected = await FloorTileModel.distinct('weddingId', { status: 'HOLD', lockedUntil: { $lt: now } });
    const tiles = await FloorTileModel.updateMany(
      { status: 'HOLD', lockedUntil: { $lt: now } },
      { $set: { status: 'OPEN', lockedUntil: null, contributionId: null } },
    );
    const contributions = await ContributionModel.updateMany(
      { status: 'PENDING', holdExpiresAt: { $lt: now } },
      { $set: { status: 'EXPIRED', failureReason: 'Checkout hold expired' } },
    );
    for (const weddingId of affected) void this.broadcastState(idString(weddingId));
    return { releasedTiles: tiles.modifiedCount, expiredContributions: contributions.modifiedCount };
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
    const c = await ContributionModel.findById(contributionId).populate('room').populate<{ wedding: WeddingDoc }>('wedding');
    if (!c) return;
    const wedding = c.get('wedding') as WeddingDoc | undefined;
    if (!wedding) return;
    const view = this.withRoom(c);
    this.realtime.emit(liveRooms.wedding(idString(c.weddingId)), 'contribution.funded', this.wallEntry(view));
    this.realtime.emit(liveRooms.stage(idString(c.weddingId)), 'contribution.funded', this.wallEntry(view, wedding.stageDisplayMode));
    this.realtime.emit(liveRooms.admin(idString(c.weddingId)), 'contribution.funded', this.ownerView(view));
    const summary = c.anonymous
      ? `Someone gifted ${c.unitKind === 'SQFT' ? `${c.units} sq.ft.` : `${c.brickCount} bricks`} toward your home.`
      : `${c.donorName} gifted ${c.unitKind === 'SQFT' ? `${c.units} sq.ft.` : `${c.brickCount} bricks`} toward your home.`;
    void this.followups.thankForGift({
      phone: c.donorPhone,
      userId: c.userId ? idString(c.userId) : null,
      donorName: c.donorName,
      couple: `${wedding.brideName} & ${wedding.groomName}`,
    });
    void this.followups.notifyHostsOfGift(idString(c.weddingId), summary);
  }

  private withRoom(c: ContributionDoc): ContributionWithRoom {
    const room = c.get('room') as RoomRef | undefined;
    if (!room?.key) throw new Error('Contribution room was not populated');
    return Object.assign(c, { room });
  }
}
