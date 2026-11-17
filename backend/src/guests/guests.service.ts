import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { parse } from 'csv-parse/sync';
import type { WeddingAccess } from '../access/wedding-access.service.js';
import { toCsv } from '../common/csv.js';
import { randomCode } from '../common/utils/crypto.js';
import { toE164 } from '../common/utils/phone.js';
import { InjectEnv, type Env } from '../config/config.module.js';
import type { GuestCohort, Invitation, Prisma, Wedding } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

export interface GuestInput {
  guestName: string;
  phone: string;
  email?: string | null;
  cohort?: GuestCohort;
  maxAttendees?: number;
  enableRegistry?: boolean;
  ceremonyIds?: string[];
  refLead?: string | null;
}

export interface GuestQuery {
  search?: string;
  cohort?: GuestCohort;
  ceremonyId?: string;
  rsvp?: 'ATTENDING' | 'DECLINED' | 'MAYBE' | 'PENDING';
}

const COHORT_ALIASES: Record<string, GuestCohort> = {
  close_family: 'CLOSE_FAMILY',
  'close family': 'CLOSE_FAMILY',
  family: 'FAMILY',
  'all family': 'FAMILY',
  friends: 'FRIENDS',
  friend: 'FRIENDS',
  colleagues: 'COLLEAGUES',
  colleague: 'COLLEAGUES',
  work: 'COLLEAGUES',
  vip: 'VIP',
  other: 'OTHER',
};

const HEADER_ALIASES: Record<string, string> = {
  name: 'guest_name',
  guest: 'guest_name',
  family_head_name: 'guest_name',
  phone: 'phone_whatsapp',
  whatsapp: 'phone_whatsapp',
  mobile: 'phone_whatsapp',
  category: 'guest_category',
  cohort: 'guest_category',
  events: 'invited_events',
  ceremonies: 'invited_events',
  registry: 'enable_registry',
  include_sft_registry: 'enable_registry',
  seats: 'max_attendees',
  seat_allocation: 'max_attendees',
};

const MAX_IMPORT_ROWS = 5000;

type InvitationWithRelations = Invitation & { ceremonies: { ceremonyId: string }[]; rsvp: { status: string } | null };

@Injectable()
export class GuestsService {
  constructor(
    @InjectEnv() private readonly env: Env,
    private readonly prisma: PrismaService,
  ) {}

  inviteLink(wedding: Pick<Wedding, 'slug'>, inv: Pick<Invitation, 'refToken' | 'refLead'>) {
    const url = new URL(`/w/${wedding.slug}`, this.env.WEB_PUBLIC_URL);
    url.searchParams.set('ref_token', inv.refToken);
    if (inv.refLead) url.searchParams.set('ref_lead', inv.refLead);
    return url.toString();
  }

  /** Leads only manage their own branch of the guest list. */
  private scope(access: WeddingAccess): Prisma.InvitationWhereInput {
    return access.role === 'LEAD' ? { weddingId: access.wedding.id, refLead: access.member?.label ?? '__none__' } : { weddingId: access.wedding.id };
  }

  view(access: WeddingAccess, inv: InvitationWithRelations) {
    return {
      id: inv.id,
      guestName: inv.guestName,
      phone: inv.phone,
      email: inv.email,
      cohort: inv.cohort,
      maxAttendees: inv.maxAttendees,
      enableRegistry: inv.enableRegistry,
      refLead: inv.refLead,
      ceremonyIds: inv.ceremonies.map((c) => c.ceremonyId),
      rsvpStatus: inv.rsvp?.status ?? 'PENDING',
      linkedAccount: Boolean(inv.userId),
      inviteLink: this.inviteLink(access.wedding, inv),
      createdAt: inv.createdAt,
    };
  }

  async list(access: WeddingAccess, q: GuestQuery) {
    const where: Prisma.InvitationWhereInput = {
      ...this.scope(access),
      ...(q.cohort ? { cohort: q.cohort } : {}),
      ...(q.ceremonyId ? { ceremonies: { some: { ceremonyId: q.ceremonyId } } } : {}),
      ...(q.rsvp === 'PENDING' ? { rsvp: { is: null } } : q.rsvp ? { rsvp: { is: { status: q.rsvp } } } : {}),
      ...(q.search
        ? {
            OR: [
              { guestName: { contains: q.search, mode: 'insensitive' } },
              { phone: { contains: q.search.replace(/\s/g, '') } },
              { email: { contains: q.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const rows = await this.prisma.invitation.findMany({
      where,
      include: { ceremonies: { select: { ceremonyId: true } }, rsvp: { select: { status: true } } },
      orderBy: { guestName: 'asc' },
      take: 5000,
    });
    return rows.map((r) => this.view(access, r));
  }

  private normalisePhone(phone: string) {
    const e164 = toE164(phone, this.env.DEFAULT_PHONE_COUNTRY);
    if (!e164) throw new BadRequestException({ code: 'INVALID_PHONE', message: `Invalid phone number: ${phone}` });
    return e164;
  }

  private async validCeremonyIds(weddingId: string, ids: string[] | undefined) {
    if (!ids?.length) return [];
    const found = await this.prisma.ceremony.findMany({ where: { weddingId, id: { in: ids } }, select: { id: true } });
    if (found.length !== new Set(ids).size) throw new BadRequestException('One or more ceremonies do not belong to this wedding');
    return found.map((c) => c.id);
  }

  async create(access: WeddingAccess, input: GuestInput) {
    const phone = this.normalisePhone(input.phone);
    const ceremonyIds = await this.validCeremonyIds(access.wedding.id, input.ceremonyIds);
    const refLead = access.role === 'LEAD' ? access.member?.label ?? null : input.refLead ?? null;
    const user = await this.prisma.user.findUnique({ where: { phone }, select: { id: true } });
    const inv = await this.prisma.invitation.create({
      data: {
        weddingId: access.wedding.id,
        guestName: input.guestName,
        phone,
        email: input.email ?? null,
        cohort: input.cohort ?? 'FAMILY',
        maxAttendees: input.maxAttendees ?? 2,
        enableRegistry: input.enableRegistry ?? true,
        refLead,
        refToken: randomCode(12),
        userId: user?.id ?? null,
        ceremonies: { create: ceremonyIds.map((ceremonyId) => ({ ceremonyId })) },
      },
      include: { ceremonies: { select: { ceremonyId: true } }, rsvp: { select: { status: true } } },
    });
    return this.view(access, inv);
  }

  async update(access: WeddingAccess, id: string, input: Partial<GuestInput>) {
    const existing = await this.prisma.invitation.findFirst({ where: { id, ...this.scope(access) } });
    if (!existing) throw new NotFoundException('Guest not found');
    const ceremonyIds = input.ceremonyIds ? await this.validCeremonyIds(access.wedding.id, input.ceremonyIds) : undefined;
    const phone = input.phone ? this.normalisePhone(input.phone) : undefined;
    const inv = await this.prisma.invitation.update({
      where: { id },
      data: {
        guestName: input.guestName,
        phone,
        email: input.email,
        cohort: input.cohort,
        maxAttendees: input.maxAttendees,
        enableRegistry: input.enableRegistry,
        ...(access.role !== 'LEAD' && input.refLead !== undefined ? { refLead: input.refLead } : {}),
        ...(ceremonyIds
          ? { ceremonies: { deleteMany: {}, create: ceremonyIds.map((ceremonyId) => ({ ceremonyId })) } }
          : {}),
      },
      include: { ceremonies: { select: { ceremonyId: true } }, rsvp: { select: { status: true } } },
    });
    return this.view(access, inv);
  }

  async exportCsv(access: WeddingAccess) {
    const [rows, ceremonies] = await Promise.all([
      this.list(access, {}),
      this.prisma.ceremony.findMany({ where: { weddingId: access.wedding.id }, select: { id: true, title: true } }),
    ]);
    const titles = new Map(ceremonies.map((c) => [c.id, c.title]));
    return toCsv(
      ['guest_name', 'phone_whatsapp', 'email', 'guest_category', 'invited_events', 'enable_registry', 'max_attendees', 'ref_lead', 'rsvp_status', 'invite_link'],
      rows.map((g) => [
        g.guestName,
        g.phone,
        g.email,
        g.cohort,
        g.ceremonyIds.map((id) => titles.get(id)).join('|'),
        g.enableRegistry,
        g.maxAttendees,
        g.refLead,
        g.rsvpStatus,
        g.inviteLink,
      ]),
    );
  }

  async remove(access: WeddingAccess, id: string) {
    const existing = await this.prisma.invitation.findFirst({ where: { id, ...this.scope(access) } });
    if (!existing) throw new NotFoundException('Guest not found');
    await this.prisma.invitation.delete({ where: { id } });
  }

  async get(access: WeddingAccess, id: string) {
    const inv = await this.prisma.invitation.findFirst({
      where: { id, ...this.scope(access) },
      include: { ceremonies: { select: { ceremonyId: true } }, rsvp: { select: { status: true } } },
    });
    if (!inv) throw new NotFoundException('Guest not found');
    return this.view(access, inv);
  }

  /**
   * Upserts guests from a CSV using the admin intake column names
   * (guest_name, phone_whatsapp, guest_category, invited_events,
   * enable_registry, max_attendees, email, ref_lead). Rows are validated
   * independently; failures are reported without aborting the import.
   */
  async importCsv(access: WeddingAccess, buffer: Buffer) {
    let records: Record<string, string>[];
    try {
      records = parse(buffer, {
        columns: (header: string[]) =>
          header.map((h) => {
            const key = h.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
            return HEADER_ALIASES[key] ?? key;
          }),
        skip_empty_lines: true,
        trim: true,
        bom: true,
      });
    } catch (err) {
      throw new BadRequestException(`Could not read CSV: ${(err as Error).message}`);
    }
    if (records.length > MAX_IMPORT_ROWS) throw new BadRequestException(`A single import is limited to ${MAX_IMPORT_ROWS} rows`);

    const ceremonies = await this.prisma.ceremony.findMany({ where: { weddingId: access.wedding.id } });
    const byTitle = new Map(ceremonies.map((c) => [c.title.trim().toLowerCase(), c.id]));
    const result = { created: 0, updated: 0, errors: [] as { row: number; message: string }[] };

    for (const [i, row] of records.entries()) {
      const rowNo = i + 2;
      try {
        const guestName = row.guest_name?.trim();
        if (!guestName) throw new Error('guest_name is required');
        if (guestName.length > 80) throw new Error('guest_name must be at most 80 characters');
        const phone = toE164(row.phone_whatsapp ?? '', this.env.DEFAULT_PHONE_COUNTRY);
        if (!phone) throw new Error(`invalid phone_whatsapp "${row.phone_whatsapp ?? ''}"`);
        const cohortRaw = (row.guest_category ?? '').trim().toLowerCase();
        const cohort = cohortRaw ? COHORT_ALIASES[cohortRaw] : 'FAMILY';
        if (!cohort) throw new Error(`unknown guest_category "${row.guest_category}"`);
        const maxAttendees = row.max_attendees ? Number.parseInt(row.max_attendees, 10) : 2;
        if (!Number.isInteger(maxAttendees) || maxAttendees < 1 || maxAttendees > 10) throw new Error('max_attendees must be 1-10');
        const enableRegistry = row.enable_registry ? !['false', 'no', 'off', '0', 'n'].includes(row.enable_registry.toLowerCase()) : true;

        let ceremonyIds: string[] = [];
        const events = (row.invited_events ?? '').trim();
        if (events.toLowerCase() === 'all') ceremonyIds = ceremonies.map((c) => c.id);
        else if (events) {
          ceremonyIds = events.split(/[|;,]/).map((t) => {
            const id = byTitle.get(t.trim().toLowerCase());
            if (!id) throw new Error(`unknown ceremony "${t.trim()}"`);
            return id;
          });
        }

        const refLead = access.role === 'LEAD' ? access.member?.label ?? null : row.ref_lead?.trim() || null;
        const existing = await this.prisma.invitation.findUnique({
          where: { weddingId_phone: { weddingId: access.wedding.id, phone } },
        });
        if (existing && access.role === 'LEAD' && existing.refLead !== refLead) throw new Error('guest belongs to another family lead');
        const data = {
          guestName,
          email: row.email?.trim() || null,
          cohort,
          maxAttendees,
          enableRegistry,
          refLead,
          ceremonies: { deleteMany: {}, create: [...new Set(ceremonyIds)].map((ceremonyId) => ({ ceremonyId })) },
        };
        if (existing) {
          await this.prisma.invitation.update({ where: { id: existing.id }, data });
          result.updated++;
        } else {
          const user = await this.prisma.user.findUnique({ where: { phone }, select: { id: true } });
          await this.prisma.invitation.create({
            data: {
              ...data,
              ceremonies: { create: data.ceremonies.create },
              weddingId: access.wedding.id,
              phone,
              refToken: randomCode(12),
              userId: user?.id ?? null,
            },
          });
          result.created++;
        }
      } catch (err) {
        result.errors.push({ row: rowNo, message: (err as Error).message });
      }
    }
    return result;
  }
}
