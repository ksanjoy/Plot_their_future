import { InjectQueue } from '@nestjs/bullmq';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Queue } from 'bullmq';
import type { FilterQuery } from 'mongoose';
import type { WeddingAccess } from '../access/wedding-access.service.js';
import { idString, idStrings } from '../database/helpers.js';
import { GuestsService } from '../guests/guests.service.js';
import { QUEUES } from '../jobs/queues.js';
import {
  CeremonyModel,
  DispatchMessageModel,
  DispatchModel,
  InvitationCeremonyModel,
  InvitationModel,
  RsvpModel,
  type CeremonyDoc,
  type WeddingDoc,
} from '../models/schemas.js';
import type { GuestCohort, Invitation } from '../models/types.js';
import { formatCeremonyTime, NotificationsService } from '../notifications/notifications.service.js';
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
    private readonly guests: GuestsService,
    private readonly notifications: NotificationsService,
    private readonly realtime: RealtimeService,
    @InjectQueue(QUEUES.dispatch) private readonly queue: Queue,
  ) {}

  private async audience(access: WeddingAccess, input: DispatchInput): Promise<FilterQuery<Invitation>> {
    const filter: FilterQuery<Invitation> = { weddingId: access.wedding._id };
    if (access.role === 'LEAD') filter.refLead = access.member?.label ?? '__none__';
    if (input.cohorts?.length) filter.cohort = { $in: input.cohorts };
    let ids: string[] | null = input.invitationIds?.length ? [...input.invitationIds] : null;
    if (input.ceremonyIds?.length) {
      const links = await InvitationCeremonyModel.find({ ceremonyId: { $in: input.ceremonyIds } }).select('invitationId');
      const allowed = new Set(links.map((link) => idString(link.invitationId)));
      ids = (ids ?? [...allowed]).filter((id) => allowed.has(id));
    }
    if (input.onlyPendingRsvp) {
      const responded = await RsvpModel.find({ weddingId: access.wedding._id }).select('invitationId');
      const taken = new Set(responded.map((row) => idString(row.invitationId)));
      if (ids) ids = ids.filter((id) => !taken.has(id));
      else filter._id = { $nin: [...taken] };
    }
    if (ids) filter._id = { $in: ids };
    return filter;
  }

  async preview(access: WeddingAccess, input: DispatchInput) {
    const count = await InvitationModel.countDocuments(await this.audience(access, input));
    return { recipients: count };
  }

  async create(access: WeddingAccess, input: DispatchInput) {
    if (input.ceremonyIds?.length) {
      const n = await CeremonyModel.countDocuments({ weddingId: access.wedding._id, _id: { $in: input.ceremonyIds } });
      if (n !== new Set(input.ceremonyIds).size) throw new BadRequestException('One or more ceremonies do not belong to this wedding');
    }
    const recipients = await InvitationModel.find(await this.audience(access, input)).select('_id');
    if (!recipients.length) throw new BadRequestException({ code: 'NO_RECIPIENTS', message: 'No guests match this selection' });

    const dispatch = await DispatchModel.create({
      weddingId: access.wedding._id,
      createdById: access.user.id,
      ceremonyIds: input.ceremonyIds ?? [],
      cohorts: input.cohorts ?? [],
      refLead: access.role === 'LEAD' ? access.member?.label ?? null : null,
      includeRegistry: input.includeRegistry,
      total: recipients.length,
    });
    await DispatchMessageModel.insertMany(recipients.map((r) => ({ dispatchId: dispatch._id, invitationId: r._id })));
    const messages = await DispatchMessageModel.find({ dispatchId: dispatch._id }).select('_id');
    await this.queue.addBulk(messages.map((m) => ({ name: 'send-invite', data: { messageId: m.id }, opts: { jobId: `dm-${m.id}` } })));
    return this.summary(dispatch.id);
  }

  async list(access: WeddingAccess) {
    const dispatches = await DispatchModel.find({
      weddingId: access.wedding._id,
      ...(access.role === 'LEAD' ? { refLead: access.member?.label ?? '__none__' } : {}),
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .select('_id');
    return Promise.all(dispatches.map((d) => this.summary(d.id)));
  }

  async detail(access: WeddingAccess, id: string) {
    const d = await DispatchModel.findOne({ _id: id, weddingId: access.wedding._id });
    if (!d || (access.role === 'LEAD' && d.refLead !== access.member?.label)) throw new NotFoundException('Dispatch not found');
    const messages = await DispatchMessageModel.find({ dispatchId: id }).populate<{ invitation: { guestName: string; phone: string } }>('invitation', 'guestName phone');
    messages.sort((a, b) => {
      const left = (a.get('invitation') as { guestName: string }).guestName;
      const right = (b.get('invitation') as { guestName: string }).guestName;
      return left.localeCompare(right);
    });
    return {
      ...(await this.summary(id)),
      messages: messages.map((m) => {
        const invitation = m.get('invitation') as { guestName: string; phone: string };
        return {
          id: m.id,
          guestName: invitation.guestName,
          phone: invitation.phone,
          status: m.status,
          error: m.error,
          sentAt: m.sentAt,
        };
      }),
    };
  }

  async summary(id: string) {
    const d = await DispatchModel.findById(id);
    if (!d) throw new NotFoundException('Dispatch not found');
    const grouped = await DispatchMessageModel.aggregate<{ _id: 'QUEUED' | 'SENT' | 'FAILED' | 'SKIPPED'; count: number }>([
      { $match: { dispatchId: d._id } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    const counts = { QUEUED: 0, SENT: 0, FAILED: 0, SKIPPED: 0 };
    for (const g of grouped) counts[g._id] = g.count;
    return {
      id: d.id,
      createdAt: d.createdAt,
      ceremonyIds: idStrings(d.ceremonyIds),
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
    const m = await DispatchMessageModel.findById(messageId);
    if (!m || m.status === 'SENT') return;
    const dispatch = await DispatchModel.findById(m.dispatchId).populate<{ wedding: WeddingDoc }>('wedding');
    const invitation = await InvitationModel.findById(m.invitationId);
    if (!dispatch || !invitation) return;
    const wedding = dispatch.get('wedding') as WeddingDoc;
    const links = await InvitationCeremonyModel.find({ invitationId: invitation._id }).populate<{ ceremony: CeremonyDoc }>('ceremony');
    const selected = new Set(idStrings(dispatch.ceremonyIds));
    const ceremonies = links
      .map((link) => link.get('ceremony') as CeremonyDoc)
      .filter((c) => !selected.size || selected.has(c.id))
      .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
      .map((c) => `${c.title} (${formatCeremonyTime(c.startsAt, wedding.timezone)})`);

    try {
      const res = await this.notifications.sendInvite({
        phone: invitation.phone,
        guestName: invitation.guestName,
        couple: `${wedding.brideName} & ${wedding.groomName}`,
        ceremonies: ceremonies.join(', ') || 'Wedding celebrations',
        includeRegistry: dispatch.includeRegistry && invitation.enableRegistry,
        link: this.guests.inviteLink(wedding, invitation),
      });
      await DispatchMessageModel.updateOne(
        { _id: messageId },
        { $set: { status: 'SENT', sentAt: new Date(), providerMessageId: res.providerMessageId ?? null, error: null } },
      );
    } catch (err) {
      const message = (err as Error).message.slice(0, 500);
      await DispatchMessageModel.updateOne(
        { _id: messageId },
        { $set: { status: finalAttempt ? 'FAILED' : 'QUEUED', error: message } },
      );
      if (!finalAttempt) throw err;
    } finally {
      this.realtime.emit(rooms.admin(wedding.id), 'dispatch.progress', await this.summary(idString(m.dispatchId)));
    }
  }
}
