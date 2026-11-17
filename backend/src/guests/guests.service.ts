import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { parse } from 'csv-parse/sync';
import type { FilterQuery } from 'mongoose';
import type { WeddingAccess } from '../access/wedding-access.service.js';
import { toCsv } from '../common/csv.js';
import { randomCode } from '../common/utils/crypto.js';
import { toE164 } from '../common/utils/phone.js';
import { InjectEnv, type Env } from '../config/config.module.js';
import { escapeRegex, idString, withTransaction } from '../database/helpers.js';
import { deleteInvitationCascade } from '../models/cascades.js';
import {
  CeremonyModel,
  InvitationCeremonyModel,
  InvitationModel,
  RsvpModel,
  UserModel,
  type InvitationDoc,
} from '../models/schemas.js';
import type { GuestCohort, Invitation } from '../models/types.js';

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

interface GuestViewSource {
  id: string;
  guestName: string;
  phone: string;
  email: string | null;
  cohort: GuestCohort;
  maxAttendees: number;
  enableRegistry: boolean;
  refLead: string | null;
  userId: unknown;
  createdAt: Date;
  refToken: string;
  ceremonyIds: string[];
  rsvpStatus: string | null;
}

@Injectable()
export class GuestsService {
  constructor(@InjectEnv() private readonly env: Env) {}

  inviteLink(wedding: { slug: string }, inv: { refToken: string; refLead: string | null }) {
    const url = new URL(`/w/${wedding.slug}`, this.env.WEB_PUBLIC_URL);
    url.searchParams.set('ref_token', inv.refToken);
    if (inv.refLead) url.searchParams.set('ref_lead', inv.refLead);
    return url.toString();
  }

  private scope(access: WeddingAccess): FilterQuery<Invitation> {
    return access.role === 'LEAD'
      ? { weddingId: access.wedding._id, refLead: access.member?.label ?? '__none__' }
      : { weddingId: access.wedding._id };
  }

  view(access: WeddingAccess, inv: GuestViewSource) {
    return {
      id: inv.id,
      guestName: inv.guestName,
      phone: inv.phone,
      email: inv.email,
      cohort: inv.cohort,
      maxAttendees: inv.maxAttendees,
      enableRegistry: inv.enableRegistry,
      refLead: inv.refLead,
      ceremonyIds: inv.ceremonyIds,
      rsvpStatus: inv.rsvpStatus ?? 'PENDING',
      linkedAccount: Boolean(inv.userId),
      inviteLink: this.inviteLink(access.wedding, inv),
      createdAt: inv.createdAt,
    };
  }

  private async decorate(rows: InvitationDoc[]): Promise<GuestViewSource[]> {
    const ids = rows.map((row) => row._id);
    const [links, rsvps] = await Promise.all([
      InvitationCeremonyModel.find({ invitationId: { $in: ids } }).select('invitationId ceremonyId'),
      RsvpModel.find({ invitationId: { $in: ids } }).select('invitationId status'),
    ]);
    const ceremonies = new Map<string, string[]>();
    for (const link of links) {
      const key = idString(link.invitationId);
      const list = ceremonies.get(key) ?? [];
      list.push(idString(link.ceremonyId));
      ceremonies.set(key, list);
    }
    const status = new Map(rsvps.map((rsvp) => [idString(rsvp.invitationId), rsvp.status]));
    return rows.map((row) => ({
      id: row.id,
      guestName: row.guestName,
      phone: row.phone,
      email: row.email,
      cohort: row.cohort,
      maxAttendees: row.maxAttendees,
      enableRegistry: row.enableRegistry,
      refLead: row.refLead,
      userId: row.userId,
      createdAt: row.createdAt,
      refToken: row.refToken,
      ceremonyIds: ceremonies.get(row.id) ?? [],
      rsvpStatus: status.get(row.id) ?? null,
    }));
  }

  async list(access: WeddingAccess, q: GuestQuery) {
    const where: FilterQuery<Invitation> = { ...this.scope(access) };
    if (q.cohort) where.cohort = q.cohort;
    if (q.search) {
      const name = escapeRegex(q.search);
      const phone = escapeRegex(q.search.replace(/\s/g, ''));
      where.$or = [
        { guestName: { $regex: name, $options: 'i' } },
        { phone: { $regex: phone } },
        { email: { $regex: name, $options: 'i' } },
      ];
    }
    let idFilter: string[] | null = null;
    if (q.ceremonyId) {
      const links = await InvitationCeremonyModel.find({ ceremonyId: q.ceremonyId }).select('invitationId');
      idFilter = links.map((link) => idString(link.invitationId));
    }
    if (q.rsvp === 'PENDING') {
      const responded = await RsvpModel.find({ weddingId: access.wedding._id }).select('invitationId');
      const exclude = new Set(responded.map((row) => idString(row.invitationId)));
      if (idFilter) idFilter = idFilter.filter((id) => !exclude.has(id));
      else where._id = { $nin: [...exclude] };
    } else if (q.rsvp) {
      const matched = await RsvpModel.find({ weddingId: access.wedding._id, status: q.rsvp }).select('invitationId');
      const include = new Set(matched.map((row) => idString(row.invitationId)));
      idFilter = (idFilter ?? [...include]).filter((id) => include.has(id));
    }
    if (idFilter) where._id = { $in: idFilter };
    const rows = await InvitationModel.find(where).sort({ guestName: 1 }).limit(5000);
    const decorated = await this.decorate(rows);
    return decorated.map((row) => this.view(access, row));
  }

  private normalisePhone(phone: string) {
    const e164 = toE164(phone, this.env.DEFAULT_PHONE_COUNTRY);
    if (!e164) throw new BadRequestException({ code: 'INVALID_PHONE', message: `Invalid phone number: ${phone}` });
    return e164;
  }

  private async validCeremonyIds(weddingId: string, ids: string[] | undefined) {
    if (!ids?.length) return [];
    const found = await CeremonyModel.find({ weddingId, _id: { $in: ids } }).select('_id');
    if (found.length !== new Set(ids).size) throw new BadRequestException('One or more ceremonies do not belong to this wedding');
    return found.map((c) => c.id);
  }

  private async replaceCeremonies(invitationId: unknown, ceremonyIds: string[], session: import('mongoose').ClientSession) {
    await InvitationCeremonyModel.deleteMany({ invitationId }, { session });
    if (!ceremonyIds.length) return;
    await InvitationCeremonyModel.insertMany(
      ceremonyIds.map((ceremonyId) => ({ invitationId, ceremonyId })),
      { session },
    );
  }

  async create(access: WeddingAccess, input: GuestInput) {
    const phone = this.normalisePhone(input.phone);
    const ceremonyIds = await this.validCeremonyIds(access.wedding.id, input.ceremonyIds);
    const refLead = access.role === 'LEAD' ? access.member?.label ?? null : input.refLead ?? null;
    const user = await UserModel.findOne({ phone }).select('_id');
    const inv = await withTransaction(async (session) => {
      const [created] = await InvitationModel.create(
        [
          {
            weddingId: access.wedding._id,
            guestName: input.guestName,
            phone,
            email: input.email ?? null,
            cohort: input.cohort ?? 'FAMILY',
            maxAttendees: input.maxAttendees ?? 2,
            enableRegistry: input.enableRegistry ?? true,
            refLead,
            refToken: randomCode(12),
            userId: user?._id ?? null,
          },
        ],
        { session },
      );
      if (!created) throw new Error('Failed to create guest');
      await this.replaceCeremonies(created._id, ceremonyIds, session);
      return created;
    });
    const [view] = await this.decorate([inv]);
    return this.view(access, view!);
  }

  async update(access: WeddingAccess, id: string, input: Partial<GuestInput>) {
    const existing = await InvitationModel.findOne({ _id: id, ...this.scope(access) });
    if (!existing) throw new NotFoundException('Guest not found');
    const ceremonyIds = input.ceremonyIds ? await this.validCeremonyIds(access.wedding.id, input.ceremonyIds) : undefined;
    const phone = input.phone ? this.normalisePhone(input.phone) : undefined;
    const patch: Record<string, unknown> = {};
    if (input.guestName !== undefined) patch.guestName = input.guestName;
    if (phone !== undefined) patch.phone = phone;
    if (input.email !== undefined) patch.email = input.email;
    if (input.cohort !== undefined) patch.cohort = input.cohort;
    if (input.maxAttendees !== undefined) patch.maxAttendees = input.maxAttendees;
    if (input.enableRegistry !== undefined) patch.enableRegistry = input.enableRegistry;
    if (access.role !== 'LEAD' && input.refLead !== undefined) patch.refLead = input.refLead;
    const inv = await withTransaction(async (session) => {
      const updated = await InvitationModel.findByIdAndUpdate(id, { $set: patch }, { new: true, session });
      if (!updated) throw new NotFoundException('Guest not found');
      if (ceremonyIds) await this.replaceCeremonies(updated._id, ceremonyIds, session);
      return updated;
    });
    const [view] = await this.decorate([inv]);
    return this.view(access, view!);
  }

  async exportCsv(access: WeddingAccess) {
    const [rows, ceremonies] = await Promise.all([
      this.list(access, {}),
      CeremonyModel.find({ weddingId: access.wedding._id }).select('title'),
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
    const existing = await InvitationModel.findOne({ _id: id, ...this.scope(access) });
    if (!existing) throw new NotFoundException('Guest not found');
    await deleteInvitationCascade(existing.id);
  }

  async get(access: WeddingAccess, id: string) {
    const inv = await InvitationModel.findOne({ _id: id, ...this.scope(access) });
    if (!inv) throw new NotFoundException('Guest not found');
    const [view] = await this.decorate([inv]);
    return this.view(access, view!);
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

    const ceremonies = await CeremonyModel.find({ weddingId: access.wedding._id });
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
        const existing = await InvitationModel.findOne({ weddingId: access.wedding._id, phone });
        if (existing && access.role === 'LEAD' && existing.refLead !== refLead) throw new Error('guest belongs to another family lead');
        const data = { guestName, email: row.email?.trim() || null, cohort, maxAttendees, enableRegistry, refLead };
        const uniqueCeremonyIds = [...new Set(ceremonyIds)];
        if (existing) {
          await withTransaction(async (session) => {
            await InvitationModel.updateOne({ _id: existing._id }, { $set: data }, { session });
            await this.replaceCeremonies(existing._id, uniqueCeremonyIds, session);
          });
          result.updated++;
        } else {
          const user = await UserModel.findOne({ phone }).select('_id');
          await withTransaction(async (session) => {
            const [created] = await InvitationModel.create(
              [
                {
                  ...data,
                  weddingId: access.wedding._id,
                  phone,
                  refToken: randomCode(12),
                  userId: user?._id ?? null,
                },
              ],
              { session },
            );
            if (!created) throw new Error('Failed to create guest');
            await this.replaceCeremonies(created._id, uniqueCeremonyIds, session);
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
