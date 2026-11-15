-- Espace créatrices (V2, phase 1) : créatrices, propositions d'idées, commissions et paiements
-- Les montants sont en centimes ; l'IBAN est stocké chiffré (AES-256-GCM), jamais en clair.

-- CreateEnum
CREATE TYPE "CreatorStatus" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "CreatorContribution" AS ENUM ('IDEA', 'FULL_TUTORIAL');

-- CreateEnum
CREATE TYPE "CreatorSubmissionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'CHANGES_REQUESTED', 'ACCEPTED', 'REJECTED', 'IN_PRODUCTION', 'PREVIEW_READY', 'APPROVED', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "CommissionStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'PAID');

-- CreateEnum
CREATE TYPE "CreatorPayoutStatus" AS ENUM ('PENDING', 'PAID');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "creatorId" TEXT,
ADD COLUMN     "creatorRateBp" INTEGER;

-- CreateTable
CREATE TABLE "Creator" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "publicName" TEXT,
    "slug" TEXT,
    "bio" TEXT,
    "photoUrl" TEXT,
    "photoKey" TEXT,
    "status" "CreatorStatus" NOT NULL DEFAULT 'INVITED',
    "contractVersion" TEXT,
    "contractAcceptedAt" TIMESTAMP(3),
    "contractAcceptedIp" TEXT,
    "ibanEnc" TEXT,
    "ibanLast4" TEXT,
    "ibanHolder" TEXT,
    "defaultRateBp" INTEGER,
    "sessionVersion" INTEGER NOT NULL DEFAULT 1,
    "lastLoginAt" TIMESTAMP(3),
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Creator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreatorSubmission" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "ageMin" INTEGER,
    "ageMax" INTEGER,
    "durationMinutes" INTEGER,
    "materials" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "steps" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tips" TEXT,
    "safetyNotes" TEXT,
    "photos" JSONB NOT NULL DEFAULT '[]',
    "contribution" "CreatorContribution" NOT NULL DEFAULT 'IDEA',
    "exclusive" BOOLEAN NOT NULL DEFAULT false,
    "status" "CreatorSubmissionStatus" NOT NULL DEFAULT 'DRAFT',
    "moderationComment" TEXT,
    "moderatedAt" TIMESTAMP(3),
    "moderatedById" TEXT,
    "rateBp" INTEGER,
    "submittedAt" TIMESTAMP(3),
    "studioBookId" TEXT,
    "productId" TEXT,
    "previewUrl" TEXT,
    "previewReadyAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreatorSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionEntry" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'ROYALTY',
    "orderId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "productId" TEXT,
    "creatorId" TEXT NOT NULL,
    "baseCents" INTEGER NOT NULL,
    "originalBaseCents" INTEGER NOT NULL,
    "rateBp" INTEGER NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "originalAmountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "status" "CommissionStatus" NOT NULL DEFAULT 'PENDING',
    "payoutId" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommissionEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreatorPayout" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "status" "CreatorPayoutStatus" NOT NULL DEFAULT 'PENDING',
    "reference" TEXT,
    "paidAt" TIMESTAMP(3),
    "paidById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreatorPayout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Creator_email_key" ON "Creator"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Creator_slug_key" ON "Creator"("slug");

-- CreateIndex
CREATE INDEX "Creator_status_idx" ON "Creator"("status");

-- CreateIndex
CREATE INDEX "CreatorSubmission_creatorId_status_idx" ON "CreatorSubmission"("creatorId", "status");

-- CreateIndex
CREATE INDEX "CreatorSubmission_status_submittedAt_idx" ON "CreatorSubmission"("status", "submittedAt");

-- CreateIndex
CREATE INDEX "CreatorSubmission_productId_idx" ON "CreatorSubmission"("productId");

-- CreateIndex
CREATE INDEX "CommissionEntry_creatorId_status_idx" ON "CommissionEntry"("creatorId", "status");

-- CreateIndex
CREATE INDEX "CommissionEntry_status_createdAt_idx" ON "CommissionEntry"("status", "createdAt");

-- CreateIndex
CREATE INDEX "CommissionEntry_orderId_idx" ON "CommissionEntry"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "CommissionEntry_orderItemId_productId_kind_key" ON "CommissionEntry"("orderItemId", "productId", "kind");

-- CreateIndex
CREATE INDEX "CreatorPayout_creatorId_status_idx" ON "CreatorPayout"("creatorId", "status");

-- CreateIndex
CREATE INDEX "CreatorPayout_period_idx" ON "CreatorPayout"("period");

-- CreateIndex
CREATE INDEX "Product_creatorId_idx" ON "Product"("creatorId");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorSubmission" ADD CONSTRAINT "CreatorSubmission_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorSubmission" ADD CONSTRAINT "CreatorSubmission_moderatedById_fkey" FOREIGN KEY ("moderatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorSubmission" ADD CONSTRAINT "CreatorSubmission_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionEntry" ADD CONSTRAINT "CommissionEntry_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionEntry" ADD CONSTRAINT "CommissionEntry_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionEntry" ADD CONSTRAINT "CommissionEntry_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionEntry" ADD CONSTRAINT "CommissionEntry_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionEntry" ADD CONSTRAINT "CommissionEntry_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "CreatorPayout"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorPayout" ADD CONSTRAINT "CreatorPayout_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorPayout" ADD CONSTRAINT "CreatorPayout_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

