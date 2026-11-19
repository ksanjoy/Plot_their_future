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

export const APPROVAL_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'CHANGES_REQUESTED'] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export const LINK_VISIBILITIES = ['PUBLIC', 'PRIVATE', 'PAUSED'] as const;
export type LinkVisibility = (typeof LINK_VISIBILITIES)[number];

export const KYC_STATUSES = ['NOT_REQUIRED', 'REQUIRED', 'SUBMITTED', 'VERIFIED', 'REJECTED'] as const;
export type KycStatus = (typeof KYC_STATUSES)[number];

export const FLAT_STATUSES = ['AVAILABLE', 'RESERVED', 'COMPLETED', 'ARCHIVED'] as const;
export type FlatStatus = (typeof FLAT_STATUSES)[number];

export const GIFT_UNIT_KINDS = ['SQFT', 'BRICK', 'AMOUNT'] as const;
export type GiftUnitKind = (typeof GIFT_UNIT_KINDS)[number];

export const FOOD_PREFERENCES = ['VEG', 'NON_VEG', 'JAIN', 'OTHER'] as const;
export type FoodPreference = (typeof FOOD_PREFERENCES)[number];

export interface User {
  phone: string;
  name: string | null;
  email: string | null;
  occupation: string | null;
  passwordHash: string | null;
  isPlatformAdmin: boolean;
  blockedAt: Date | null;
  blockedReason: string | null;
  messageOptOut: boolean;
  locale: string;
  deletedAt: Date | null;
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
  approvalStatus: ApprovalStatus;
  approvalNote: string | null;
  contactMobile: string | null;
  cardImageUrl: string | null;
  flatId: string | null;
  linkVisibility: LinkVisibility;
  brickRatio: number;
  minGiftPaise: number;
  targetAmountPaise: number | null;
  hideAmountsFromGuests: boolean;
  kycStatus: KycStatus;
  kycLegalName: string | null;
  kycIdLast4: string | null;
  kycNote: string | null;
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
  coverImageUrl: string | null;
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
  occupation: string | null;
  messageOptOut: boolean;
  lastPromoAt: Date | null;
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
  accommodationRooms: number;
  accommodationGuests: number;
  foodPreference: FoodPreference | null;
  ceremonyResponses: CeremonyResponse[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CeremonyResponse {
  ceremonyId: string;
  status: RsvpStatus;
  adults: number;
  children: number;
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
  fundedBricks: number;
  heldBricks: number;
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
  hideAmount: boolean;
  unitKind: GiftUnitKind;
  brickCount: number;
  photoKey: string | null;
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
  userId: string | null;
  template: string;
  payload: Record<string, unknown>;
  status: DeliveryStatus;
  providerMessageId: string | null;
  error: string | null;
  createdAt: Date;
}

export interface Flat {
  name: string;
  projectName: string | null;
  location: string;
  description: string | null;
  flatType: string;
  totalSft: number;
  pricePerSftPaise: number;
  brickRatio: number;
  floorPlanUrl: string | null;
  photos: string[];
  amenities: string[];
  highlights: string[];
  totalPricePaise: number;
  targetAmountPaise: number;
  minGiftPaise: number;
  status: FlatStatus;
  reservedWeddingId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface FlatArea {
  flatId: string;
  key: string;
  name: string;
  sft: number;
  description: string | null;
  icon: string | null;
  sortOrder: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Approval {
  weddingId: string;
  adminId: string | null;
  decision: ApprovalStatus;
  reason: string | null;
  createdAt: Date;
}

export interface AuditLog {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  meta: Record<string, unknown>;
  createdAt: Date;
}

export interface Complaint {
  userId: string;
  weddingId: string | null;
  subject: string;
  message: string;
  status: 'OPEN' | 'IN_REVIEW' | 'RESOLVED';
  resolution: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface LocalizedText {
  en: string;
  hi: string;
  te: string;
}

export interface IntroScreen {
  title: LocalizedText;
  body: LocalizedText;
}

export interface PlatformContent {
  key: string;
  disclaimer: LocalizedText;
  intro: IntroScreen[];
  supportPhone: string | null;
  supportEmail: string | null;
  terms: LocalizedText;
  privacy: LocalizedText;
  templates: Record<string, LocalizedText>;
  createdAt: Date;
  updatedAt: Date;
}

export interface DeviceToken {
  userId: string;
  token: string;
  platform: 'ios' | 'android' | 'web';
  createdAt: Date;
}

export interface InAppNotification {
  userId: string;
  title: string;
  body: string;
  kind: string;
  readAt: Date | null;
  createdAt: Date;
}

export interface BrickAllocation {
  weddingId: string;
  tileId: string;
  contributionId: string;
  bricks: number;
  status: 'HOLD' | 'FUNDED' | 'RELEASED';
}

export interface PaymentEvent {
  provider: string;
  eventId: string;
  type: string;
  payload: Record<string, unknown>;
  createdAt: Date;
}
