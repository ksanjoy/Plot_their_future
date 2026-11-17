import { InjectQueue } from '@nestjs/bullmq';
import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { STAFF_ROLES, type WeddingAccess } from '../access/wedding-access.service.js';
import { QUEUES } from '../jobs/queues.js';
import { deleteCeremonyCascade } from '../models/cascades.js';
import { CeremonyModel, InvitationCeremonyModel, InvitationModel, RsvpModel, type CeremonyDoc, type WeddingDoc } from '../models/schemas.js';
import { formatCeremonyTime, NotificationsService } from '../notifications/notifications.service.js';

export interface CeremonyInput {
  title: string;
  description?: string | null;
  startsAt: Date;
  endsAt?: Date | null;
  venueName: string;
  venueAddress?: string | null;
  venueMapsUrl?: string | null;
  streamUrl?: string | null;
  dressCode?: string | null;
  sortOrder?: number;
}

const REMINDER_LEAD_MS = 2 * 60 * 60 * 1000;

@Injectable()
export class CeremoniesService {
  private readonly logger = new Logger(CeremoniesService.name);

  constructor(
    private readonly notifications: NotificationsService,
    @InjectQueue(QUEUES.reminders) private readonly reminders: Queue,
  ) {}

  async list(access: WeddingAccess) {
    const staff = STAFF_ROLES.includes(access.role) || access.role === 'PLATFORM';
    const filter: { weddingId: unknown; _id?: { $in: unknown[] } } = { weddingId: access.wedding._id };
    if (!staff && access.invitation) {
      const links = await InvitationCeremonyModel.find({ invitationId: access.invitation._id }).select('ceremonyId');
      filter._id = { $in: links.map((link) => link.ceremonyId) };
    }
    return CeremonyModel.find(filter).sort({ startsAt: 1, sortOrder: 1 });
  }

  async create(access: WeddingAccess, input: CeremonyInput) {
    const ceremony = await CeremonyModel.create({ ...input, weddingId: access.wedding._id });
    await this.scheduleReminder(ceremony);
    return ceremony;
  }

  async update(access: WeddingAccess, id: string, input: Partial<CeremonyInput>) {
    await this.find(access.wedding.id, id);
    const patch = Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
    const ceremony = await CeremonyModel.findByIdAndUpdate(id, { $set: patch }, { new: true });
    if (!ceremony) throw new NotFoundException('Ceremony not found');
    await this.scheduleReminder(ceremony);
    return ceremony;
  }

  async remove(access: WeddingAccess, id: string) {
    await this.find(access.wedding.id, id);
    await deleteCeremonyCascade(id);
  }

  async ics(access: WeddingAccess, id: string) {
    const c = await this.find(access.wedding.id, id);
    if (access.role === 'GUEST' && access.invitation) {
      const invited = await InvitationCeremonyModel.findOne({ invitationId: access.invitation._id, ceremonyId: id });
      if (!invited) throw new ForbiddenException('You are not invited to this ceremony');
    }
    return { filename: `${access.wedding.slug}-${c.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.ics`, body: toIcs(c, access.wedding) };
  }

  private async find(weddingId: string, id: string) {
    const c = await CeremonyModel.findOne({ _id: id, weddingId });
    if (!c) throw new NotFoundException('Ceremony not found');
    return c;
  }

  /** One delayed job per (ceremony, start time); a rescheduled ceremony gets a fresh job and stale ones no-op. */
  private async scheduleReminder(c: CeremonyDoc) {
    const delay = c.startsAt.getTime() - REMINDER_LEAD_MS - Date.now();
    if (delay <= 0) return;
    await this.reminders.add(
      'ceremony-reminder',
      { ceremonyId: c.id, startsAt: c.startsAt.toISOString() },
      { delay, jobId: `reminder-${c.id}-${c.startsAt.getTime()}` },
    );
  }

  async sendReminders(ceremonyId: string, startsAtIso: string) {
    const c = await CeremonyModel.findById(ceremonyId).populate<{ wedding: WeddingDoc }>('wedding');
    if (!c || c.startsAt.toISOString() !== startsAtIso) return { skipped: true };
    const wedding = c.get('wedding') as WeddingDoc | undefined;
    if (!wedding) return { skipped: true };
    const links = await InvitationCeremonyModel.find({ ceremonyId: c._id }).select('invitationId');
    const attending = await RsvpModel.find({
      invitationId: { $in: links.map((link) => link.invitationId) },
      status: 'ATTENDING',
      attendingCeremonyIds: c._id,
    }).select('invitationId');
    const invitations = await InvitationModel.find({ _id: { $in: attending.map((row) => row.invitationId) } });
    let sent = 0;
    for (const inv of invitations) {
      try {
        await this.notifications.sendReminder({
          phone: inv.phone,
          guestName: inv.guestName,
          ceremony: c.title,
          when: formatCeremonyTime(c.startsAt, wedding.timezone),
          venue: [c.venueName, c.venueMapsUrl].filter(Boolean).join(' • '),
        });
        sent++;
      } catch (err) {
        this.logger.warn(`Reminder to ${inv.id} failed: ${(err as Error).message}`);
      }
    }
    return { sent, total: invitations.length };
  }
}

const icsDate = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const icsText = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

export function toIcs(
  c: {
    id: string;
    title: string;
    description: string | null;
    startsAt: Date;
    endsAt: Date | null;
    venueName: string;
    venueAddress: string | null;
    venueMapsUrl: string | null;
    streamUrl: string | null;
    dressCode: string | null;
  },
  w: { brideName: string; groomName: string },
): string {
  const end = c.endsAt ?? new Date(c.startsAt.getTime() + 3 * 60 * 60 * 1000);
  const location = [c.venueName, c.venueAddress].filter(Boolean).join(', ');
  const description = [c.description, c.dressCode ? `Dress code: ${c.dressCode}` : null, c.venueMapsUrl, c.streamUrl ? `Live stream: ${c.streamUrl}` : null]
    .filter(Boolean)
    .join('\n');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PlotTheirFuture//Wedding Itinerary//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${c.id}@plottheirfuture.in`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(c.startsAt)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${icsText(`${c.title} • ${w.brideName} & ${w.groomName}`)}`,
    `LOCATION:${icsText(location)}`,
    `DESCRIPTION:${icsText(description)}`,
    ...(c.venueMapsUrl ? [`URL:${c.venueMapsUrl}`] : []),
    'BEGIN:VALARM',
    'TRIGGER:-PT2H',
    'ACTION:DISPLAY',
    `DESCRIPTION:${icsText(c.title)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}
