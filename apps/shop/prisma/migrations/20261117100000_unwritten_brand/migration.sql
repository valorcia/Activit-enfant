-- UNWRITTEN (phase 4, première version) : couche « marque » sur Site, produits personnalisés,
-- questionnaires versionnés, brouillons, livres commandés, option cadeau.
-- Migration PUREMENT ADDITIVE : nouvelles tables, nouveaux types, nouvelles colonnes nullables
-- ou avec valeur par défaut reproduisant le comportement actuel de La Malle à Jeux
-- (kind = CATALOG, storefront = malle, locales = {fr}, defaultLocale = fr, currencies = {EUR}).
-- Aucune suppression, aucun renommage.

-- CreateEnum
CREATE TYPE "SiteKind" AS ENUM ('CATALOG', 'PERSONALIZED');

-- CreateEnum
CREATE TYPE "QuestionnaireStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PersonalizationDraftStatus" AS ENUM ('ACTIVE', 'CHECKOUT', 'ORDERED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PersonalItemStatus" AS ENUM ('AWAITING_RECIPIENT', 'PENDING_GENERATION', 'IN_PRODUCTION', 'ERROR', 'DELIVERED', 'CANCELLED');

-- AlterTable
ALTER TABLE "DownloadEntitlement" ADD COLUMN     "personalItemId" TEXT;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "personalDraftId" TEXT;

-- AlterTable
ALTER TABLE "Site" ADD COLUMN     "currencies" TEXT[] DEFAULT ARRAY['EUR']::TEXT[],
ADD COLUMN     "defaultLocale" TEXT NOT NULL DEFAULT 'fr',
ADD COLUMN     "kind" "SiteKind" NOT NULL DEFAULT 'CATALOG',
ADD COLUMN     "locales" TEXT[] DEFAULT ARRAY['fr']::TEXT[],
ADD COLUMN     "storefront" TEXT NOT NULL DEFAULT 'malle';

-- CreateTable
CREATE TABLE "PersonalizedProduct" (
    "productId" TEXT NOT NULL,
    "collectionKey" TEXT NOT NULL,
    "content" JSONB NOT NULL DEFAULT '{}',
    "prices" JSONB NOT NULL DEFAULT '{}',
    "deliveryDaysMin" INTEGER NOT NULL DEFAULT 3,
    "deliveryDaysMax" INTEGER NOT NULL DEFAULT 7,
    "pagesMin" INTEGER,
    "pagesMax" INTEGER,
    "formats" TEXT[] DEFAULT ARRAY['PDF']::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonalizedProduct_pkey" PRIMARY KEY ("productId")
);

-- CreateTable
CREATE TABLE "Questionnaire" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "QuestionnaireStatus" NOT NULL DEFAULT 'DRAFT',
    "definition" JSONB NOT NULL,
    "note" TEXT,
    "createdBy" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Questionnaire_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonalizationDraft" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "questionnaireId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "status" "PersonalizationDraftStatus" NOT NULL DEFAULT 'ACTIVE',
    "mode" TEXT NOT NULL DEFAULT 'self',
    "answers" JSONB NOT NULL DEFAULT '{}',
    "contributions" JSONB NOT NULL DEFAULT '[]',
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "email" TEXT,
    "giftRecipientName" TEXT,
    "giftRecipientEmail" TEXT,
    "giftMessage" TEXT,
    "sensitiveConsentAt" TIMESTAMP(3),
    "consentText" TEXT,
    "utm" JSONB,
    "orderId" TEXT,
    "resumeSentAt" TIMESTAMP(3),
    "lastResumedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonalizationDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonalOrderItem" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "productId" TEXT,
    "draftId" TEXT,
    "locale" TEXT NOT NULL,
    "status" "PersonalItemStatus" NOT NULL DEFAULT 'PENDING_GENERATION',
    "isGift" BOOLEAN NOT NULL DEFAULT false,
    "mode" TEXT NOT NULL DEFAULT 'self',
    "answers" JSONB NOT NULL DEFAULT '{}',
    "questionnaire" JSONB NOT NULL DEFAULT '{}',
    "studioRef" TEXT,
    "lastError" TEXT,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "fileKey" TEXT,
    "fileName" TEXT,
    "fileMime" TEXT,
    "fileSize" INTEGER,
    "productionStartedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "remindedAt" TIMESTAMP(3),
    "dataPurgedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonalOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GiftClaim" (
    "id" TEXT NOT NULL,
    "personalItemId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "recipientName" TEXT,
    "recipientEmail" TEXT,
    "message" TEXT,
    "answers" JSONB NOT NULL DEFAULT '{}',
    "sensitiveConsentAt" TIMESTAMP(3),
    "sendAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "revealedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GiftClaim_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Questionnaire_productId_status_idx" ON "Questionnaire"("productId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Questionnaire_productId_version_key" ON "Questionnaire"("productId", "version");

-- CreateIndex
CREATE INDEX "PersonalizationDraft_siteId_status_idx" ON "PersonalizationDraft"("siteId", "status");

-- CreateIndex
CREATE INDEX "PersonalizationDraft_expiresAt_idx" ON "PersonalizationDraft"("expiresAt");

-- CreateIndex
CREATE INDEX "PersonalizationDraft_orderId_idx" ON "PersonalizationDraft"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "PersonalOrderItem_orderItemId_key" ON "PersonalOrderItem"("orderItemId");

-- CreateIndex
CREATE INDEX "PersonalOrderItem_status_createdAt_idx" ON "PersonalOrderItem"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PersonalOrderItem_siteId_status_idx" ON "PersonalOrderItem"("siteId", "status");

-- CreateIndex
CREATE INDEX "PersonalOrderItem_orderId_idx" ON "PersonalOrderItem"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "GiftClaim_personalItemId_key" ON "GiftClaim"("personalItemId");

-- CreateIndex
CREATE UNIQUE INDEX "GiftClaim_tokenHash_key" ON "GiftClaim"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "DownloadEntitlement_personalItemId_key" ON "DownloadEntitlement"("personalItemId");

-- AddForeignKey
ALTER TABLE "DownloadEntitlement" ADD CONSTRAINT "DownloadEntitlement_personalItemId_fkey" FOREIGN KEY ("personalItemId") REFERENCES "PersonalOrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalizedProduct" ADD CONSTRAINT "PersonalizedProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Questionnaire" ADD CONSTRAINT "Questionnaire_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalizationDraft" ADD CONSTRAINT "PersonalizationDraft_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalizationDraft" ADD CONSTRAINT "PersonalizationDraft_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalizationDraft" ADD CONSTRAINT "PersonalizationDraft_questionnaireId_fkey" FOREIGN KEY ("questionnaireId") REFERENCES "Questionnaire"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalOrderItem" ADD CONSTRAINT "PersonalOrderItem_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalOrderItem" ADD CONSTRAINT "PersonalOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalOrderItem" ADD CONSTRAINT "PersonalOrderItem_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalOrderItem" ADD CONSTRAINT "PersonalOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftClaim" ADD CONSTRAINT "GiftClaim_personalItemId_fkey" FOREIGN KEY ("personalItemId") REFERENCES "PersonalOrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

