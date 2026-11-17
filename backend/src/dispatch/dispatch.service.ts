import { InjectQueue } from '@nestjs/bullmq';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Queue } from 'bullmq';
import type { WeddingAccess } from '../access/wedding-access.service.js';
import type { GuestCohort, Prisma } from '../generated/prisma/client.js';
import { GuestsService } from '../guests/guests.service.js';
import { QUEUES } from '../jobs/queues.js';
import { formatCeremonyTime, NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RealtimeService, rooms } from '../realtime/realtime.service.js';

export interface DispatchInput {
  ceremonyIds?: string[];
  cohorts?: GuestCohort[];
  invitationIds?: string[];
  includeRegistry: boolean;
  onlyPendingRsvp?: boolean;
}

@Injectable()
export class DispatchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly guests: GuestsService,
    private readonly notifications: NotificationsService,
    private readonly realtime: RealtimeService,
    @InjectQueue(QUEUES.dispatch) private readonly queue: Queue,
  ) {}

  private audience(access: WeddingAccess, input: DispatchInput): Prisma.InvitationWhereInput {
    return {
      weddingId: access.wedding.id,
      ...(access.role === 'LEAD' ? { refLead: access.member?.label ?? '__none__' } : {}),
      ...(input.cohorts?.length ? { cohort: { in: input.cohorts } } : {}),
      ...(input.ceremonyIds?.length ? { ceremonies: { some: { ceremonyId: { in: input.ceremonyIds } } } } : {}),
      ...(input.invitationIds?.length ? { id: { in: input.invitationIds } } : {}),
      ...(input.onlyPendingRsvp ? { rsvp: { is: null } } : {}),
    };
  }

  /** Recipient count for the admin's current filter selection, before sending. */
  async preview(access: WeddingAccess, input: DispatchInput) {
    const count = await this.prisma.invitation.count({ where: this.audience(access, input) });
    return { recipients: count };
  }

  async create(access: WeddingAccess, input: DispatchInput) {
    if (input.ceremonyIds?.length) {
      const n = await this.prisma.ceremony.count({ where: { weddingId: access.wedding.id, id: { in: input.ceremonyIds } } });
      if (n !== new Set(input.ceremonyIds).size) throw new BadRequestException('One or more ceremonies do not belong to this wedding');
    }
    const recipients = await this.prisma.invitation.findMany({ where: this.audience(access, input), select: { id: true } });
    if (!recipients.length) throw new BadRequestException({ code: 'NO_RECIPIENTS', message: 'No guests match this selection' });

    const dispatch = await this.prisma.dispatch.create({
      data: {
        weddingId: access.wedding.id,
        createdById: access.user.id,
        ceremonyIds: input.ceremonyIds ?? [],
        cohorts: input.cohorts ?? [],
        refLead: access.role === 'LEAD' ? access.member?.label ?? null : null,
        includeRegistry: input.includeRegistry,
        total: recipients.length,
        messages: { create: recipients.map((r) => ({ invitationId: r.id })) },
      },
      include: { messages: { select: { id: true } } },
    });
    await this.queue.addBulk(
      dispatch.messages.map((m) => ({ name: 'send-invite', data: { messageId: m.id }, opts: { jobId: `dm-${m.id}` } })),
    );
    return this.summary(dispatch.id);
  }

  async list(access: WeddingAccess) {
    const dispatches = await this.prisma.dispatch.findMany({
      where: { weddingId: access.wedding.id, ...(access.role === 'LEAD' ? { refLead: access.member?.label ?? '__none__' } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true },
    });
    return Promise.all(dispatches.map((d) => this.summary(d.id)));
  }

  async detail(access: WeddingAccess, id: string) {
    const d = await this.prisma.dispatch.findFirst({ where: { id, weddingId: access.wedding.id } });
    if (!d || (access.role === 'LEAD' && d.refLead !== access.member?.label)) throw new NotFoundException('Dispatch not found');
    const messages = await this.prisma.dispatchMessage.findMany({
      where: { dispatchId: id },
      include: { invitation: { select: { guestName: true, phone: true } } },
      orderBy: { invitation: { guestName: 'asc' } },
    });
    return {
      ...(await this.summary(id)),
      messages: messages.map((m) => ({
        id: m.id,
        guestName: m.invitation.guestName,
        phone: m.invitation.phone,
        status: m.status,
        error: m.error,
        sentAt: m.sentAt,
      })),
    };
  }

  async summary(id: string) {
    const d = await this.prisma.dispatch.findUniqueOrThrow({ where: { id } });
    const grouped = await this.prisma.dispatchMessage.groupBy({ by: ['status'], where: { dispatchId: id }, _count: true });
    const counts = { QUEUED: 0, SENT: 0, FAILED: 0, SKIPPED: 0 };
    for (const g of grouped) counts[g.status] = g._count;
    return {
      id: d.id,
      createdAt: d.createdAt,
      ceremonyIds: d.ceremonyIds,
      cohorts: d.cohorts,
      refLead: d.refLead,
      includeRegistry: d.includeRegistry,
      total: d.total,
      queued: counts.QUEUED,
      sent: counts.SENT,
      failed: counts.FAILED,
      skipped: counts.SKIPPED,
    };
  }

  /** Worker side: send one invitation. Throws on transient failure so BullMQ retries. */
  async deliver(messageId: string, finalAttempt: boolean) {
    const m = await this.prisma.dispatchMessage.findUnique({
      where: { id: messageId },
      include: {
        dispatch: { include: { wedding: true } },
        invitation: { include: { ceremonies: { include: { ceremony: true } } } },
      },
    });
    if (!m || m.status === 'SENT') return;
    const { wedding } = m.dispatch;
    const inv = m.invitation;

    const ceremonies = inv.ceremonies
      .map((ic) => ic.ceremony)
      .filter((c) => !m.dispatch.ceremonyIds.length || m.dispatch.ceremonyIds.includes(c.id))
      .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
      .map((c) => `${c.title} (${formatCeremonyTime(c.startsAt, wedding.timezone)})`);

    try {
      const res = await this.notifications.sendInvite({
        phone: inv.phone,
        guestName: inv.guestName,
        couple: `${wedding.brideName} & ${wedding.groomName}`,
        ceremonies: ceremonies.join(', ') || 'Wedding celebrations',
        includeRegistry: m.dispatch.includeRegistry && inv.enableRegistry,
        link: this.guests.inviteLink(wedding, inv),
      });
      await this.prisma.dispatchMessage.update({
        where: { id: messageId },
        data: { status: 'SENT', sentAt: new Date(), providerMessageId: res.providerMessageId ?? null, error: null },
      });
    } catch (err) {
      const message = (err as Error).message.slice(0, 500);
      await this.prisma.dispatchMessage.update({
        where: { id: messageId },
        data: { status: finalAttempt ? 'FAILED' : 'QUEUED', error: message },
      });
      if (!finalAttempt) throw err;
    } finally {
      this.realtime.emit(rooms.admin(wedding.id), 'dispatch.progress', await this.summary(m.dispatchId));
    }
  }
}
