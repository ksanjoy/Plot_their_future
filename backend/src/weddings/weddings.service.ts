import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ADMIN_ROLES, STAFF_ROLES, type WeddingAccess } from '../access/wedding-access.service.js';
import type { AuthUser } from '../common/auth.js';
import { randomCode } from '../common/utils/crypto.js';
import { initialsOf, slugify } from '../common/utils/format.js';
import { maskPhone, toE164 } from '../common/utils/phone.js';
import { InjectEnv, type Env } from '../config/config.module.js';
import { idString, withTransaction } from '../database/helpers.js';
import {
  CeremonyModel,
  ContributionModel,
  DispatchMessageModel,
  DispatchModel,
  FloorTileModel,
  InvitationCeremonyModel,
  InvitationModel,
  LedgerEntryModel,
  RoomZoneModel,
  RsvpModel,
  SettlementModel,
  UserModel,
  WeddingMemberModel,
  WeddingModel,
  type UserDoc,
  type WeddingDoc,
} from '../models/schemas.js';
import { RegistryService } from '../registry/registry.service.js';
import { StorageService } from '../storage/storage.service.js';
import { createRoomsAndTiles, DEFAULT_2BHK_ROOMS, type RoomInput } from './rooms.js';
import type { CreateWeddingInput, MemberInput, UpdateWeddingInput } from './weddings.schemas.js';

@Injectable()
export class WeddingsService {
  constructor(
    @InjectEnv() private readonly env: Env,
    private readonly registry: RegistryService,
    private readonly storage: StorageService,
  ) {}

  view(w: WeddingDoc, full: boolean) {
    return {
      id: w.id,
      slug: w.slug,
      brideName: w.brideName,
      groomName: w.groomName,
      welcomeNote: w.welcomeNote,
      videoInviteUrl: w.videoInviteUrl,
      coverPhotoUrl: w.coverPhotoUrl,
      city: w.city,
      weddingDate: w.weddingDate,
      timezone: w.timezone,
      propertyName: w.propertyName,
      propertyLocation: w.propertyLocation,
      totalSft: w.totalSft,
      ratePerSftPaise: w.ratePerSftPaise,
      presetTiers: w.presetTiers,
      cartHoldTtlSec: w.cartHoldTtlSec,
      reraRegId: w.reraRegId,
      escrowBankName: w.escrowBankName,
      escrowIfsc: w.escrowIfsc,
      escrowAccountNumber: full ? w.escrowAccountNumber : null,
      escrowAccountLast4: w.escrowAccountNumber?.slice(-4) ?? null,
      taxExemptionEnabled: w.taxExemptionEnabled,
      stageDisplayMode: w.stageDisplayMode,
      approvalStatus: w.approvalStatus ?? 'APPROVED',
      approvalNote: w.approvalNote ?? null,
      contactMobile: full ? w.contactMobile ?? null : null,
      cardImageUrl: w.cardImageUrl ?? null,
      flatId: w.flatId ? String(w.flatId) : null,
      linkVisibility: w.linkVisibility ?? 'PUBLIC',
      brickRatio: w.brickRatio || 10,
      minGiftPaise: w.minGiftPaise || 0,
      targetAmountPaise: w.targetAmountPaise ?? null,
      hideAmountsFromGuests: w.hideAmountsFromGuests ?? false,
      kycStatus: w.kycStatus ?? 'NOT_REQUIRED',
      createdAt: w.createdAt,
    };
  }

  async create(user: AuthUser, input: CreateWeddingInput) {
    const rooms: RoomInput[] = input.rooms ?? DEFAULT_2BHK_ROOMS;
    const totalSft = rooms.reduce((s, r) => s + r.sft, 0);
    let slug = input.slug ?? slugify(`${input.brideName.split(' ')[0]}-${input.groomName.split(' ')[0]}`);
    if (slug.length < 3) slug = `wedding-${randomCode(6)}`;
    if (await WeddingModel.exists({ slug })) {
      if (input.slug) throw new ConflictException({ code: 'SLUG_TAKEN', message: 'This wedding URL is already taken' });
      slug = `${slug}-${randomCode(4)}`;
    }

    const { rooms: _rooms, ratePerSft, slug: _slug, ...fields } = input;
    const wedding = await withTransaction(async (session) => {
      const [created] = await WeddingModel.create(
        [
          {
            ...fields,
            videoInviteUrl: fields.videoInviteUrl || null,
            slug,
            totalSft,
            ratePerSftPaise: ratePerSft * 100,
          },
        ],
        { session },
      );
      if (!created) throw new Error('Failed to create wedding');
      await WeddingMemberModel.create([{ weddingId: created._id, userId: user.id, role: 'HOST' }], { session });
      await createRoomsAndTiles(session, created.id, rooms);
      return created;
    });
    return this.view(wedding, true);
  }

  async update(access: WeddingAccess, input: UpdateWeddingInput) {
    const { ratePerSft, ...fields } = input;
    const data: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) data[key] = value;
    }
    if (fields.videoInviteUrl === '') data.videoInviteUrl = null;
    if (ratePerSft !== undefined) data.ratePerSftPaise = ratePerSft * 100;
    const updated = await WeddingModel.findByIdAndUpdate(access.wedding.id, { $set: data }, { new: true });
    if (!updated) throw new NotFoundException('Wedding not found');
    return this.view(updated, true);
  }

  async replaceRooms(access: WeddingAccess, rooms: RoomInput[]) {
    const weddingId = access.wedding.id;
    const contributions = await ContributionModel.countDocuments({ weddingId });
    if (contributions > 0) {
      throw new ConflictException({
        code: 'REGISTRY_LOCKED',
        message: 'The floor plan cannot be changed after guests have started gifting',
      });
    }
    const totalSft = rooms.reduce((s, r) => s + r.sft, 0);
    await withTransaction(async (session) => {
      await FloorTileModel.deleteMany({ weddingId }, { session });
      await RoomZoneModel.deleteMany({ weddingId }, { session });
      await createRoomsAndTiles(session, weddingId, rooms);
      await WeddingModel.updateOne({ _id: weddingId }, { $set: { totalSft } }, { session });
    });
    void this.registry.broadcastState(weddingId);
    return this.registry.state(weddingId);
  }

  async microsite(access: WeddingAccess) {
    const { wedding, role, invitation } = access;
    const staff = STAFF_ROLES.includes(role) || role === 'PLATFORM';
    const ceremonyFilter: { weddingId: unknown; _id?: { $in: unknown[] } } = { weddingId: wedding._id };
    if (!staff && invitation) {
      const links = await InvitationCeremonyModel.find({ invitationId: invitation._id }).select('ceremonyId');
      ceremonyFilter._id = { $in: links.map((link) => link.ceremonyId) };
    }
    const ceremonies = await CeremonyModel.find(ceremonyFilter).sort({ startsAt: 1, sortOrder: 1 });
    const rsvp = invitation ? await RsvpModel.findOne({ invitationId: invitation._id }) : null;
    return {
      wedding: this.view(wedding, ADMIN_ROLES.includes(role)),
      role,
      invitation: invitation
        ? {
            id: invitation.id,
            guestName: invitation.guestName,
            cohort: invitation.cohort,
            maxAttendees: invitation.maxAttendees,
            enableRegistry: invitation.enableRegistry,
            refLead: invitation.refLead,
          }
        : null,
      ceremonies,
      rsvp,
      registry: await this.registry.summary(wedding),
    };
  }

  async mine(user: AuthUser) {
    const [memberships, invitations] = await Promise.all([
      WeddingMemberModel.find({ userId: user.id }).populate<{ wedding: WeddingDoc }>('wedding'),
      InvitationModel.find({ phone: user.phone }).populate<{ wedding: WeddingDoc }>('wedding'),
    ]);
    const map = new Map<string, ReturnType<WeddingsService['view']> & { role: string }>();
    for (const invite of invitations) {
      const wedding = invite.get('wedding') as WeddingDoc | undefined;
      if (!wedding) continue;
      map.set(wedding.id, { ...this.view(wedding, false), role: 'GUEST' });
    }
    for (const membership of memberships) {
      const wedding = membership.get('wedding') as WeddingDoc | undefined;
      if (!wedding) continue;
      map.set(wedding.id, { ...this.view(wedding, ADMIN_ROLES.includes(membership.role)), role: membership.role });
    }
    return [...map.values()];
  }

  /** Multi-tenant discovery feed: other couples' celebrations stay masked. */
  async publicFeed(user?: AuthUser) {
    const weddings = await WeddingModel.find({
      $and: [
        { $or: [{ approvalStatus: 'APPROVED' }, { approvalStatus: { $exists: false } }] },
        { linkVisibility: { $nin: ['PRIVATE', 'PAUSED'] } },
      ],
    })
      .sort({ weddingDate: 1, createdAt: -1 })
      .limit(50)
      .select('slug brideName groomName weddingDate city coverPhotoUrl totalSft');
    const unlocked = new Map<string, string>();
    if (user) {
      const [members, invites] = await Promise.all([
        WeddingMemberModel.find({ userId: user.id }).select('weddingId role'),
        InvitationModel.find({ phone: user.phone }).select('weddingId'),
      ]);
      invites.forEach((invite) => unlocked.set(idString(invite.weddingId), 'GUEST'));
      members.forEach((member) => unlocked.set(idString(member.weddingId), member.role));
    }
    const funded = await FloorTileModel.aggregate<{ _id: { toString(): string }; count: number }>([
      { $match: { status: 'FUNDED', weddingId: { $in: weddings.map((w) => w._id) } } },
      { $group: { _id: '$weddingId', count: { $sum: 1 } } },
    ]);
    const fundedBy = new Map(funded.map((row) => [idString(row._id), row.count]));
    return weddings.map((w) => {
      const role = unlocked.get(w.id);
      const monthYear = w.weddingDate?.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) ?? null;
      const progress = w.totalSft ? (fundedBy.get(w.id) ?? 0) / w.totalSft : 0;
      if (!role) {
        return {
          unlocked: false as const,
          monogram: `${initialsOf(w.brideName)[0]} & ${initialsOf(w.groomName)[0]}`,
          monthYear,
          city: w.city,
          label: 'Private Celebration • Invitation Required',
        };
      }
      return {
        unlocked: true as const,
        role,
        slug: w.slug,
        brideName: w.brideName,
        groomName: w.groomName,
        monogram: `${initialsOf(w.brideName)[0]} & ${initialsOf(w.groomName)[0]}`,
        weddingDate: w.weddingDate,
        monthYear,
        city: w.city,
        coverPhotoUrl: w.coverPhotoUrl,
        progress,
      };
    });
  }

  async invitationPreview(refToken: string) {
    const inv = await InvitationModel.findOne({ refToken }).populate<{ wedding: WeddingDoc }>('wedding');
    const wedding = inv?.get('wedding') as WeddingDoc | undefined;
    if (!inv || !wedding) throw new NotFoundException('Invitation not found');
    if (wedding.linkVisibility === 'PAUSED' || (wedding.approvalStatus && wedding.approvalStatus !== 'APPROVED')) {
      throw new NotFoundException('Invitation not found');
    }
    return {
      guestName: inv.guestName,
      maskedPhone: maskPhone(inv.phone),
      wedding: {
        slug: wedding.slug,
        brideName: wedding.brideName,
        groomName: wedding.groomName,
        weddingDate: wedding.weddingDate,
        city: wedding.city,
        coverPhotoUrl: wedding.coverPhotoUrl,
      },
    };
  }

  async uploadMedia(access: WeddingAccess, kind: 'cover' | 'video' | 'card', file: { buffer: Buffer; mimetype: string; size: number }) {
    const allowed = kind === 'video' ? ['video/mp4', 'video/webm'] : ['image/jpeg', 'image/png', 'image/webp'];
    const maxBytes = kind === 'video' ? 100 * 1024 * 1024 : this.env.MAX_UPLOAD_MB * 1024 * 1024;
    if (!allowed.includes(file.mimetype)) throw new BadRequestException(`Allowed types: ${allowed.join(', ')}`);
    if (file.size > maxBytes) throw new BadRequestException(`File too large (max ${Math.round(maxBytes / 1048576)} MB)`);
    const { url } = await this.storage.put(`${access.wedding.slug}-${kind}`, file.buffer, file.mimetype);
    const updated = await WeddingModel.findByIdAndUpdate(
      access.wedding.id,
      { $set: kind === 'cover' ? { coverPhotoUrl: url } : kind === 'card' ? { cardImageUrl: url } : { videoInviteUrl: url } },
      { new: true },
    );
    if (!updated) throw new NotFoundException('Wedding not found');
    return this.view(updated, true);
  }

  async members(weddingId: string) {
    const rows = await WeddingMemberModel.find({ weddingId }).populate<{ user: UserDoc }>('user').sort({ createdAt: 1 });
    return rows.map((m) => {
      const user = m.get('user') as UserDoc;
      return {
        id: m.id,
        role: m.role,
        label: m.label,
        createdAt: m.createdAt,
        user: { id: user.id, phone: user.phone, name: user.name },
      };
    });
  }

  async addMember(access: WeddingAccess, input: MemberInput) {
    const phone = toE164(input.phone, this.env.DEFAULT_PHONE_COUNTRY);
    if (!phone) throw new BadRequestException('Enter a valid mobile number');
    if (input.role === 'HOST' && access.role !== 'HOST') throw new ForbiddenException('Only a host can add another host');
    if (input.role === 'LEAD' && !input.label) throw new BadRequestException('Family leads need a referral label, e.g. "uncle-ravi"');
    const user = await UserModel.findOneAndUpdate(
      { phone },
      { $setOnInsert: { phone, name: input.name ?? null } },
      { upsert: true, new: true },
    );
    if (!user) throw new ConflictException('Could not save member');
    const member = await WeddingMemberModel.findOneAndUpdate(
      { weddingId: access.wedding._id, userId: user._id },
      { $set: { role: input.role, label: input.label ?? null }, $setOnInsert: { weddingId: access.wedding._id, userId: user._id } },
      { upsert: true, new: true },
    );
    if (!member) throw new ConflictException('Could not save member');
    return { id: member.id, role: member.role, label: member.label, user: { id: user.id, phone: user.phone, name: user.name } };
  }

  async removeMember(access: WeddingAccess, memberId: string) {
    const member = await WeddingMemberModel.findOne({ _id: memberId, weddingId: access.wedding._id });
    if (!member) throw new NotFoundException('Member not found');
    if (member.role === 'HOST') {
      if (access.role !== 'HOST') throw new ForbiddenException('Only a host can remove a host');
      const hosts = await WeddingMemberModel.countDocuments({ weddingId: access.wedding._id, role: 'HOST' });
      if (hosts <= 1) throw new ConflictException('A wedding needs at least one host');
    }
    await WeddingMemberModel.deleteOne({ _id: member._id });
  }

  async dashboard(access: WeddingAccess) {
    const weddingId = access.wedding._id;
    const dispatchIds = (await DispatchModel.find({ weddingId }).select('_id')).map((row) => row._id);
    const [guestTotal, byCohort, rsvpGroups, rsvpCounts, contributionGroups, ledger, dispatchGroups, registry, pendingSettlements] =
      await Promise.all([
        InvitationModel.countDocuments({ weddingId }),
        InvitationModel.aggregate<{ _id: string; count: number }>([{ $match: { weddingId } }, { $group: { _id: '$cohort', count: { $sum: 1 } } }]),
        RsvpModel.aggregate<{ _id: string; count: number }>([{ $match: { weddingId } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
        RsvpModel.aggregate<{ adults: number; children: number; infants: number }>([
          { $match: { weddingId, status: 'ATTENDING' } },
          { $group: { _id: null, adults: { $sum: '$adults' }, children: { $sum: '$children' }, infants: { $sum: '$infants' } } },
        ]),
        ContributionModel.aggregate<{ _id: string; count: number; amountPaise: number; units: number }>([
          { $match: { weddingId } },
          { $group: { _id: '$status', count: { $sum: 1 }, amountPaise: { $sum: '$amountPaise' }, units: { $sum: '$units' } } },
        ]),
        LedgerEntryModel.aggregate<{ _id: string; amountPaise: number }>([
          { $match: { weddingId } },
          { $group: { _id: '$type', amountPaise: { $sum: '$amountPaise' } } },
        ]),
        DispatchMessageModel.aggregate<{ _id: string; count: number }>([
          { $match: { dispatchId: { $in: dispatchIds } } },
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ]),
        this.registry.summary(access.wedding),
        SettlementModel.aggregate<{ amountPaise: number }>([
          { $match: { weddingId, status: { $in: ['REQUESTED', 'HOST_APPROVED', 'APPROVED'] } } },
          { $group: { _id: null, amountPaise: { $sum: '$amountPaise' } } },
        ]),
      ]);
    const ledgerSum = (t: string) => ledger.find((l) => l._id === t)?.amountPaise ?? 0;
    const success = contributionGroups.find((g) => g._id === 'SUCCESS');
    const head = rsvpCounts[0];
    const credited = ledgerSum('CREDIT');
    const disbursed = ledgerSum('DEBIT') + ledgerSum('REFUND');
    const pending = pendingSettlements[0]?.amountPaise ?? 0;
    return {
      guests: {
        total: guestTotal,
        byCohort: Object.fromEntries(byCohort.map((c) => [c._id, c.count])),
      },
      rsvp: {
        byStatus: Object.fromEntries(rsvpGroups.map((g) => [g._id, g.count])),
        responded: rsvpGroups.reduce((s, g) => s + g.count, 0),
        headcount: {
          adults: head?.adults ?? 0,
          children: head?.children ?? 0,
          infants: head?.infants ?? 0,
        },
      },
      registry,
      gifts: {
        contributors: success?.count ?? 0,
        fundedSft: success?.units ?? 0,
        raisedPaise: success?.amountPaise ?? 0,
        byStatus: Object.fromEntries(contributionGroups.map((g) => [g._id, g.count])),
      },
      escrow: {
        creditedPaise: credited,
        disbursedPaise: disbursed,
        pendingSettlementPaise: pending,
        availablePaise: credited - disbursed - pending,
      },
      dispatch: Object.fromEntries(dispatchGroups.map((g) => [g._id, g.count])),
    };
  }
}
