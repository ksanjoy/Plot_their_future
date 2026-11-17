import { BadRequestException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import type { WeddingAccess } from '../access/wedding-access.service.js';
import { toCsv } from '../common/csv.js';
import type { Prisma, RsvpStatus } from '../generated/prisma/client.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
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
    private readonly prisma: PrismaService,
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
    const [rsvp, ceremonies] = await Promise.all([
      this.prisma.rsvp.findUnique({ where: { invitationId: inv.id } }),
      this.prisma.ceremony.findMany({
        where: { invitations: { some: { invitationId: inv.id } } },
        orderBy: { startsAt: 'asc' },
        select: { id: true, title: true, startsAt: true, venueName: true },
      }),
    ]);
    return {
      invitation: { id: inv.id, guestName: inv.guestName, email: inv.email, maxAttendees: inv.maxAttendees },
      invitedCeremonies: ceremonies,
      rsvp,
    };
  }

  async upsert(access: WeddingAccess, input: RsvpInput) {
    const inv = this.requireInvitation(access);
    const invited = await this.prisma.invitationCeremony.findMany({
      where: { invitationId: inv.id },
      include: { ceremony: { select: { id: true, title: true, startsAt: true } } },
    });
    const invitedIds = new Set(invited.map((i) => i.ceremonyId));
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

    const rsvp = await this.prisma.$transaction(async (tx) => {
      if (input.guestName || input.email !== undefined) {
        await tx.invitation.update({
          where: { id: inv.id },
          data: { ...(input.guestName ? { guestName: input.guestName } : {}), ...(input.email !== undefined ? { email: input.email } : {}) },
        });
      }
      return tx.rsvp.upsert({
        where: { invitationId: inv.id },
        create: { ...data, weddingId: access.wedding.id, invitationId: inv.id },
        update: data,
      });
    });

    const w = access.wedding;
    const titles = invited.filter((i) => rsvp.attendingCeremonyIds.includes(i.ceremonyId)).map((i) => i.ceremony.title);
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

  private scope(access: WeddingAccess): Prisma.InvitationWhereInput {
    return access.role === 'LEAD' ? { weddingId: access.wedding.id, refLead: access.member?.label ?? '__none__' } : { weddingId: access.wedding.id };
  }

  async list(access: WeddingAccess, status?: RsvpStatus) {
    const rows = await this.prisma.rsvp.findMany({
      where: { invitation: this.scope(access), ...(status ? { status } : {}) },
      include: { invitation: { select: { guestName: true, phone: true, cohort: true, refLead: true, maxAttendees: true } } },
      orderBy: { updatedAt: 'desc' },
    });
    const staffCanSeePhone = access.role !== 'VENUE';
    return rows.map((r) => ({
      ...r,
      invitation: { ...r.invitation, phone: staffCanSeePhone ? r.invitation.phone : undefined },
    }));
  }

  async summary(weddingId: string, scope: Prisma.InvitationWhereInput = { weddingId }) {
    const [invited, rsvps, ceremonies] = await Promise.all([
      this.prisma.invitation.count({ where: scope }),
      this.prisma.rsvp.findMany({ where: { invitation: scope } }),
      this.prisma.ceremony.findMany({ where: { weddingId }, orderBy: { startsAt: 'asc' }, select: { id: true, title: true, startsAt: true } }),
    ]);
    const out = {
      invited,
      responded: rsvps.length,
      pending: invited - rsvps.length,
      attending: 0,
      declined: 0,
      maybe: 0,
      headcount: { adults: 0, children: 0, infants: 0, total: 0 },
      byCeremony: ceremonies.map((c) => ({ ...c, adults: 0, children: 0, infants: 0, total: 0 })),
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
      for (const c of out.byCeremony) {
        if (!r.attendingCeremonyIds.includes(c.id)) continue;
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
      this.prisma.ceremony.findMany({ where: { weddingId: access.wedding.id }, select: { id: true, title: true } }),
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
}
