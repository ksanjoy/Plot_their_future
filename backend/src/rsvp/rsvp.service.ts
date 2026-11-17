import { BadRequestException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import type { FilterQuery } from 'mongoose';
import type { WeddingAccess } from '../access/wedding-access.service.js';
import { toCsv } from '../common/csv.js';
import { idString, idStrings } from '../database/helpers.js';
import { withTransaction } from '../database/helpers.js';
import {
  CeremonyModel,
  InvitationCeremonyModel,
  InvitationModel,
  RsvpModel,
  type CeremonyDoc,
  type RsvpDoc,
} from '../models/schemas.js';
import type { Invitation, RsvpStatus } from '../models/types.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { RealtimeService, rooms } from '../realtime/realtime.service.js';

export interface RsvpInput {
  status: RsvpStatus;
  adults: number;
  children: number;
  infants: number;
  attendingCeremonyIds: string[];
  dietary: string[];
  allergies?: string | null;
  arrivalMode?: string | null;
  arrivalDetails?: string | null;
  arrivalAt?: Date | null;
  needsAccommodation: boolean;
  checkInDate?: Date | null;
  checkOutDate?: Date | null;
  needsShuttle: boolean;
  note?: string | null;
  guestName?: string;
  email?: string | null;
}

@Injectable()
export class RsvpService {
  private readonly logger = new Logger(RsvpService.name);

  constructor(
    private readonly notifications: NotificationsService,
    private readonly realtime: RealtimeService,
  ) {}

  private requireInvitation(access: WeddingAccess) {
    if (!access.invitation) {
      throw new ForbiddenException({ code: 'NOT_INVITED', message: 'Only invited guests can RSVP' });
    }
    return access.invitation;
  }

  async mine(access: WeddingAccess) {
    const inv = this.requireInvitation(access);
    const links = await InvitationCeremonyModel.find({ invitationId: inv._id }).select('ceremonyId');
    const [rsvp, ceremonies] = await Promise.all([
      RsvpModel.findOne({ invitationId: inv._id }),
      CeremonyModel.find({ _id: { $in: links.map((link) => link.ceremonyId) } })
        .sort({ startsAt: 1 })
        .select('title startsAt venueName'),
    ]);
    return {
      invitation: { id: inv.id, guestName: inv.guestName, email: inv.email, maxAttendees: inv.maxAttendees },
      invitedCeremonies: ceremonies.map((c) => ({ id: c.id, title: c.title, startsAt: c.startsAt, venueName: c.venueName })),
      rsvp,
    };
  }

  async upsert(access: WeddingAccess, input: RsvpInput) {
    const inv = this.requireInvitation(access);
    const invited = await InvitationCeremonyModel.find({ invitationId: inv._id }).populate<{ ceremony: CeremonyDoc }>('ceremony');
    const invitedIds = new Set(invited.map((i) => idString(i.ceremonyId)));
    const declined = input.status === 'DECLINED';

    if (!declined) {
      if (input.adults + input.children > inv.maxAttendees) {
        throw new BadRequestException({
          code: 'SEAT_LIMIT',
          message: `Your invitation covers ${inv.maxAttendees} guest${inv.maxAttendees === 1 ? '' : 's'}`,
        });
      }
      if (input.adults < 1) throw new BadRequestException('At least one adult must attend');
      const stray = input.attendingCeremonyIds.filter((id) => !invitedIds.has(id));
      if (stray.length) throw new BadRequestException({ code: 'NOT_INVITED_TO_CEREMONY', message: 'You can only RSVP for ceremonies you are invited to' });
      if (input.status === 'ATTENDING' && !input.attendingCeremonyIds.length && invitedIds.size) {
        throw new BadRequestException('Select at least one ceremony you will attend');
      }
      if (input.needsAccommodation && input.checkInDate && input.checkOutDate && input.checkOutDate <= input.checkInDate) {
        throw new BadRequestException('Check-out must be after check-in');
      }
    }

    const data = {
      status: input.status,
      adults: declined ? 0 : input.adults,
      children: declined ? 0 : input.children,
      infants: declined ? 0 : input.infants,
      attendingCeremonyIds: declined ? [] : [...new Set(input.attendingCeremonyIds)],
      dietary: declined ? [] : input.dietary,
      allergies: declined ? null : input.allergies ?? null,
      arrivalMode: declined ? null : input.arrivalMode ?? null,
      arrivalDetails: declined ? null : input.arrivalDetails ?? null,
      arrivalAt: declined ? null : input.arrivalAt ?? null,
      needsAccommodation: !declined && input.needsAccommodation,
      checkInDate: !declined && input.needsAccommodation ? input.checkInDate ?? null : null,
      checkOutDate: !declined && input.needsAccommodation ? input.checkOutDate ?? null : null,
      needsShuttle: !declined && input.needsShuttle,
      note: input.note ?? null,
    };

    const rsvp = await withTransaction(async (session) => {
      if (input.guestName || input.email !== undefined) {
        await InvitationModel.updateOne(
          { _id: inv._id },
          { $set: { ...(input.guestName ? { guestName: input.guestName } : {}), ...(input.email !== undefined ? { email: input.email } : {}) } },
          { session },
        );
      }
      return RsvpModel.findOneAndUpdate(
        { invitationId: inv._id },
        { $set: data, $setOnInsert: { weddingId: access.wedding._id, invitationId: inv._id } },
        { upsert: true, new: true, session, setDefaultsOnInsert: true },
      );
    });
    if (!rsvp) throw new BadRequestException('Could not save RSVP');

    const w = access.wedding;
    const attending = new Set(idStrings(rsvp.attendingCeremonyIds));
    const titles = invited
      .filter((i) => attending.has(idString(i.ceremonyId)))
      .map((i) => (i.get('ceremony') as CeremonyDoc).title);
    const summary =
      rsvp.status === 'DECLINED'
        ? 'Regretfully declined'
        : `${rsvp.status === 'MAYBE' ? 'Tentative' : 'Attending'} • ${rsvp.adults} adult${rsvp.adults === 1 ? '' : 's'}${rsvp.children ? `, ${rsvp.children} child${rsvp.children === 1 ? '' : 'ren'}` : ''}${rsvp.infants ? `, ${rsvp.infants} infant${rsvp.infants === 1 ? '' : 's'}` : ''}`;
    const details = rsvp.status === 'DECLINED' ? 'We will miss you. You can still send your blessings.' : titles.join(', ') || 'Wedding celebrations';
    this.notifications
      .sendRsvpConfirmation({ phone: inv.phone, guestName: input.guestName ?? inv.guestName, couple: `${w.brideName} & ${w.groomName}`, summary, details })
      .catch((err: Error) => this.logger.warn(`RSVP confirmation to ${inv.id} failed: ${err.message}`));

    this.realtime.emit(rooms.admin(w.id), 'rsvp.updated', await this.summary(access.wedding.id));
    return rsvp;
  }

  private scope(access: WeddingAccess): FilterQuery<Invitation> {
    return access.role === 'LEAD'
      ? { weddingId: access.wedding._id, refLead: access.member?.label ?? '__none__' }
      : { weddingId: access.wedding._id };
  }

  private async invitationsInScope(scope: FilterQuery<Invitation>) {
    return InvitationModel.find(scope).select('guestName phone cohort refLead maxAttendees');
  }

  async list(access: WeddingAccess, status?: RsvpStatus) {
    const invitations = await this.invitationsInScope(this.scope(access));
    const byId = new Map(invitations.map((inv) => [inv.id, inv]));
    const rows = await RsvpModel.find({
      invitationId: { $in: invitations.map((inv) => inv._id) },
      ...(status ? { status } : {}),
    }).sort({ updatedAt: -1 });
    const staffCanSeePhone = access.role !== 'VENUE';
    return rows.map((r) => {
      const invitation = byId.get(idString(r.invitationId));
      return {
        ...this.rsvpPlain(r),
        invitation: {
          guestName: invitation?.guestName,
          phone: staffCanSeePhone ? invitation?.phone : undefined,
          cohort: invitation?.cohort,
          refLead: invitation?.refLead,
          maxAttendees: invitation?.maxAttendees,
        },
      };
    });
  }

  async summary(weddingId: string, scope: FilterQuery<Invitation> = { weddingId }) {
    const invitations = await this.invitationsInScope(scope);
    const [rsvps, ceremonies] = await Promise.all([
      RsvpModel.find({ invitationId: { $in: invitations.map((inv) => inv._id) } }),
      CeremonyModel.find({ weddingId }).sort({ startsAt: 1 }).select('title startsAt'),
    ]);
    const invited = invitations.length;
    const out = {
      invited,
      responded: rsvps.length,
      pending: invited - rsvps.length,
      attending: 0,
      declined: 0,
      maybe: 0,
      headcount: { adults: 0, children: 0, infants: 0, total: 0 },
      byCeremony: ceremonies.map((c) => ({ id: c.id, title: c.title, startsAt: c.startsAt, adults: 0, children: 0, infants: 0, total: 0 })),
      dietary: {} as Record<string, number>,
      accommodation: 0,
      shuttle: 0,
    };
    for (const r of rsvps) {
      if (r.status === 'ATTENDING') out.attending++;
      else if (r.status === 'DECLINED') out.declined++;
      else out.maybe++;
      if (r.status !== 'ATTENDING') continue;
      out.headcount.adults += r.adults;
      out.headcount.children += r.children;
      out.headcount.infants += r.infants;
      const attending = new Set(idStrings(r.attendingCeremonyIds));
      for (const c of out.byCeremony) {
        if (!attending.has(c.id)) continue;
        c.adults += r.adults;
        c.children += r.children;
        c.infants += r.infants;
        c.total += r.adults + r.children + r.infants;
      }
      for (const d of r.dietary) out.dietary[d] = (out.dietary[d] ?? 0) + r.adults + r.children;
      if (r.needsAccommodation) out.accommodation += r.adults + r.children + r.infants;
      if (r.needsShuttle) out.shuttle += r.adults + r.children + r.infants;
    }
    out.headcount.total = out.headcount.adults + out.headcount.children + out.headcount.infants;
    return out;
  }

  scopedSummary(access: WeddingAccess) {
    return this.summary(access.wedding.id, this.scope(access));
  }

  async exportCsv(access: WeddingAccess) {
    const [rows, ceremonies] = await Promise.all([
      this.list(access),
      CeremonyModel.find({ weddingId: access.wedding._id }).select('title'),
    ]);
    const titles = new Map(ceremonies.map((c) => [c.id, c.title]));
    return toCsv(
      ['guest_name', 'phone', 'cohort', 'ref_lead', 'status', 'adults', 'children', 'infants', 'ceremonies', 'dietary', 'allergies', 'arrival_mode', 'arrival_details', 'arrival_at', 'accommodation', 'check_in', 'check_out', 'shuttle', 'note', 'updated_at'],
      rows.map((r) => [
        r.invitation.guestName,
        r.invitation.phone,
        r.invitation.cohort,
        r.invitation.refLead,
        r.status,
        r.adults,
        r.children,
        r.infants,
        r.attendingCeremonyIds.map((id) => titles.get(id)).join('|'),
        r.dietary.join('|'),
        r.allergies,
        r.arrivalMode,
        r.arrivalDetails,
        r.arrivalAt,
        r.needsAccommodation,
        r.checkInDate?.toISOString().slice(0, 10),
        r.checkOutDate?.toISOString().slice(0, 10),
        r.needsShuttle,
        r.note,
        r.updatedAt,
      ]),
    );
  }

  private rsvpPlain(r: RsvpDoc) {
    return {
      id: r.id,
      weddingId: idString(r.weddingId),
      invitationId: idString(r.invitationId),
      status: r.status,
      adults: r.adults,
      children: r.children,
      infants: r.infants,
      attendingCeremonyIds: idStrings(r.attendingCeremonyIds),
      dietary: r.dietary,
      allergies: r.allergies,
      arrivalMode: r.arrivalMode,
      arrivalDetails: r.arrivalDetails,
      arrivalAt: r.arrivalAt,
      needsAccommodation: r.needsAccommodation,
      checkInDate: r.checkInDate,
      checkOutDate: r.checkOutDate,
      needsShuttle: r.needsShuttle,
      note: r.note,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }
}
