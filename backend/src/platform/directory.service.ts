import { Injectable, NotFoundException } from '@nestjs/common';
import { idString } from '../database/helpers.js';
import {
  AuditLogModel,
  ComplaintModel,
  ContributionModel,
  FlatModel,
  InvitationModel,
  RsvpModel,
  SessionModel,
  UserModel,
  WeddingModel,
} from '../models/schemas.js';

@Injectable()
export class DirectoryService {
  async users(query?: string) {
    const filter = query
      ? { $or: [{ phone: new RegExp(escapeRegExp(query)) }, { name: new RegExp(escapeRegExp(query), 'i') }, { occupation: new RegExp(escapeRegExp(query), 'i') }] }
      : {};
    const rows = await UserModel.find(filter).sort({ createdAt: -1 }).limit(100).select('-passwordHash');
    return rows.map((user) => ({
      id: user.id,
      phone: user.phone,
      name: user.name,
      occupation: user.occupation,
      email: user.email,
      isPlatformAdmin: user.isPlatformAdmin,
      blockedAt: user.blockedAt,
      blockedReason: user.blockedReason,
      messageOptOut: user.messageOptOut,
      createdAt: user.createdAt,
    }));
  }

  async block(actorId: string, userId: string, reason: string) {
    const user = await UserModel.findByIdAndUpdate(userId, { $set: { blockedAt: new Date(), blockedReason: reason } }, { new: true });
    if (!user) throw new NotFoundException('User not found');
    await SessionModel.updateMany({ userId, revokedAt: null }, { $set: { revokedAt: new Date() } });
    await AuditLogModel.create({ actorId, action: 'user.block', entityType: 'user', entityId: userId, meta: { reason } });
    return { id: user.id, blockedAt: user.blockedAt, blockedReason: user.blockedReason };
  }

  async unblock(actorId: string, userId: string) {
    const user = await UserModel.findByIdAndUpdate(userId, { $set: { blockedAt: null, blockedReason: null } }, { new: true });
    if (!user) throw new NotFoundException('User not found');
    await AuditLogModel.create({ actorId, action: 'user.unblock', entityType: 'user', entityId: userId, meta: {} });
    return { id: user.id, blockedAt: user.blockedAt };
  }

  async fileComplaint(userId: string, input: { subject: string; message: string; weddingId?: string | null }) {
    const row = await ComplaintModel.create({
      userId,
      weddingId: input.weddingId ?? null,
      subject: input.subject,
      message: input.message,
    });
    return { id: row.id, status: row.status, createdAt: row.createdAt };
  }

  async complaints(status?: string) {
    const rows = await ComplaintModel.find(status ? { status } : {})
      .sort({ createdAt: -1 })
      .limit(200)
      .populate('user', 'name phone');
    return rows.map((row) => {
      const user = row.get('user') as { name?: string | null; phone?: string } | undefined;
      return {
        id: row.id,
        subject: row.subject,
        message: row.message,
        status: row.status,
        resolution: row.resolution,
        weddingId: row.weddingId ? idString(row.weddingId) : null,
        user: user ? { name: user.name ?? null, phone: user.phone ?? '' } : null,
        createdAt: row.createdAt,
      };
    });
  }

  async resolveComplaint(actorId: string, id: string, input: { status: 'OPEN' | 'IN_REVIEW' | 'RESOLVED'; resolution?: string | null }) {
    const row = await ComplaintModel.findByIdAndUpdate(id, { $set: { status: input.status, resolution: input.resolution ?? null } }, { new: true });
    if (!row) throw new NotFoundException('Complaint not found');
    await AuditLogModel.create({ actorId, action: 'complaint.update', entityType: 'complaint', entityId: id, meta: { status: input.status } });
    return { id: row.id, status: row.status, resolution: row.resolution };
  }

  async gifts(status?: string, q?: string) {
    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;
    if (q) filter.donorName = new RegExp(escapeRegExp(q), 'i');
    const rows = await ContributionModel.find(filter).sort({ createdAt: -1 }).limit(200).populate('wedding', 'slug brideName groomName').populate('room', 'name');
    return rows.map((row) => {
      const wedding = row.get('wedding') as { slug?: string; brideName?: string; groomName?: string } | undefined;
      const room = row.get('room') as { name?: string } | undefined;
      return {
        id: row.id,
        status: row.status,
        donorName: row.donorName,
        units: row.units,
        brickCount: row.brickCount,
        unitKind: row.unitKind,
        amountPaise: row.amountPaise,
        anonymous: row.anonymous,
        hideAmount: row.hideAmount,
        room: room?.name ?? null,
        wedding: wedding ? { slug: wedding.slug, brideName: wedding.brideName, groomName: wedding.groomName } : null,
        paidAt: row.paidAt,
        createdAt: row.createdAt,
      };
    });
  }

  async analytics() {
    const [weddingGroups, giftGroups, invited, responded, flats] = await Promise.all([
      WeddingModel.aggregate<{ _id: string; count: number }>([{ $group: { _id: '$approvalStatus', count: { $sum: 1 } } }]),
      ContributionModel.aggregate<{ _id: string; count: number; amountPaise: number; units: number }>([
        { $group: { _id: '$status', count: { $sum: 1 }, amountPaise: { $sum: '$amountPaise' }, units: { $sum: '$units' } } },
      ]),
      InvitationModel.countDocuments(),
      RsvpModel.countDocuments(),
      FlatModel.aggregate<{ _id: string; count: number }>([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    ]);
    const success = giftGroups.find((row) => row._id === 'SUCCESS');
    const top = await ContributionModel.aggregate<{ _id: string; amountPaise: number; gifts: number }>([
      { $match: { status: 'SUCCESS' } },
      { $group: { _id: '$weddingId', amountPaise: { $sum: '$amountPaise' }, gifts: { $sum: 1 } } },
      { $sort: { amountPaise: -1 } },
      { $limit: 5 },
    ]);
    const weddings = await WeddingModel.find({ _id: { $in: top.map((row) => row._id) } }).select('slug brideName groomName flatId');
    const byId = new Map(weddings.map((wedding) => [wedding.id, wedding]));
    return {
      weddings: Object.fromEntries(weddingGroups.map((row) => [row._id ?? 'APPROVED', row.count])),
      flats: Object.fromEntries(flats.map((row) => [row._id, row.count])),
      gifts: {
        byStatus: Object.fromEntries(giftGroups.map((row) => [row._id, row.count])),
        revenuePaise: success?.amountPaise ?? 0,
        giftedSft: success?.units ?? 0,
      },
      conversion: {
        invitations: invited,
        rsvps: responded,
        gifts: success?.count ?? 0,
        linkToRsvp: invited ? responded / invited : 0,
        rsvpToGift: responded ? (success?.count ?? 0) / responded : 0,
      },
      topWeddings: top.map((row) => {
        const wedding = byId.get(idString(row._id));
        return {
          slug: wedding?.slug ?? null,
          couple: wedding ? `${wedding.brideName} & ${wedding.groomName}` : null,
          amountPaise: row.amountPaise,
          gifts: row.gifts,
        };
      }),
    };
  }

  async audit() {
    const rows = await AuditLogModel.find().sort({ createdAt: -1 }).limit(200);
    return rows.map((row) => ({
      id: row.id,
      actorId: row.actorId ? idString(row.actorId) : null,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      meta: row.meta,
      createdAt: row.createdAt,
    }));
  }
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
