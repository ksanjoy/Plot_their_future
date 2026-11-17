import { InjectQueue } from '@nestjs/bullmq';
import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { STAFF_ROLES, type WeddingAccess } from '../access/wedding-access.service.js';
import type { Ceremony, Wedding } from '../generated/prisma/client.js';
import { QUEUES } from '../jobs/queues.js';
import { formatCeremonyTime, NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

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
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    @InjectQueue(QUEUES.reminders) private readonly reminders: Queue,
  ) {}

  list(access: WeddingAccess) {
    const staff = STAFF_ROLES.includes(access.role) || access.role === 'PLATFORM';
    return this.prisma.ceremony.findMany({
      where: {
        weddingId: access.wedding.id,
        ...(!staff && access.invitation ? { invitations: { some: { invitationId: access.invitation.id } } } : {}),
      },
      orderBy: [{ startsAt: 'asc' }, { sortOrder: 'asc' }],
    });
  }

  async create(access: WeddingAccess, input: CeremonyInput) {
    const ceremony = await this.prisma.ceremony.create({ data: { ...input, weddingId: access.wedding.id } });
    await this.scheduleReminder(ceremony);
    return ceremony;
  }

  async update(access: WeddingAccess, id: string, input: Partial<CeremonyInput>) {
    await this.find(access.wedding.id, id);
    const ceremony = await this.prisma.ceremony.update({ where: { id }, data: input });
    await this.scheduleReminder(ceremony);
    return ceremony;
  }

  async remove(access: WeddingAccess, id: string) {
    await this.find(access.wedding.id, id);
    await this.prisma.ceremony.delete({ where: { id } });
  }

  async ics(access: WeddingAccess, id: string) {
    const c = await this.find(access.wedding.id, id);
    if (access.role === 'GUEST' && access.invitation) {
      const invited = await this.prisma.invitationCeremony.findUnique({
        where: { invitationId_ceremonyId: { invitationId: access.invitation.id, ceremonyId: id } },
      });
      if (!invited) throw new ForbiddenException('You are not invited to this ceremony');
    }
    return { filename: `${access.wedding.slug}-${c.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.ics`, body: toIcs(c, access.wedding) };
  }

  private async find(weddingId: string, id: string) {
    const c = await this.prisma.ceremony.findFirst({ where: { id, weddingId } });
    if (!c) throw new NotFoundException('Ceremony not found');
    return c;
  }

  /** One delayed job per (ceremony, start time); a rescheduled ceremony gets a fresh job and stale ones no-op. */
  private async scheduleReminder(c: Ceremony) {
    const delay = c.startsAt.getTime() - REMINDER_LEAD_MS - Date.now();
    if (delay <= 0) return;
    await this.reminders.add(
      'ceremony-reminder',
      { ceremonyId: c.id, startsAt: c.startsAt.toISOString() },
      { delay, jobId: `reminder-${c.id}-${c.startsAt.getTime()}` },
    );
  }

  async sendReminders(ceremonyId: string, startsAtIso: string) {
    const c = await this.prisma.ceremony.findUnique({ where: { id: ceremonyId }, include: { wedding: true } });
    if (!c || c.startsAt.toISOString() !== startsAtIso) return { skipped: true };
    const invitations = await this.prisma.invitation.findMany({
      where: {
        weddingId: c.weddingId,
        ceremonies: { some: { ceremonyId } },
        rsvp: { status: 'ATTENDING', attendingCeremonyIds: { has: ceremonyId } },
      },
    });
    let sent = 0;
    for (const inv of invitations) {
      try {
        await this.notifications.sendReminder({
          phone: inv.phone,
          guestName: inv.guestName,
          ceremony: c.title,
          when: formatCeremonyTime(c.startsAt, c.wedding.timezone),
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

export function toIcs(c: Ceremony, w: Wedding): string {
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
