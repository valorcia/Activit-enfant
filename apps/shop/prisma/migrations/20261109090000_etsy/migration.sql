-- Etsy : boutique connectée (compte SHOP), fiches publiées et ventes importées

-- AlterEnum
ALTER TYPE "SocialProvider" ADD VALUE 'ETSY';
ALTER TYPE "SocialAccountKind" ADD VALUE 'SHOP';

-- CreateEnum
CREATE TYPE "SalesChannel" AS ENUM ('ETSY');

-- AlterTable
ALTER TABLE "SocialAccount" ADD COLUMN "siteIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "EtsyListing" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "etsyListingId" TEXT,
    "state" TEXT NOT NULL DEFAULT 'pending',
    "url" TEXT,
    "priceCents" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "overrides" JSONB,
    "imagesHash" TEXT,
    "filesHash" TEXT,
    "remoteImages" JSONB,
    "remoteFiles" JSONB,
    "lastSyncedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EtsyListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalSale" (
    "id" TEXT NOT NULL,
    "channel" "SalesChannel" NOT NULL,
    "externalId" TEXT NOT NULL,
    "accountId" TEXT,
    "productId" TEXT,
    "siteId" TEXT,
    "listingId" TEXT,
    "etsyListingId" TEXT,
    "receiptId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "grossCents" INTEGER NOT NULL,
    "feesCents" INTEGER,
    "netCents" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "soldAt" TIMESTAMP(3) NOT NULL,
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExternalSale_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EtsyListing_etsyListingId_key" ON "EtsyListing"("etsyListingId");
CREATE INDEX "EtsyListing_accountId_state_idx" ON "EtsyListing"("accountId", "state");
CREATE UNIQUE INDEX "EtsyListing_productId_accountId_key" ON "EtsyListing"("productId", "accountId");
CREATE UNIQUE INDEX "ExternalSale_externalId_key" ON "ExternalSale"("externalId");
CREATE INDEX "ExternalSale_channel_soldAt_idx" ON "ExternalSale"("channel", "soldAt");
CREATE INDEX "ExternalSale_productId_soldAt_idx" ON "ExternalSale"("productId", "soldAt");
CREATE INDEX "ExternalSale_siteId_soldAt_idx" ON "ExternalSale"("siteId", "soldAt");

-- AddForeignKey
ALTER TABLE "EtsyListing" ADD CONSTRAINT "EtsyListing_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EtsyListing" ADD CONSTRAINT "EtsyListing_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "SocialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExternalSale" ADD CONSTRAINT "ExternalSale_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "SocialAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ExternalSale" ADD CONSTRAINT "ExternalSale_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ExternalSale" ADD CONSTRAINT "ExternalSale_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "EtsyListing"("id") ON DELETE SET NULL ON UPDATE CASCADE;
