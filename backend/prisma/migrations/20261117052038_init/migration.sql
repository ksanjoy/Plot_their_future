-- CreateEnum
CREATE TYPE "MemberRole" AS ENUM ('HOST', 'CO_HOST', 'LEAD', 'VENUE');

-- CreateEnum
CREATE TYPE "GuestCohort" AS ENUM ('CLOSE_FAMILY', 'FAMILY', 'FRIENDS', 'COLLEAGUES', 'VIP', 'OTHER');

-- CreateEnum
CREATE TYPE "TileStatus" AS ENUM ('OPEN', 'HOLD', 'FUNDED');

-- CreateEnum
CREATE TYPE "ContributionStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'EXPIRED', 'CANCELLED', 'REFUND_REQUIRED');

-- CreateEnum
CREATE TYPE "RsvpStatus" AS ENUM ('ATTENDING', 'DECLINED', 'MAYBE');

-- CreateEnum
CREATE TYPE "ModerationStatus" AS ENUM ('PENDING', 'APPROVED', 'HIDDEN');

-- CreateEnum
CREATE TYPE "StageDisplayMode" AS ENUM ('NAMES_AND_BLESSINGS', 'ANONYMIZED', 'PROGRESS_ONLY');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "SettlementStatus" AS ENUM ('REQUESTED', 'HOST_APPROVED', 'APPROVED', 'DISBURSED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SettlementDestination" AS ENUM ('BUILDER_ESCROW', 'HOME_LOAN');

-- CreateEnum
CREATE TYPE "LedgerType" AS ENUM ('CREDIT', 'DEBIT', 'REFUND');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "isPlatformAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wedding" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "brideName" TEXT NOT NULL,
    "groomName" TEXT NOT NULL,
    "welcomeNote" TEXT,
    "videoInviteUrl" TEXT,
    "coverPhotoUrl" TEXT,
    "city" TEXT,
    "weddingDate" TIMESTAMP(3),
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "propertyName" TEXT,
    "propertyLocation" TEXT,
    "totalSft" INTEGER NOT NULL,
    "ratePerSftPaise" INTEGER NOT NULL,
    "presetTiers" INTEGER[] DEFAULT ARRAY[1, 5, 10]::INTEGER[],
    "cartHoldTtlSec" INTEGER NOT NULL DEFAULT 600,
    "reraRegId" TEXT,
    "escrowBankName" TEXT,
    "escrowAccountNumber" TEXT,
    "escrowIfsc" TEXT,
    "taxExemptionEnabled" BOOLEAN NOT NULL DEFAULT true,
    "stageDisplayMode" "StageDisplayMode" NOT NULL DEFAULT 'NAMES_AND_BLESSINGS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wedding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeddingMember" (
    "id" UUID NOT NULL,
    "weddingId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "MemberRole" NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeddingMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ceremony" (
    "id" UUID NOT NULL,
    "weddingId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "venueName" TEXT NOT NULL,
    "venueAddress" TEXT,
    "venueMapsUrl" TEXT,
    "streamUrl" TEXT,
    "dressCode" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ceremony_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invitation" (
    "id" UUID NOT NULL,
    "weddingId" UUID NOT NULL,
    "guestName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "cohort" "GuestCohort" NOT NULL DEFAULT 'FAMILY',
    "maxAttendees" INTEGER NOT NULL DEFAULT 2,
    "enableRegistry" BOOLEAN NOT NULL DEFAULT true,
    "refToken" TEXT NOT NULL,
    "refLead" TEXT,
    "userId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvitationCeremony" (
    "invitationId" UUID NOT NULL,
    "ceremonyId" UUID NOT NULL,

    CONSTRAINT "InvitationCeremony_pkey" PRIMARY KEY ("invitationId","ceremonyId")
);

-- CreateTable
CREATE TABLE "Rsvp" (
    "id" UUID NOT NULL,
    "weddingId" UUID NOT NULL,
    "invitationId" UUID NOT NULL,
    "status" "RsvpStatus" NOT NULL,
    "adults" INTEGER NOT NULL DEFAULT 1,
    "children" INTEGER NOT NULL DEFAULT 0,
    "infants" INTEGER NOT NULL DEFAULT 0,
    "attendingCeremonyIds" UUID[],
    "dietary" TEXT[],
    "allergies" TEXT,
    "arrivalMode" TEXT,
    "arrivalDetails" TEXT,
    "arrivalAt" TIMESTAMP(3),
    "needsAccommodation" BOOLEAN NOT NULL DEFAULT false,
    "checkInDate" DATE,
    "checkOutDate" DATE,
    "needsShuttle" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rsvp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomZone" (
    "id" UUID NOT NULL,
    "weddingId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "sft" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RoomZone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FloorTile" (
    "id" UUID NOT NULL,
    "weddingId" UUID NOT NULL,
    "roomId" UUID NOT NULL,
    "index" INTEGER NOT NULL,
    "status" "TileStatus" NOT NULL DEFAULT 'OPEN',
    "lockedUntil" TIMESTAMP(3),
    "contributionId" UUID,

    CONSTRAINT "FloorTile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contribution" (
    "id" UUID NOT NULL,
    "weddingId" UUID NOT NULL,
    "userId" UUID,
    "roomId" UUID NOT NULL,
    "units" INTEGER NOT NULL,
    "ratePaise" INTEGER NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "donorName" TEXT NOT NULL,
    "donorPhone" TEXT,
    "relationship" TEXT,
    "blessing" TEXT,
    "anonymous" BOOLEAN NOT NULL DEFAULT false,
    "tableNumber" TEXT,
    "refLead" TEXT,
    "status" "ContributionStatus" NOT NULL DEFAULT 'PENDING',
    "provider" TEXT NOT NULL,
    "providerOrderId" TEXT,
    "providerPaymentId" TEXT,
    "holdExpiresAt" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "receiptNumber" TEXT,
    "receiptHash" TEXT,
    "receiptSignature" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" UUID NOT NULL,
    "weddingId" UUID NOT NULL,
    "contributionId" UUID,
    "settlementId" UUID,
    "type" "LedgerType" NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "reference" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settlement" (
    "id" UUID NOT NULL,
    "weddingId" UUID NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "destination" "SettlementDestination" NOT NULL,
    "beneficiaryName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "ifsc" TEXT NOT NULL,
    "status" "SettlementStatus" NOT NULL DEFAULT 'REQUESTED',
    "requestedById" UUID NOT NULL,
    "hostApprovedById" UUID,
    "hostApprovedAt" TIMESTAMP(3),
    "hostSignature" TEXT,
    "complianceApprovedById" UUID,
    "complianceApprovedAt" TIMESTAMP(3),
    "complianceSignature" TEXT,
    "rejectedReason" TEXT,
    "bankReference" TEXT,
    "disbursedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Blessing" (
    "id" UUID NOT NULL,
    "weddingId" UUID NOT NULL,
    "userId" UUID,
    "authorName" TEXT NOT NULL,
    "message" TEXT,
    "photoKey" TEXT,
    "tableNumber" TEXT,
    "status" "ModerationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Blessing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dispatch" (
    "id" UUID NOT NULL,
    "weddingId" UUID NOT NULL,
    "createdById" UUID NOT NULL,
    "ceremonyIds" UUID[],
    "cohorts" "GuestCohort"[],
    "refLead" TEXT,
    "includeRegistry" BOOLEAN NOT NULL DEFAULT true,
    "total" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Dispatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DispatchMessage" (
    "id" UUID NOT NULL,
    "dispatchId" UUID NOT NULL,
    "invitationId" UUID NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'QUEUED',
    "error" TEXT,
    "providerMessageId" TEXT,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "DispatchMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" UUID NOT NULL,
    "channel" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "DeliveryStatus" NOT NULL,
    "providerMessageId" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentEvent" (
    "id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Session_refreshTokenHash_key" ON "Session"("refreshTokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Wedding_slug_key" ON "Wedding"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "WeddingMember_weddingId_userId_key" ON "WeddingMember"("weddingId", "userId");

-- CreateIndex
CREATE INDEX "Ceremony_weddingId_startsAt_idx" ON "Ceremony"("weddingId", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_refToken_key" ON "Invitation"("refToken");

-- CreateIndex
CREATE INDEX "Invitation_phone_idx" ON "Invitation"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_weddingId_phone_key" ON "Invitation"("weddingId", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "Rsvp_invitationId_key" ON "Rsvp"("invitationId");

-- CreateIndex
CREATE INDEX "Rsvp_weddingId_status_idx" ON "Rsvp"("weddingId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "RoomZone_weddingId_key_key" ON "RoomZone"("weddingId", "key");

-- CreateIndex
CREATE INDEX "FloorTile_weddingId_status_idx" ON "FloorTile"("weddingId", "status");

-- CreateIndex
CREATE INDEX "FloorTile_roomId_status_idx" ON "FloorTile"("roomId", "status");

-- CreateIndex
CREATE INDEX "FloorTile_contributionId_idx" ON "FloorTile"("contributionId");

-- CreateIndex
CREATE UNIQUE INDEX "FloorTile_weddingId_index_key" ON "FloorTile"("weddingId", "index");

-- CreateIndex
CREATE UNIQUE INDEX "Contribution_providerOrderId_key" ON "Contribution"("providerOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "Contribution_receiptNumber_key" ON "Contribution"("receiptNumber");

-- CreateIndex
CREATE INDEX "Contribution_weddingId_status_idx" ON "Contribution"("weddingId", "status");

-- CreateIndex
CREATE INDEX "Contribution_userId_idx" ON "Contribution"("userId");

-- CreateIndex
CREATE INDEX "LedgerEntry_weddingId_createdAt_idx" ON "LedgerEntry"("weddingId", "createdAt");

-- CreateIndex
CREATE INDEX "Settlement_weddingId_status_idx" ON "Settlement"("weddingId", "status");

-- CreateIndex
CREATE INDEX "Blessing_weddingId_status_createdAt_idx" ON "Blessing"("weddingId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Dispatch_weddingId_createdAt_idx" ON "Dispatch"("weddingId", "createdAt");

-- CreateIndex
CREATE INDEX "DispatchMessage_dispatchId_status_idx" ON "DispatchMessage"("dispatchId", "status");

-- CreateIndex
CREATE INDEX "NotificationLog_recipient_createdAt_idx" ON "NotificationLog"("recipient", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentEvent_provider_eventId_key" ON "PaymentEvent"("provider", "eventId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeddingMember" ADD CONSTRAINT "WeddingMember_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "Wedding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeddingMember" ADD CONSTRAINT "WeddingMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ceremony" ADD CONSTRAINT "Ceremony_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "Wedding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "Wedding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvitationCeremony" ADD CONSTRAINT "InvitationCeremony_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "Invitation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvitationCeremony" ADD CONSTRAINT "InvitationCeremony_ceremonyId_fkey" FOREIGN KEY ("ceremonyId") REFERENCES "Ceremony"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rsvp" ADD CONSTRAINT "Rsvp_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "Wedding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rsvp" ADD CONSTRAINT "Rsvp_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "Invitation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomZone" ADD CONSTRAINT "RoomZone_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "Wedding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FloorTile" ADD CONSTRAINT "FloorTile_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "Wedding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FloorTile" ADD CONSTRAINT "FloorTile_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "RoomZone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FloorTile" ADD CONSTRAINT "FloorTile_contributionId_fkey" FOREIGN KEY ("contributionId") REFERENCES "Contribution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contribution" ADD CONSTRAINT "Contribution_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "Wedding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contribution" ADD CONSTRAINT "Contribution_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contribution" ADD CONSTRAINT "Contribution_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "RoomZone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "Wedding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_contributionId_fkey" FOREIGN KEY ("contributionId") REFERENCES "Contribution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "Settlement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "Wedding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Blessing" ADD CONSTRAINT "Blessing_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "Wedding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Blessing" ADD CONSTRAINT "Blessing_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispatch" ADD CONSTRAINT "Dispatch_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "Wedding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispatchMessage" ADD CONSTRAINT "DispatchMessage_dispatchId_fkey" FOREIGN KEY ("dispatchId") REFERENCES "Dispatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispatchMessage" ADD CONSTRAINT "DispatchMessage_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "Invitation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
