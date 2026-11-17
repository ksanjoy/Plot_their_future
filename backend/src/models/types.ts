export const MEMBER_ROLES = ['HOST', 'CO_HOST', 'LEAD', 'VENUE'] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

export const GUEST_COHORTS = ['CLOSE_FAMILY', 'FAMILY', 'FRIENDS', 'COLLEAGUES', 'VIP', 'OTHER'] as const;
export type GuestCohort = (typeof GUEST_COHORTS)[number];

export const TILE_STATUSES = ['OPEN', 'HOLD', 'FUNDED'] as const;
export type TileStatus = (typeof TILE_STATUSES)[number];

export const CONTRIBUTION_STATUSES = ['PENDING', 'SUCCESS', 'FAILED', 'EXPIRED', 'CANCELLED', 'REFUND_REQUIRED'] as const;
export type ContributionStatus = (typeof CONTRIBUTION_STATUSES)[number];

export const RSVP_STATUSES = ['ATTENDING', 'DECLINED', 'MAYBE'] as const;
export type RsvpStatus = (typeof RSVP_STATUSES)[number];

export const MODERATION_STATUSES = ['PENDING', 'APPROVED', 'HIDDEN'] as const;
export type ModerationStatus = (typeof MODERATION_STATUSES)[number];

export const STAGE_DISPLAY_MODES = ['NAMES_AND_BLESSINGS', 'ANONYMIZED', 'PROGRESS_ONLY'] as const;
export type StageDisplayMode = (typeof STAGE_DISPLAY_MODES)[number];

export const DELIVERY_STATUSES = ['QUEUED', 'SENT', 'FAILED', 'SKIPPED'] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export const SETTLEMENT_STATUSES = ['REQUESTED', 'HOST_APPROVED', 'APPROVED', 'DISBURSED', 'REJECTED'] as const;
export type SettlementStatus = (typeof SETTLEMENT_STATUSES)[number];

export const SETTLEMENT_DESTINATIONS = ['BUILDER_ESCROW', 'HOME_LOAN'] as const;
export type SettlementDestination = (typeof SETTLEMENT_DESTINATIONS)[number];

export const LEDGER_TYPES = ['CREDIT', 'DEBIT', 'REFUND'] as const;
export type LedgerType = (typeof LEDGER_TYPES)[number];

export interface User {
  phone: string;
  name: string | null;
  email: string | null;
  isPlatformAdmin: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Session {
  userId: string;
  refreshTokenHash: string;
  userAgent: string | null;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
}

export interface Wedding {
  slug: string;
  brideName: string;
  groomName: string;
  welcomeNote: string | null;
  videoInviteUrl: string | null;
  coverPhotoUrl: string | null;
  city: string | null;
  weddingDate: Date | null;
  timezone: string;
  propertyName: string | null;
  propertyLocation: string | null;
  totalSft: number;
  ratePerSftPaise: number;
  presetTiers: number[];
  cartHoldTtlSec: number;
  reraRegId: string | null;
  escrowBankName: string | null;
  escrowAccountNumber: string | null;
  escrowIfsc: string | null;
  taxExemptionEnabled: boolean;
  stageDisplayMode: StageDisplayMode;
  createdAt: Date;
  updatedAt: Date;
}

export interface WeddingMember {
  weddingId: string;
  userId: string;
  role: MemberRole;
  label: string | null;
  createdAt: Date;
}

export interface Ceremony {
  weddingId: string;
  title: string;
  description: string | null;
  startsAt: Date;
  endsAt: Date | null;
  venueName: string;
  venueAddress: string | null;
  venueMapsUrl: string | null;
  streamUrl: string | null;
  dressCode: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Invitation {
  weddingId: string;
  guestName: string;
  phone: string;
  email: string | null;
  cohort: GuestCohort;
  maxAttendees: number;
  enableRegistry: boolean;
  refToken: string;
  refLead: string | null;
  userId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface InvitationCeremony {
  invitationId: string;
  ceremonyId: string;
}

export interface Rsvp {
  weddingId: string;
  invitationId: string;
  status: RsvpStatus;
  adults: number;
  children: number;
  infants: number;
  attendingCeremonyIds: string[];
  dietary: string[];
  allergies: string | null;
  arrivalMode: string | null;
  arrivalDetails: string | null;
  arrivalAt: Date | null;
  needsAccommodation: boolean;
  checkInDate: Date | null;
  checkOutDate: Date | null;
  needsShuttle: boolean;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RoomZone {
  weddingId: string;
  key: string;
  name: string;
  description: string | null;
  icon: string | null;
  sft: number;
  sortOrder: number;
}

export interface FloorTile {
  weddingId: string;
  roomId: string;
  index: number;
  status: TileStatus;
  lockedUntil: Date | null;
  contributionId: string | null;
}

export interface Contribution {
  weddingId: string;
  userId: string | null;
  roomId: string;
  units: number;
  ratePaise: number;
  amountPaise: number;
  donorName: string;
  donorPhone: string | null;
  relationship: string | null;
  blessing: string | null;
  anonymous: boolean;
  tableNumber: string | null;
  refLead: string | null;
  status: ContributionStatus;
  provider: string;
  providerOrderId: string | null;
  providerPaymentId: string | null;
  holdExpiresAt: Date;
  paidAt: Date | null;
  failureReason: string | null;
  receiptNumber: string | null;
  receiptHash: string | null;
  receiptSignature: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface LedgerEntry {
  weddingId: string;
  contributionId: string | null;
  settlementId: string | null;
  type: LedgerType;
  amountPaise: number;
  reference: string;
  createdAt: Date;
}

export interface Settlement {
  weddingId: string;
  amountPaise: number;
  destination: SettlementDestination;
  beneficiaryName: string;
  accountNumber: string;
  ifsc: string;
  status: SettlementStatus;
  requestedById: string;
  hostApprovedById: string | null;
  hostApprovedAt: Date | null;
  hostSignature: string | null;
  complianceApprovedById: string | null;
  complianceApprovedAt: Date | null;
  complianceSignature: string | null;
  rejectedReason: string | null;
  bankReference: string | null;
  disbursedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Blessing {
  weddingId: string;
  userId: string | null;
  authorName: string;
  message: string | null;
  photoKey: string | null;
  tableNumber: string | null;
  status: ModerationStatus;
  createdAt: Date;
}

export interface Dispatch {
  weddingId: string;
  createdById: string;
  ceremonyIds: string[];
  cohorts: GuestCohort[];
  refLead: string | null;
  includeRegistry: boolean;
  total: number;
  createdAt: Date;
}

export interface DispatchMessage {
  dispatchId: string;
  invitationId: string;
  status: DeliveryStatus;
  error: string | null;
  providerMessageId: string | null;
  sentAt: Date | null;
}

export interface NotificationLog {
  channel: string;
  recipient: string;
  template: string;
  payload: Record<string, unknown>;
  status: DeliveryStatus;
  providerMessageId: string | null;
  error: string | null;
  createdAt: Date;
}

export interface PaymentEvent {
  provider: string;
  eventId: string;
  type: string;
  payload: Record<string, unknown>;
  createdAt: Date;
}
