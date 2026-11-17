export type Role = "HOST" | "CO_HOST" | "LEAD" | "VENUE" | "GUEST" | "PLATFORM";
export type Cohort = "CLOSE_FAMILY" | "FAMILY" | "FRIENDS" | "COLLEAGUES" | "VIP" | "OTHER";
export type RsvpStatus = "ATTENDING" | "DECLINED" | "MAYBE";
export type ContributionStatus = "PENDING" | "SUCCESS" | "FAILED" | "EXPIRED" | "CANCELLED" | "REFUND_REQUIRED";
export type ModerationStatus = "PENDING" | "APPROVED" | "HIDDEN";
export type StageDisplayMode = "NAMES_AND_BLESSINGS" | "ANONYMIZED" | "PROGRESS_ONLY";
export type SettlementStatus = "REQUESTED" | "HOST_APPROVED" | "APPROVED" | "DISBURSED" | "REJECTED";

export interface User {
  id: string;
  phone: string;
  name: string | null;
  email: string | null;
  isPlatformAdmin: boolean;
}

export interface AccessibleWedding {
  slug: string;
  brideName: string;
  groomName: string;
  weddingDate: string | null;
  coverPhotoUrl: string | null;
  role: Role;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresInSec: number;
  user: User;
  weddings: AccessibleWedding[];
}

export interface Me {
  user: User;
  weddings: AccessibleWedding[];
}

export interface OtpRequest {
  requestId: string;
  phone: string;
  maskedPhone: string;
  channel: "whatsapp" | "sms";
  expiresInSec: number;
  resendAfterSec: number;
  devOtp?: string;
}

export interface PublicConfig {
  paymentProvider: "mock" | "razorpay";
  razorpayKeyId: string | null;
  otpLength: number;
  otpTtlSec: number;
  defaultCountry: string;
  devOtpExposed: boolean;
}

export type FeedEntry =
  | { unlocked: false; monogram: string; monthYear: string | null; city: string | null; label: string }
  | {
      unlocked: true;
      role: Role;
      slug: string;
      brideName: string;
      groomName: string;
      monogram: string;
      weddingDate: string | null;
      monthYear: string | null;
      city: string | null;
      coverPhotoUrl: string | null;
      progress: number;
    };

export interface InvitationPreview {
  guestName: string;
  maskedPhone: string;
  wedding: { slug: string; brideName: string; groomName: string; weddingDate: string | null; city: string | null; coverPhotoUrl: string | null };
}

export interface Wedding {
  id: string;
  slug: string;
  brideName: string;
  groomName: string;
  welcomeNote: string | null;
  videoInviteUrl: string | null;
  coverPhotoUrl: string | null;
  city: string | null;
  weddingDate: string | null;
  timezone: string;
  propertyName: string | null;
  propertyLocation: string | null;
  totalSft: number;
  ratePerSftPaise: number;
  presetTiers: number[];
  cartHoldTtlSec: number;
  reraRegId: string | null;
  escrowBankName: string | null;
  escrowIfsc: string | null;
  escrowAccountNumber: string | null;
  escrowAccountLast4: string | null;
  taxExemptionEnabled: boolean;
  stageDisplayMode: StageDisplayMode;
  createdAt: string;
}

export type WeddingWithRole = Wedding & { role: Role };

export interface Ceremony {
  id: string;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string | null;
  venueName: string;
  venueAddress: string | null;
  venueMapsUrl: string | null;
  streamUrl: string | null;
  dressCode: string | null;
  sortOrder: number;
}

export interface Rsvp {
  id: string;
  status: RsvpStatus;
  adults: number;
  children: number;
  infants: number;
  attendingCeremonyIds: string[];
  dietary: string[];
  allergies: string | null;
  arrivalMode: string | null;
  arrivalDetails: string | null;
  arrivalAt: string | null;
  needsAccommodation: boolean;
  checkInDate: string | null;
  checkOutDate: string | null;
  needsShuttle: boolean;
  note: string | null;
  updatedAt: string;
}

export interface RegistrySummary {
  totalSft: number;
  fundedSft: number;
  heldSft: number;
  progress: number;
  ratePerSftPaise: number;
  raisedPaise: number;
  targetPaise: number;
  presetTiers: number[];
  holdTtlSec: number;
}

export interface Microsite {
  wedding: Wedding;
  role: Role;
  invitation: {
    id: string;
    guestName: string;
    cohort: Cohort;
    maxAttendees: number;
    enableRegistry: boolean;
    refLead: string | null;
  } | null;
  ceremonies: Ceremony[];
  rsvp: Rsvp | null;
  registry: RegistrySummary;
}

export interface RoomInput {
  key: string;
  name: string;
  sft: number;
  description?: string | null;
  icon?: string | null;
}

export interface RoomState {
  id: string;
  key: string;
  name: string;
  description: string | null;
  icon: string | null;
  sft: number;
  fundedSft: number;
  heldSft: number;
  openSft: number;
  startIndex: number;
  cells: string;
  donors: Record<string, string>;
}

export interface RegistryState extends RegistrySummary {
  openSft: number;
  rooms: RoomState[];
}

export interface LockInput {
  slug: string;
  roomKey: string;
  units: number;
  donorName?: string;
  relationship?: string;
  blessing?: string;
  anonymous?: boolean;
  tableNumber?: string;
  refLead?: string;
}

export interface Links {
  checkoutUrl: string | null;
  receiptUrl: string | null;
  thankYouUrl: string | null;
}

export interface OwnerContribution {
  id: string;
  status: ContributionStatus;
  units: number;
  ratePaise: number;
  amountPaise: number;
  room: { key: string; name: string };
  donorName: string;
  donorPhone: string | null;
  relationship: string | null;
  blessing: string | null;
  anonymous: boolean;
  tableNumber: string | null;
  refLead: string | null;
  provider: string;
  providerPaymentId: string | null;
  receiptNumber: string | null;
  receiptHash: string | null;
  holdExpiresAt: string;
  paidAt: string | null;
  failureReason: string | null;
  createdAt: string;
}

export type MyContribution = OwnerContribution & { links: Links };

export interface ContributionDetail extends OwnerContribution {
  tileIndexes: number[];
  wedding: { slug: string; brideName: string; groomName: string };
  links: Links;
}

export interface LockResult {
  contribution: OwnerContribution;
  links: Links;
}

export interface WallEntry {
  id: string;
  donorName: string;
  initials: string;
  relationship: string | null;
  units: number;
  room: { key: string; name: string };
  blessing: string | null;
  tableNumber: string | null;
  paidAt: string | null;
}

export interface Checkout {
  contributionId: string;
  status: ContributionStatus;
  units: number;
  amountPaise: number;
  ratePaise: number;
  room: { key: string; name: string };
  donorName: string;
  blessing: string | null;
  holdExpiresAt: string;
  wedding: { slug: string; brideName: string; groomName: string };
  links: Links;
  payment:
    | null
    | { provider: "mock"; orderId: string; amount: number; currency: string; description: string }
    | {
        provider: "razorpay";
        keyId: string;
        orderId: string;
        amount: number;
        currency: string;
        name: string;
        description: string;
        prefill: { name?: string; contact?: string };
        notes: Record<string, string>;
      };
}

export interface PaymentResult {
  status: ContributionStatus;
  links: Links;
}

export interface Receipt {
  id: string;
  receiptNumber: string;
  receiptHash: string | null;
  donorName: string;
  relationship: string | null;
  blessing: string | null;
  anonymous: boolean;
  units: number;
  ratePaise: number;
  amountPaise: number;
  room: { key: string; name: string };
  paidAt: string;
  paymentId: string | null;
  taxExempt: boolean;
  escrow: { bank: string | null; ifsc: string | null; accountLast4: string | null; rera: string | null };
  wedding: { slug: string; brideName: string; groomName: string; weddingDate: string | null; propertyName: string | null };
  verifyUrl: string;
}

export interface ReceiptVerification {
  valid: boolean;
  receiptNumber: string;
  hash?: string;
  couple?: string;
  donorInitials?: string;
  units?: number;
  room?: string;
  amountPaise?: number;
  paidAt?: string;
  taxExempt?: boolean;
}

export interface MyRsvp {
  invitation: { id: string; guestName: string; email: string | null; maxAttendees: number };
  invitedCeremonies: { id: string; title: string; startsAt: string; venueName: string }[];
  rsvp: Rsvp | null;
}

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
  arrivalAt?: string | null;
  needsAccommodation: boolean;
  checkInDate?: string | null;
  checkOutDate?: string | null;
  needsShuttle: boolean;
  note?: string | null;
  guestName?: string;
  email?: string | null;
}

export interface RsvpRow extends Rsvp {
  invitation: { guestName: string; phone?: string; cohort: Cohort; refLead: string | null; maxAttendees: number };
}

export interface RsvpSummary {
  invited: number;
  responded: number;
  pending: number;
  attending: number;
  declined: number;
  maybe: number;
  headcount: { adults: number; children: number; infants: number; total: number };
  byCeremony: { id: string; title: string; startsAt: string; adults: number; children: number; infants: number; total: number }[];
  dietary: Record<string, number>;
  accommodation: number;
  shuttle: number;
}

export interface Guest {
  id: string;
  guestName: string;
  phone: string;
  email: string | null;
  cohort: Cohort;
  maxAttendees: number;
  enableRegistry: boolean;
  refLead: string | null;
  ceremonyIds: string[];
  rsvpStatus: RsvpStatus | "PENDING";
  linkedAccount: boolean;
  inviteLink: string;
  createdAt: string;
}

export interface GuestInput {
  guestName: string;
  phone: string;
  email: string | null;
  cohort: Cohort;
  maxAttendees: number;
  enableRegistry: boolean;
  ceremonyIds: string[];
  refLead: string | null;
}

export interface ImportResult {
  created: number;
  updated: number;
  errors: { row: number; message: string }[];
}

export interface DispatchInput {
  ceremonyIds?: string[];
  cohorts?: Cohort[];
  invitationIds?: string[];
  includeRegistry: boolean;
  onlyPendingRsvp?: boolean;
}

export interface DispatchSummary {
  id: string;
  createdAt: string;
  ceremonyIds: string[];
  cohorts: Cohort[];
  refLead: string | null;
  includeRegistry: boolean;
  total: number;
  queued: number;
  sent: number;
  failed: number;
  skipped: number;
}

export interface Blessing {
  id: string;
  authorName: string;
  message: string | null;
  photoUrl: string | null;
  tableNumber: string | null;
  status: ModerationStatus;
  createdAt: string;
}

export interface Dashboard {
  guests: { total: number; byCohort: Partial<Record<Cohort, number>> };
  rsvp: { byStatus: Partial<Record<RsvpStatus, number>>; responded: number; headcount: { adults: number; children: number; infants: number } };
  registry: RegistrySummary;
  gifts: { contributors: number; fundedSft: number; raisedPaise: number; byStatus: Partial<Record<ContributionStatus, number>> };
  escrow: { creditedPaise: number; disbursedPaise: number; pendingSettlementPaise: number; availablePaise: number };
  dispatch: Partial<Record<"QUEUED" | "SENT" | "FAILED" | "SKIPPED", number>>;
}

export interface Member {
  id: string;
  role: Exclude<Role, "GUEST" | "PLATFORM">;
  label: string | null;
  createdAt?: string;
  user: { id: string; phone: string; name: string | null };
}

export interface StagePayload {
  wedding: {
    id: string;
    slug: string;
    brideName: string;
    groomName: string;
    propertyName: string | null;
    weddingDate: string | null;
    displayMode: StageDisplayMode;
  };
  registry: RegistrySummary & { openSft: number; rooms: Omit<RoomState, "cells" | "donors">[] };
  donors: WallEntry[];
  blessings: Blessing[];
  giftUrl: string;
}

export interface Settlement {
  id: string;
  weddingId: string;
  amountPaise: number;
  destination: "BUILDER_ESCROW" | "HOME_LOAN";
  beneficiaryName: string;
  accountNumber: string;
  ifsc: string;
  status: SettlementStatus;
  requestedById: string;
  hostApprovedById: string | null;
  hostApprovedAt: string | null;
  complianceApprovedById: string | null;
  complianceApprovedAt: string | null;
  rejectedReason: string | null;
  bankReference: string | null;
  disbursedAt: string | null;
  createdAt: string;
}

export type ComplianceSettlement = Settlement & {
  wedding: { slug: string; brideName: string; groomName: string; escrowBankName: string | null; escrowAccountNumber: string | null };
};

export interface SettlementInput {
  amount: number;
  destination: "BUILDER_ESCROW" | "HOME_LOAN";
  beneficiaryName: string;
  accountNumber: string;
  ifsc: string;
}

export interface Ledger {
  escrow: { bankName: string | null; accountNumber: string | null; ifsc: string | null; reraRegId: string | null };
  balances: {
    creditsPaise: number;
    debitsPaise: number;
    refundsPaise: number;
    balancePaise: number;
    reservedPaise: number;
    availablePaise: number;
  };
  entries: {
    id: string;
    type: "CREDIT" | "DEBIT" | "REFUND";
    amountPaise: number;
    reference: string;
    createdAt: string;
    contribution: { donorName: string; units: number; receiptNumber: string | null } | null;
  }[];
  settlements: Settlement[];
}
