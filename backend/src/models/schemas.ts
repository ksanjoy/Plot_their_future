import mongoose, { Schema, Types } from 'mongoose';
import type { Collection, Doc } from './collection.js';
import {
  APPROVAL_STATUSES,
  CONTRIBUTION_STATUSES,
  DELIVERY_STATUSES,
  FLAT_STATUSES,
  GIFT_UNIT_KINDS,
  GUEST_COHORTS,
  KYC_STATUSES,
  LEDGER_TYPES,
  LINK_VISIBILITIES,
  MEMBER_ROLES,
  MODERATION_STATUSES,
  RSVP_STATUSES,
  SETTLEMENT_DESTINATIONS,
  SETTLEMENT_STATUSES,
  STAGE_DISPLAY_MODES,
  TILE_STATUSES,
  type Approval,
  type AuditLog,
  type Blessing,
  type BrickAllocation,
  type Ceremony,
  type Complaint,
  type Contribution,
  type DeviceToken,
  type Dispatch,
  type DispatchMessage,
  type Flat,
  type FlatArea,
  type FloorTile,
  type InAppNotification,
  type Invitation,
  type InvitationCeremony,
  type LedgerEntry,
  type NotificationLog,
  type PaymentEvent,
  type PlatformContent,
  type RoomZone,
  type Rsvp,
  type Session,
  type Settlement,
  type User,
  type Wedding,
  type WeddingMember,
} from './types.js';

const nullableString = { type: String, default: null } as const;

function ref(model: string, required = true) {
  return required
    ? { type: Schema.Types.ObjectId, ref: model, required: true as const }
    : { type: Schema.Types.ObjectId, ref: model, default: null };
}

function normalize(value: unknown): unknown {
  if (value instanceof Types.ObjectId) return value.toHexString();
  if (value instanceof Date || value == null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((item) => normalize(item));
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (key === '__v') continue;
    if (key === '_id') {
      out.id = normalize(child);
      continue;
    }
    out[key] = normalize(child);
  }
  return out;
}

function applyJson(schema: Schema) {
  const options = {
    versionKey: false as const,
    virtuals: false as const,
    transform(_doc: unknown, ret: Record<string, unknown>) {
      return normalize(ret);
    },
  };
  schema.set('toJSON', options);
  schema.set('toObject', { ...options, virtuals: true });
}

/**
 * Builds a schema without asking TypeScript to infer Mongoose's generic
 * `SchemaDefinition`. That inference exhausts the checker on this file.
 */
function define(definition: object, options?: object): Schema {
  const Factory = Schema as unknown as new (definition: object, options?: object) => Schema;
  return new Factory(definition, options);
}

const createModel = mongoose.model as unknown as (name: string, schema: Schema, collection: string) => unknown;

function register<T>(name: string, schema: Schema, collection: string): Collection<T> {
  applyJson(schema);
  const existing = mongoose.models[name];
  const model = existing ?? createModel(name, schema, collection);
  return model as unknown as Collection<T>;
}

const timestamps = { createdAt: 'createdAt', updatedAt: 'updatedAt' } as const;
const createdOnly = { createdAt: 'createdAt', updatedAt: false } as const;

const UserSchema: Schema = define(
  {
    phone: { type: String, required: true, unique: true },
    name: nullableString,
    email: nullableString,
    occupation: nullableString,
    passwordHash: nullableString,
    isPlatformAdmin: { type: Boolean, default: false },
    blockedAt: { type: Date, default: null },
    blockedReason: nullableString,
    messageOptOut: { type: Boolean, default: false },
    locale: { type: String, default: 'en' },
    deletedAt: { type: Date, default: null },
  },
  { timestamps, collection: 'users' },
);

const SessionSchema: Schema = define(
  {
    userId: ref('User'),
    refreshTokenHash: { type: String, required: true, unique: true },
    userAgent: nullableString,
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: createdOnly, collection: 'sessions' },
);
SessionSchema.index({ userId: 1 });
SessionSchema.virtual('user', { ref: 'User', localField: 'userId', foreignField: '_id', justOne: true });

const WeddingSchema: Schema = define(
  {
    slug: { type: String, required: true, unique: true },
    brideName: { type: String, required: true },
    groomName: { type: String, required: true },
    welcomeNote: nullableString,
    videoInviteUrl: nullableString,
    coverPhotoUrl: nullableString,
    city: nullableString,
    weddingDate: { type: Date, default: null },
    timezone: { type: String, default: 'Asia/Kolkata' },
    propertyName: nullableString,
    propertyLocation: nullableString,
    totalSft: { type: Number, required: true },
    ratePerSftPaise: { type: Number, required: true },
    presetTiers: { type: [Number], default: () => [1, 5, 10] },
    cartHoldTtlSec: { type: Number, default: 600 },
    reraRegId: nullableString,
    escrowBankName: nullableString,
    escrowAccountNumber: nullableString,
    escrowIfsc: nullableString,
    taxExemptionEnabled: { type: Boolean, default: true },
    stageDisplayMode: { type: String, enum: STAGE_DISPLAY_MODES, default: 'NAMES_AND_BLESSINGS' },
    approvalStatus: { type: String, enum: APPROVAL_STATUSES, default: 'APPROVED' },
    approvalNote: nullableString,
    contactMobile: nullableString,
    cardImageUrl: nullableString,
    flatId: ref('Flat', false),
    linkVisibility: { type: String, enum: LINK_VISIBILITIES, default: 'PUBLIC' },
    brickRatio: { type: Number, default: 10 },
    minGiftPaise: { type: Number, default: 0 },
    targetAmountPaise: { type: Number, default: null },
    hideAmountsFromGuests: { type: Boolean, default: false },
    kycStatus: { type: String, enum: KYC_STATUSES, default: 'NOT_REQUIRED' },
    kycLegalName: nullableString,
    kycIdLast4: nullableString,
    kycNote: nullableString,
  },
  { timestamps, collection: 'weddings' },
);
WeddingSchema.index({ weddingDate: 1, createdAt: -1 });

const WeddingMemberSchema: Schema = define(
  {
    weddingId: ref('Wedding'),
    userId: ref('User'),
    role: { type: String, enum: MEMBER_ROLES, required: true },
    label: nullableString,
  },
  { timestamps: createdOnly, collection: 'wedding_members' },
);
WeddingMemberSchema.index({ weddingId: 1, userId: 1 }, { unique: true });
WeddingMemberSchema.index({ userId: 1 });
WeddingMemberSchema.virtual('wedding', { ref: 'Wedding', localField: 'weddingId', foreignField: '_id', justOne: true });
WeddingMemberSchema.virtual('user', { ref: 'User', localField: 'userId', foreignField: '_id', justOne: true });

const CeremonySchema: Schema = define(
  {
    weddingId: ref('Wedding'),
    title: { type: String, required: true },
    description: nullableString,
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, default: null },
    venueName: { type: String, required: true },
    venueAddress: nullableString,
    venueMapsUrl: nullableString,
    streamUrl: nullableString,
    dressCode: nullableString,
    coverImageUrl: nullableString,
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps, collection: 'ceremonies' },
);
CeremonySchema.index({ weddingId: 1, startsAt: 1 });
CeremonySchema.virtual('wedding', { ref: 'Wedding', localField: 'weddingId', foreignField: '_id', justOne: true });

const InvitationSchema: Schema = define(
  {
    weddingId: ref('Wedding'),
    guestName: { type: String, required: true },
    phone: { type: String, required: true },
    email: nullableString,
    cohort: { type: String, enum: GUEST_COHORTS, default: 'FAMILY' },
    maxAttendees: { type: Number, default: 2 },
    enableRegistry: { type: Boolean, default: true },
    refToken: { type: String, required: true, unique: true },
    refLead: nullableString,
    userId: ref('User', false),
    occupation: nullableString,
    messageOptOut: { type: Boolean, default: false },
    lastPromoAt: { type: Date, default: null },
  },
  { timestamps, collection: 'invitations' },
);
InvitationSchema.index({ weddingId: 1, phone: 1 }, { unique: true });
InvitationSchema.index({ phone: 1 });
InvitationSchema.index({ weddingId: 1, guestName: 1 });
InvitationSchema.index({ userId: 1 });
InvitationSchema.virtual('wedding', { ref: 'Wedding', localField: 'weddingId', foreignField: '_id', justOne: true });
InvitationSchema.virtual('user', { ref: 'User', localField: 'userId', foreignField: '_id', justOne: true });
InvitationSchema.virtual('ceremonies', { ref: 'InvitationCeremony', localField: '_id', foreignField: 'invitationId' });
InvitationSchema.virtual('rsvp', { ref: 'Rsvp', localField: '_id', foreignField: 'invitationId', justOne: true });

const InvitationCeremonySchema: Schema = define(
  {
    invitationId: ref('Invitation'),
    ceremonyId: ref('Ceremony'),
  },
  { collection: 'invitation_ceremonies', versionKey: false },
);
InvitationCeremonySchema.index({ invitationId: 1, ceremonyId: 1 }, { unique: true });
InvitationCeremonySchema.index({ ceremonyId: 1 });
InvitationCeremonySchema.virtual('invitation', { ref: 'Invitation', localField: 'invitationId', foreignField: '_id', justOne: true });
InvitationCeremonySchema.virtual('ceremony', { ref: 'Ceremony', localField: 'ceremonyId', foreignField: '_id', justOne: true });

const RsvpSchema: Schema = define(
  {
    weddingId: ref('Wedding'),
    invitationId: { ...ref('Invitation'), unique: true },
    status: { type: String, enum: RSVP_STATUSES, required: true },
    adults: { type: Number, default: 1 },
    children: { type: Number, default: 0 },
    infants: { type: Number, default: 0 },
    attendingCeremonyIds: { type: [Schema.Types.ObjectId], ref: 'Ceremony', default: [] },
    dietary: { type: [String], default: [] },
    allergies: nullableString,
    arrivalMode: nullableString,
    arrivalDetails: nullableString,
    arrivalAt: { type: Date, default: null },
    needsAccommodation: { type: Boolean, default: false },
    checkInDate: { type: Date, default: null },
    checkOutDate: { type: Date, default: null },
    needsShuttle: { type: Boolean, default: false },
    note: nullableString,
    accommodationRooms: { type: Number, default: 0 },
    accommodationGuests: { type: Number, default: 0 },
    foodPreference: nullableString,
    ceremonyResponses: {
      type: [
        {
          ceremonyId: { type: Schema.Types.ObjectId, ref: 'Ceremony' },
          status: { type: String, enum: RSVP_STATUSES, required: true },
          adults: { type: Number, default: 0 },
          children: { type: Number, default: 0 },
        },
      ],
      default: [],
    },
  },
  { timestamps, collection: 'rsvps' },
);
RsvpSchema.index({ weddingId: 1, status: 1 });
RsvpSchema.virtual('invitation', { ref: 'Invitation', localField: 'invitationId', foreignField: '_id', justOne: true });
RsvpSchema.virtual('wedding', { ref: 'Wedding', localField: 'weddingId', foreignField: '_id', justOne: true });

export const ROOM_ZONES = 'room_zones';
const RoomZoneSchema: Schema = define(
  {
    weddingId: ref('Wedding'),
    key: { type: String, required: true },
    name: { type: String, required: true },
    description: nullableString,
    icon: nullableString,
    sft: { type: Number, required: true },
    sortOrder: { type: Number, default: 0 },
  },
  { collection: ROOM_ZONES, versionKey: false },
);
RoomZoneSchema.index({ weddingId: 1, key: 1 }, { unique: true });
RoomZoneSchema.index({ weddingId: 1, sortOrder: 1 });
RoomZoneSchema.virtual('wedding', { ref: 'Wedding', localField: 'weddingId', foreignField: '_id', justOne: true });

export const FLOOR_TILES = 'floor_tiles';
const FloorTileSchema: Schema = define(
  {
    weddingId: ref('Wedding'),
    roomId: ref('RoomZone'),
    index: { type: Number, required: true },
    status: { type: String, enum: TILE_STATUSES, default: 'OPEN' },
    lockedUntil: { type: Date, default: null },
    contributionId: ref('Contribution', false),
    fundedBricks: { type: Number, default: 0 },
    heldBricks: { type: Number, default: 0 },
  },
  { collection: FLOOR_TILES, versionKey: false },
);
FloorTileSchema.index({ weddingId: 1, index: 1 }, { unique: true });
FloorTileSchema.index({ weddingId: 1, status: 1 });
FloorTileSchema.index({ roomId: 1, status: 1, index: 1 });
FloorTileSchema.index({ contributionId: 1 });
FloorTileSchema.index({ status: 1, lockedUntil: 1 });
FloorTileSchema.virtual('room', { ref: 'RoomZone', localField: 'roomId', foreignField: '_id', justOne: true });
FloorTileSchema.virtual('contribution', { ref: 'Contribution', localField: 'contributionId', foreignField: '_id', justOne: true });
FloorTileSchema.virtual('wedding', { ref: 'Wedding', localField: 'weddingId', foreignField: '_id', justOne: true });

const ContributionSchema: Schema = define(
  {
    weddingId: ref('Wedding'),
    userId: ref('User', false),
    roomId: ref('RoomZone'),
    units: { type: Number, required: true },
    ratePaise: { type: Number, required: true },
    amountPaise: { type: Number, required: true },
    donorName: { type: String, required: true },
    donorPhone: nullableString,
    relationship: nullableString,
    blessing: nullableString,
    anonymous: { type: Boolean, default: false },
    hideAmount: { type: Boolean, default: false },
    unitKind: { type: String, enum: GIFT_UNIT_KINDS, default: 'SQFT' },
    brickCount: { type: Number, default: 0 },
    photoKey: nullableString,
    tableNumber: nullableString,
    refLead: nullableString,
    status: { type: String, enum: CONTRIBUTION_STATUSES, default: 'PENDING' },
    provider: { type: String, required: true },
    providerOrderId: nullableString,
    providerPaymentId: nullableString,
    holdExpiresAt: { type: Date, required: true },
    paidAt: { type: Date, default: null },
    failureReason: nullableString,
    receiptNumber: nullableString,
    receiptHash: nullableString,
    receiptSignature: nullableString,
  },
  { timestamps, collection: 'contributions' },
);
ContributionSchema.index({ weddingId: 1, status: 1 });
ContributionSchema.index({ userId: 1, weddingId: 1, status: 1 });
ContributionSchema.index({ status: 1, holdExpiresAt: 1 });
ContributionSchema.index(
  { providerOrderId: 1 },
  { unique: true, partialFilterExpression: { providerOrderId: { $type: 'string' } } },
);
ContributionSchema.index(
  { receiptNumber: 1 },
  { unique: true, partialFilterExpression: { receiptNumber: { $type: 'string' } } },
);
ContributionSchema.virtual('room', { ref: 'RoomZone', localField: 'roomId', foreignField: '_id', justOne: true });
ContributionSchema.virtual('wedding', { ref: 'Wedding', localField: 'weddingId', foreignField: '_id', justOne: true });
ContributionSchema.virtual('user', { ref: 'User', localField: 'userId', foreignField: '_id', justOne: true });
ContributionSchema.virtual('tiles', { ref: 'FloorTile', localField: '_id', foreignField: 'contributionId' });

const LedgerEntrySchema: Schema = define(
  {
    weddingId: ref('Wedding'),
    contributionId: ref('Contribution', false),
    settlementId: ref('Settlement', false),
    type: { type: String, enum: LEDGER_TYPES, required: true },
    amountPaise: { type: Number, required: true },
    reference: { type: String, required: true },
  },
  { timestamps: createdOnly, collection: 'ledger_entries' },
);
LedgerEntrySchema.index({ weddingId: 1, createdAt: -1 });
LedgerEntrySchema.index({ contributionId: 1 });
LedgerEntrySchema.virtual('contribution', { ref: 'Contribution', localField: 'contributionId', foreignField: '_id', justOne: true });
LedgerEntrySchema.virtual('settlement', { ref: 'Settlement', localField: 'settlementId', foreignField: '_id', justOne: true });
LedgerEntrySchema.virtual('wedding', { ref: 'Wedding', localField: 'weddingId', foreignField: '_id', justOne: true });

const SettlementSchema: Schema = define(
  {
    weddingId: ref('Wedding'),
    amountPaise: { type: Number, required: true },
    destination: { type: String, enum: SETTLEMENT_DESTINATIONS, required: true },
    beneficiaryName: { type: String, required: true },
    accountNumber: { type: String, required: true },
    ifsc: { type: String, required: true },
    status: { type: String, enum: SETTLEMENT_STATUSES, default: 'REQUESTED' },
    requestedById: ref('User'),
    hostApprovedById: ref('User', false),
    hostApprovedAt: { type: Date, default: null },
    hostSignature: nullableString,
    complianceApprovedById: ref('User', false),
    complianceApprovedAt: { type: Date, default: null },
    complianceSignature: nullableString,
    rejectedReason: nullableString,
    bankReference: nullableString,
    disbursedAt: { type: Date, default: null },
  },
  { timestamps, collection: 'settlements' },
);
SettlementSchema.index({ weddingId: 1, status: 1 });
SettlementSchema.index({ status: 1, createdAt: -1 });
SettlementSchema.virtual('wedding', { ref: 'Wedding', localField: 'weddingId', foreignField: '_id', justOne: true });

const BlessingSchema: Schema = define(
  {
    weddingId: ref('Wedding'),
    userId: ref('User', false),
    authorName: { type: String, required: true },
    message: nullableString,
    photoKey: nullableString,
    tableNumber: nullableString,
    status: { type: String, enum: MODERATION_STATUSES, default: 'PENDING' },
  },
  { timestamps: createdOnly, collection: 'blessings' },
);
BlessingSchema.index({ weddingId: 1, status: 1, createdAt: -1 });
BlessingSchema.virtual('user', { ref: 'User', localField: 'userId', foreignField: '_id', justOne: true });
BlessingSchema.virtual('wedding', { ref: 'Wedding', localField: 'weddingId', foreignField: '_id', justOne: true });

const DispatchSchema: Schema = define(
  {
    weddingId: ref('Wedding'),
    createdById: ref('User'),
    ceremonyIds: { type: [Schema.Types.ObjectId], ref: 'Ceremony', default: [] },
    cohorts: { type: [{ type: String, enum: GUEST_COHORTS }], default: [] },
    refLead: nullableString,
    includeRegistry: { type: Boolean, default: true },
    total: { type: Number, default: 0 },
  },
  { timestamps: createdOnly, collection: 'dispatches' },
);
DispatchSchema.index({ weddingId: 1, createdAt: -1 });
DispatchSchema.virtual('wedding', { ref: 'Wedding', localField: 'weddingId', foreignField: '_id', justOne: true });
DispatchSchema.virtual('messages', { ref: 'DispatchMessage', localField: '_id', foreignField: 'dispatchId' });

const DispatchMessageSchema: Schema = define(
  {
    dispatchId: ref('Dispatch'),
    invitationId: ref('Invitation'),
    status: { type: String, enum: DELIVERY_STATUSES, default: 'QUEUED' },
    error: nullableString,
    providerMessageId: nullableString,
    sentAt: { type: Date, default: null },
  },
  { collection: 'dispatch_messages', versionKey: false },
);
DispatchMessageSchema.index({ dispatchId: 1, status: 1 });
DispatchMessageSchema.index({ invitationId: 1 });
DispatchMessageSchema.virtual('dispatch', { ref: 'Dispatch', localField: 'dispatchId', foreignField: '_id', justOne: true });
DispatchMessageSchema.virtual('invitation', { ref: 'Invitation', localField: 'invitationId', foreignField: '_id', justOne: true });

const NotificationLogSchema: Schema = define(
  {
    channel: { type: String, required: true },
    recipient: { type: String, required: true },
    userId: ref('User', false),
    template: { type: String, required: true },
    payload: { type: Schema.Types.Mixed, required: true },
    status: { type: String, enum: DELIVERY_STATUSES, required: true },
    providerMessageId: nullableString,
    error: nullableString,
  },
  { timestamps: createdOnly, collection: 'notification_logs', minimize: false },
);
NotificationLogSchema.index({ recipient: 1, createdAt: -1 });

const PaymentEventSchema: Schema = define(
  {
    provider: { type: String, required: true },
    eventId: { type: String, required: true },
    type: { type: String, required: true },
    payload: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: createdOnly, collection: 'payment_events', minimize: false },
);
PaymentEventSchema.index({ provider: 1, eventId: 1 }, { unique: true });

const localized = () => ({
  en: { type: String, default: '' },
  hi: { type: String, default: '' },
  te: { type: String, default: '' },
});

const FlatSchema: Schema = define(
  {
    name: { type: String, required: true },
    projectName: nullableString,
    location: { type: String, required: true },
    description: nullableString,
    flatType: { type: String, required: true },
    totalSft: { type: Number, required: true },
    pricePerSftPaise: { type: Number, required: true },
    brickRatio: { type: Number, default: 10 },
    floorPlanUrl: nullableString,
    photos: { type: [String], default: [] },
    amenities: { type: [String], default: [] },
    highlights: { type: [String], default: [] },
    totalPricePaise: { type: Number, required: true },
    targetAmountPaise: { type: Number, required: true },
    minGiftPaise: { type: Number, default: 0 },
    status: { type: String, enum: FLAT_STATUSES, default: 'AVAILABLE' },
    reservedWeddingId: ref('Wedding', false),
  },
  { timestamps, collection: 'flats' },
);
FlatSchema.index({ status: 1, createdAt: -1 });

const FlatAreaSchema: Schema = define(
  {
    flatId: ref('Flat'),
    key: { type: String, required: true },
    name: { type: String, required: true },
    sft: { type: Number, required: true },
    description: nullableString,
    icon: nullableString,
    sortOrder: { type: Number, default: 0 },
    x: { type: Number, default: 0 },
    y: { type: Number, default: 0 },
    w: { type: Number, default: 10 },
    h: { type: Number, default: 10 },
  },
  { collection: 'flat_areas', versionKey: false },
);
FlatAreaSchema.index({ flatId: 1, key: 1 }, { unique: true });
FlatAreaSchema.index({ flatId: 1, sortOrder: 1 });

const ApprovalSchema: Schema = define(
  {
    weddingId: ref('Wedding'),
    adminId: ref('User', false),
    decision: { type: String, enum: APPROVAL_STATUSES, required: true },
    reason: nullableString,
  },
  { timestamps: createdOnly, collection: 'approvals' },
);
ApprovalSchema.index({ weddingId: 1, createdAt: -1 });

const AuditLogSchema: Schema = define(
  {
    actorId: ref('User', false),
    action: { type: String, required: true },
    entityType: { type: String, required: true },
    entityId: nullableString,
    meta: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: createdOnly, collection: 'audit_logs', minimize: false },
);
AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });

const ComplaintSchema: Schema = define(
  {
    userId: ref('User'),
    weddingId: ref('Wedding', false),
    subject: { type: String, required: true },
    message: { type: String, required: true },
    status: { type: String, enum: ['OPEN', 'IN_REVIEW', 'RESOLVED'], default: 'OPEN' },
    resolution: nullableString,
  },
  { timestamps, collection: 'complaints' },
);
ComplaintSchema.index({ status: 1, createdAt: -1 });
ComplaintSchema.virtual('user', { ref: 'User', localField: 'userId', foreignField: '_id', justOne: true });

const PlatformContentSchema: Schema = define(
  {
    key: { type: String, required: true, unique: true },
    disclaimer: localized(),
    intro: {
      type: [{ title: localized(), body: localized() }],
      default: [],
    },
    supportPhone: nullableString,
    supportEmail: nullableString,
    terms: localized(),
    privacy: localized(),
    templates: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps, collection: 'platform_content', minimize: false },
);

const DeviceTokenSchema: Schema = define(
  {
    userId: ref('User'),
    token: { type: String, required: true, unique: true },
    platform: { type: String, enum: ['ios', 'android', 'web'], required: true },
  },
  { timestamps: createdOnly, collection: 'device_tokens' },
);
DeviceTokenSchema.index({ userId: 1 });

const InAppNotificationSchema: Schema = define(
  {
    userId: ref('User'),
    title: { type: String, required: true },
    body: { type: String, required: true },
    kind: { type: String, default: 'general' },
    readAt: { type: Date, default: null },
  },
  { timestamps: createdOnly, collection: 'in_app_notifications' },
);
InAppNotificationSchema.index({ userId: 1, createdAt: -1 });

const BrickAllocationSchema: Schema = define(
  {
    weddingId: ref('Wedding'),
    tileId: ref('FloorTile'),
    contributionId: ref('Contribution'),
    bricks: { type: Number, required: true },
    status: { type: String, enum: ['HOLD', 'FUNDED', 'RELEASED'], default: 'HOLD' },
  },
  { collection: 'brick_allocations', versionKey: false },
);
BrickAllocationSchema.index({ contributionId: 1, status: 1 });
BrickAllocationSchema.index({ tileId: 1, status: 1 });

export const UserModel = register<User>('User', UserSchema, 'users');
export const SessionModel = register<Session>('Session', SessionSchema, 'sessions');
export const WeddingModel = register<Wedding>('Wedding', WeddingSchema, 'weddings');
export const WeddingMemberModel = register<WeddingMember>('WeddingMember', WeddingMemberSchema, 'wedding_members');
export const CeremonyModel = register<Ceremony>('Ceremony', CeremonySchema, 'ceremonies');
export const InvitationModel = register<Invitation>('Invitation', InvitationSchema, 'invitations');
export const InvitationCeremonyModel = register<InvitationCeremony>('InvitationCeremony', InvitationCeremonySchema, 'invitation_ceremonies');
export const RsvpModel = register<Rsvp>('Rsvp', RsvpSchema, 'rsvps');
export const RoomZoneModel = register<RoomZone>('RoomZone', RoomZoneSchema, ROOM_ZONES);
export const FloorTileModel = register<FloorTile>('FloorTile', FloorTileSchema, FLOOR_TILES);
export const ContributionModel = register<Contribution>('Contribution', ContributionSchema, 'contributions');
export const LedgerEntryModel = register<LedgerEntry>('LedgerEntry', LedgerEntrySchema, 'ledger_entries');
export const SettlementModel = register<Settlement>('Settlement', SettlementSchema, 'settlements');
export const BlessingModel = register<Blessing>('Blessing', BlessingSchema, 'blessings');
export const DispatchModel = register<Dispatch>('Dispatch', DispatchSchema, 'dispatches');
export const DispatchMessageModel = register<DispatchMessage>('DispatchMessage', DispatchMessageSchema, 'dispatch_messages');
export const NotificationLogModel = register<NotificationLog>('NotificationLog', NotificationLogSchema, 'notification_logs');
export const PaymentEventModel = register<PaymentEvent>('PaymentEvent', PaymentEventSchema, 'payment_events');
export const FlatModel = register<Flat>('Flat', FlatSchema, 'flats');
export const FlatAreaModel = register<FlatArea>('FlatArea', FlatAreaSchema, 'flat_areas');
export const ApprovalModel = register<Approval>('Approval', ApprovalSchema, 'approvals');
export const AuditLogModel = register<AuditLog>('AuditLog', AuditLogSchema, 'audit_logs');
export const ComplaintModel = register<Complaint>('Complaint', ComplaintSchema, 'complaints');
export const PlatformContentModel = register<PlatformContent>('PlatformContent', PlatformContentSchema, 'platform_content');
export const DeviceTokenModel = register<DeviceToken>('DeviceToken', DeviceTokenSchema, 'device_tokens');
export const InAppNotificationModel = register<InAppNotification>('InAppNotification', InAppNotificationSchema, 'in_app_notifications');
export const BrickAllocationModel = register<BrickAllocation>('BrickAllocation', BrickAllocationSchema, 'brick_allocations');

export type UserDoc = Doc<User>;
export type SessionDoc = Doc<Session>;
export type WeddingDoc = Doc<Wedding>;
export type WeddingMemberDoc = Doc<WeddingMember>;
export type CeremonyDoc = Doc<Ceremony>;
export type InvitationDoc = Doc<Invitation>;
export type InvitationCeremonyDoc = Doc<InvitationCeremony>;
export type RsvpDoc = Doc<Rsvp>;
export type RoomZoneDoc = Doc<RoomZone>;
export type FloorTileDoc = Doc<FloorTile>;
export type ContributionDoc = Doc<Contribution>;
export type LedgerEntryDoc = Doc<LedgerEntry>;
export type SettlementDoc = Doc<Settlement>;
export type BlessingDoc = Doc<Blessing>;
export type DispatchDoc = Doc<Dispatch>;
export type DispatchMessageDoc = Doc<DispatchMessage>;
export type FlatDoc = Doc<Flat>;
export type FlatAreaDoc = Doc<FlatArea>;
export type ApprovalDoc = Doc<Approval>;
export type ComplaintDoc = Doc<Complaint>;
export type PlatformContentDoc = Doc<PlatformContent>;
export type InAppNotificationDoc = Doc<InAppNotification>;
