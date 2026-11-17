import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ADMIN_ROLES, STAFF_ROLES, type WeddingAccess } from '../access/wedding-access.service.js';
import type { AuthUser } from '../common/auth.js';
import { randomCode } from '../common/utils/crypto.js';
import { initialsOf, slugify } from '../common/utils/format.js';
import { maskPhone, toE164 } from '../common/utils/phone.js';
import { InjectEnv, type Env } from '../config/config.module.js';
import type { Wedding } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RegistryService } from '../registry/registry.service.js';
import { StorageService } from '../storage/storage.service.js';
import { createRoomsAndTiles, DEFAULT_2BHK_ROOMS, type RoomInput } from './rooms.js';
import type { CreateWeddingInput, MemberInput, UpdateWeddingInput } from './weddings.schemas.js';

@Injectable()
export class WeddingsService {
  constructor(
    @InjectEnv() private readonly env: Env,
    private readonly prisma: PrismaService,
    private readonly registry: RegistryService,
    private readonly storage: StorageService,
  ) {}

  view(w: Wedding, full: boolean) {
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
      createdAt: w.createdAt,
    };
  }

  async create(user: AuthUser, input: CreateWeddingInput) {
    const rooms: RoomInput[] = input.rooms ?? DEFAULT_2BHK_ROOMS;
    const totalSft = rooms.reduce((s, r) => s + r.sft, 0);
    let slug = input.slug ?? slugify(`${input.brideName.split(' ')[0]}-${input.groomName.split(' ')[0]}`);
    if (slug.length < 3) slug = `wedding-${randomCode(6)}`;
    if (await this.prisma.wedding.findUnique({ where: { slug }, select: { id: true } })) {
      if (input.slug) throw new ConflictException({ code: 'SLUG_TAKEN', message: 'This wedding URL is already taken' });
      slug = `${slug}-${randomCode(4)}`;
    }

    const { rooms: _rooms, ratePerSft, slug: _slug, ...fields } = input;
    const wedding = await this.prisma.$transaction(
      async (tx) => {
        const created = await tx.wedding.create({
          data: {
            ...fields,
            videoInviteUrl: fields.videoInviteUrl || null,
            slug,
            totalSft,
            ratePerSftPaise: ratePerSft * 100,
            members: { create: { userId: user.id, role: 'HOST' } },
          },
        });
        await createRoomsAndTiles(tx, created.id, rooms);
        return created;
      },
      { timeout: 30_000 },
    );
    return this.view(wedding, true);
  }

  async update(access: WeddingAccess, input: UpdateWeddingInput) {
    const { ratePerSft, ...fields } = input;
    const updated = await this.prisma.wedding.update({
      where: { id: access.wedding.id },
      data: {
        ...fields,
        ...(fields.videoInviteUrl === '' ? { videoInviteUrl: null } : {}),
        ...(ratePerSft !== undefined ? { ratePerSftPaise: ratePerSft * 100 } : {}),
      },
    });
    return this.view(updated, true);
  }

  async replaceRooms(access: WeddingAccess, rooms: RoomInput[]) {
    const weddingId = access.wedding.id;
    const contributions = await this.prisma.contribution.count({ where: { weddingId } });
    if (contributions > 0) {
      throw new ConflictException({
        code: 'REGISTRY_LOCKED',
        message: 'The floor plan cannot be changed after guests have started gifting',
      });
    }
    const totalSft = rooms.reduce((s, r) => s + r.sft, 0);
    await this.prisma.$transaction(
      async (tx) => {
        await tx.floorTile.deleteMany({ where: { weddingId } });
        await tx.roomZone.deleteMany({ where: { weddingId } });
        await createRoomsAndTiles(tx, weddingId, rooms);
        await tx.wedding.update({ where: { id: weddingId }, data: { totalSft } });
      },
      { timeout: 30_000 },
    );
    void this.registry.broadcastState(weddingId);
    return this.registry.state(weddingId);
  }

  async microsite(access: WeddingAccess) {
    const { wedding, role, invitation } = access;
    const staff = STAFF_ROLES.includes(role) || role === 'PLATFORM';
    const ceremonies = await this.prisma.ceremony.findMany({
      where: {
        weddingId: wedding.id,
        ...(!staff && invitation ? { invitations: { some: { invitationId: invitation.id } } } : {}),
      },
      orderBy: [{ startsAt: 'asc' }, { sortOrder: 'asc' }],
    });
    const rsvp = invitation ? await this.prisma.rsvp.findUnique({ where: { invitationId: invitation.id } }) : null;
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
      this.prisma.weddingMember.findMany({ where: { userId: user.id }, include: { wedding: true } }),
      this.prisma.invitation.findMany({ where: { phone: user.phone }, include: { wedding: true } }),
    ]);
    const map = new Map<string, ReturnType<WeddingsService['view']> & { role: string }>();
    for (const i of invitations) map.set(i.wedding.id, { ...this.view(i.wedding, false), role: 'GUEST' });
    for (const m of memberships) map.set(m.wedding.id, { ...this.view(m.wedding, ADMIN_ROLES.includes(m.role)), role: m.role });
    return [...map.values()];
  }

  /** Multi-tenant discovery feed: other couples' celebrations stay masked. */
  async publicFeed(user?: AuthUser) {
    const weddings = await this.prisma.wedding.findMany({
      orderBy: [{ weddingDate: 'asc' }, { createdAt: 'desc' }],
      take: 50,
      select: { id: true, slug: true, brideName: true, groomName: true, weddingDate: true, city: true, coverPhotoUrl: true, totalSft: true },
    });
    const unlocked = new Map<string, string>();
    if (user) {
      const [members, invites] = await Promise.all([
        this.prisma.weddingMember.findMany({ where: { userId: user.id }, select: { weddingId: true, role: true } }),
        this.prisma.invitation.findMany({ where: { phone: user.phone }, select: { weddingId: true } }),
      ]);
      invites.forEach((i) => unlocked.set(i.weddingId, 'GUEST'));
      members.forEach((m) => unlocked.set(m.weddingId, m.role));
    }
    const funded = await this.prisma.floorTile.groupBy({
      by: ['weddingId'],
      where: { status: 'FUNDED', weddingId: { in: weddings.map((w) => w.id) } },
      _count: { _all: true },
    });
    const fundedBy = new Map(funded.map((f) => [f.weddingId, f._count._all]));
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
    const inv = await this.prisma.invitation.findUnique({ where: { refToken }, include: { wedding: true } });
    if (!inv) throw new NotFoundException('Invitation not found');
    return {
      guestName: inv.guestName,
      maskedPhone: maskPhone(inv.phone),
      wedding: {
        slug: inv.wedding.slug,
        brideName: inv.wedding.brideName,
        groomName: inv.wedding.groomName,
        weddingDate: inv.wedding.weddingDate,
        city: inv.wedding.city,
        coverPhotoUrl: inv.wedding.coverPhotoUrl,
      },
    };
  }

  async uploadMedia(access: WeddingAccess, kind: 'cover' | 'video', file: { buffer: Buffer; mimetype: string; size: number }) {
    const allowed = kind === 'cover' ? ['image/jpeg', 'image/png', 'image/webp'] : ['video/mp4', 'video/webm'];
    const maxBytes = kind === 'cover' ? this.env.MAX_UPLOAD_MB * 1024 * 1024 : 100 * 1024 * 1024;
    if (!allowed.includes(file.mimetype)) throw new BadRequestException(`Allowed types: ${allowed.join(', ')}`);
    if (file.size > maxBytes) throw new BadRequestException(`File too large (max ${Math.round(maxBytes / 1048576)} MB)`);
    const { url } = await this.storage.put(`${access.wedding.slug}-${kind}`, file.buffer, file.mimetype);
    const updated = await this.prisma.wedding.update({
      where: { id: access.wedding.id },
      data: kind === 'cover' ? { coverPhotoUrl: url } : { videoInviteUrl: url },
    });
    return this.view(updated, true);
  }

  // ------------------------------------------------------------- members

  async members(weddingId: string) {
    const rows = await this.prisma.weddingMember.findMany({
      where: { weddingId },
      include: { user: { select: { id: true, phone: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((m) => ({ id: m.id, role: m.role, label: m.label, createdAt: m.createdAt, user: m.user }));
  }

  async addMember(access: WeddingAccess, input: MemberInput) {
    const phone = toE164(input.phone, this.env.DEFAULT_PHONE_COUNTRY);
    if (!phone) throw new BadRequestException('Enter a valid mobile number');
    if (input.role === 'HOST' && access.role !== 'HOST') throw new ForbiddenException('Only a host can add another host');
    if (input.role === 'LEAD' && !input.label) throw new BadRequestException('Family leads need a referral label, e.g. "uncle-ravi"');
    const user = await this.prisma.user.upsert({
      where: { phone },
      update: {},
      create: { phone, name: input.name },
    });
    const member = await this.prisma.weddingMember.upsert({
      where: { weddingId_userId: { weddingId: access.wedding.id, userId: user.id } },
      update: { role: input.role, label: input.label ?? null },
      create: { weddingId: access.wedding.id, userId: user.id, role: input.role, label: input.label ?? null },
    });
    return { id: member.id, role: member.role, label: member.label, user: { id: user.id, phone: user.phone, name: user.name } };
  }

  async removeMember(access: WeddingAccess, memberId: string) {
    const member = await this.prisma.weddingMember.findFirst({ where: { id: memberId, weddingId: access.wedding.id } });
    if (!member) throw new NotFoundException('Member not found');
    if (member.role === 'HOST') {
      if (access.role !== 'HOST') throw new ForbiddenException('Only a host can remove a host');
      const hosts = await this.prisma.weddingMember.count({ where: { weddingId: access.wedding.id, role: 'HOST' } });
      if (hosts <= 1) throw new ConflictException('A wedding needs at least one host');
    }
    await this.prisma.weddingMember.delete({ where: { id: member.id } });
  }

  // ------------------------------------------------------------ dashboard

  async dashboard(access: WeddingAccess) {
    const weddingId = access.wedding.id;
    const [guestTotal, byCohort, rsvpGroups, rsvpCounts, contributionGroups, ledger, dispatchGroups, registry, pendingSettlements] =
      await Promise.all([
        this.prisma.invitation.count({ where: { weddingId } }),
        this.prisma.invitation.groupBy({ by: ['cohort'], where: { weddingId }, _count: { _all: true } }),
        this.prisma.rsvp.groupBy({ by: ['status'], where: { weddingId }, _count: { _all: true } }),
        this.prisma.rsvp.aggregate({
          where: { weddingId, status: 'ATTENDING' },
          _sum: { adults: true, children: true, infants: true },
        }),
        this.prisma.contribution.groupBy({
          by: ['status'],
          where: { weddingId },
          _count: { _all: true },
          _sum: { amountPaise: true, units: true },
        }),
        this.prisma.ledgerEntry.groupBy({ by: ['type'], where: { weddingId }, _sum: { amountPaise: true } }),
        this.prisma.dispatchMessage.groupBy({ by: ['status'], where: { dispatch: { weddingId } }, _count: { _all: true } }),
        this.registry.summary(access.wedding),
        this.prisma.settlement.aggregate({
          where: { weddingId, status: { in: ['REQUESTED', 'HOST_APPROVED', 'APPROVED'] } },
          _sum: { amountPaise: true },
        }),
      ]);
    const ledgerSum = (t: string) => ledger.find((l) => l.type === t)?._sum.amountPaise ?? 0;
    const success = contributionGroups.find((g) => g.status === 'SUCCESS');
    const credited = ledgerSum('CREDIT');
    const disbursed = ledgerSum('DEBIT') + ledgerSum('REFUND');
    return {
      guests: {
        total: guestTotal,
        byCohort: Object.fromEntries(byCohort.map((c) => [c.cohort, c._count._all])),
      },
      rsvp: {
        byStatus: Object.fromEntries(rsvpGroups.map((g) => [g.status, g._count._all])),
        responded: rsvpGroups.reduce((s, g) => s + g._count._all, 0),
        headcount: {
          adults: rsvpCounts._sum.adults ?? 0,
          children: rsvpCounts._sum.children ?? 0,
          infants: rsvpCounts._sum.infants ?? 0,
        },
      },
      registry,
      gifts: {
        contributors: success?._count._all ?? 0,
        fundedSft: success?._sum.units ?? 0,
        raisedPaise: success?._sum.amountPaise ?? 0,
        byStatus: Object.fromEntries(contributionGroups.map((g) => [g.status, g._count._all])),
      },
      escrow: {
        creditedPaise: credited,
        disbursedPaise: disbursed,
        pendingSettlementPaise: pendingSettlements._sum.amountPaise ?? 0,
        availablePaise: credited - disbursed - (pendingSettlements._sum.amountPaise ?? 0),
      },
      dispatch: Object.fromEntries(dispatchGroups.map((g) => [g.status, g._count._all])),
    };
  }
}
