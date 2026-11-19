import type { ClientSession } from 'mongoose';
import { oid } from '../database/helpers.js';
import {
  ApprovalModel,
  BlessingModel,
  BrickAllocationModel,
  CeremonyModel,
  ContributionModel,
  DispatchMessageModel,
  DispatchModel,
  FloorTileModel,
  InvitationCeremonyModel,
  InvitationModel,
  LedgerEntryModel,
  RsvpModel,
  RoomZoneModel,
  SessionModel,
  SettlementModel,
  WeddingMemberModel,
  WeddingModel,
} from './schemas.js';

function opts(session?: ClientSession) {
  return session ? { session } : {};
}

/** Prisma `onDelete: Cascade` for an invitation: join rows, RSVP, and dispatch messages. */
export async function deleteInvitationCascade(invitationId: string, session?: ClientSession) {
  const id = oid(invitationId);
  const opt = opts(session);
  await InvitationCeremonyModel.deleteMany({ invitationId: id }, opt);
  await RsvpModel.deleteMany({ invitationId: id }, opt);
  await DispatchMessageModel.deleteMany({ invitationId: id }, opt);
  await InvitationModel.deleteOne({ _id: id }, opt);
}

/** Prisma `onDelete: Cascade` from ceremony to invitation-ceremony links. */
export async function deleteCeremonyCascade(ceremonyId: string, session?: ClientSession) {
  const id = oid(ceremonyId);
  const opt = opts(session);
  await InvitationCeremonyModel.deleteMany({ ceremonyId: id }, opt);
  await CeremonyModel.deleteOne({ _id: id }, opt);
}

/**
 * Prisma wedding cascade. Contribution → room was `onDelete: Restrict`; callers
 * must refuse this when contributions exist if they are only replacing rooms.
 * Deleting the wedding itself removes contributions first, which matches
 * `onDelete: Cascade` from wedding → contribution.
 */
export async function deleteWeddingCascade(weddingId: string, session?: ClientSession) {
  const id = oid(weddingId);
  const opt = opts(session);
  const [invitations, dispatches] = await Promise.all([
    InvitationModel.find({ weddingId: id }).select('_id').session(session ?? null),
    DispatchModel.find({ weddingId: id }).select('_id').session(session ?? null),
  ]);
  const invitationIds = invitations.map((row) => row._id);
  const dispatchIds = dispatches.map((row) => row._id);
  await DispatchMessageModel.deleteMany(
    { $or: [{ dispatchId: { $in: dispatchIds } }, { invitationId: { $in: invitationIds } }] },
    opt,
  );
  await InvitationCeremonyModel.deleteMany({ invitationId: { $in: invitationIds } }, opt);
  await RsvpModel.deleteMany({ weddingId: id }, opt);
  await InvitationModel.deleteMany({ weddingId: id }, opt);
  await BrickAllocationModel.deleteMany({ weddingId: id }, opt);
  await ApprovalModel.deleteMany({ weddingId: id }, opt);
  await FloorTileModel.deleteMany({ weddingId: id }, opt);
  await LedgerEntryModel.deleteMany({ weddingId: id }, opt);
  await ContributionModel.deleteMany({ weddingId: id }, opt);
  await RoomZoneModel.deleteMany({ weddingId: id }, opt);
  await SettlementModel.deleteMany({ weddingId: id }, opt);
  await BlessingModel.deleteMany({ weddingId: id }, opt);
  await DispatchModel.deleteMany({ weddingId: id }, opt);
  await CeremonyModel.deleteMany({ weddingId: id }, opt);
  await WeddingMemberModel.deleteMany({ weddingId: id }, opt);
  await WeddingModel.deleteOne({ _id: id }, opt);
}

/**
 * Prisma user cascade: sessions and memberships are removed; invitation,
 * contribution, and blessing user links are set null. No API deletes users;
 * the seed and a future admin path can call this.
 */
export async function deleteUserCascade(userId: string, session?: ClientSession) {
  const id = oid(userId);
  const opt = opts(session);
  await SessionModel.deleteMany({ userId: id }, opt);
  await WeddingMemberModel.deleteMany({ userId: id }, opt);
  await InvitationModel.updateMany({ userId: id }, { $set: { userId: null } }, opt);
  await ContributionModel.updateMany({ userId: id }, { $set: { userId: null } }, opt);
  await BlessingModel.updateMany({ userId: id }, { $set: { userId: null } }, opt);
}
