-- Synchronisation des livres avec la boutique (apps/shop, API v1)
ALTER TABLE "Book" ADD COLUMN "shopProductId" TEXT;
ALTER TABLE "Book" ADD COLUMN "shopProductSlug" TEXT;
ALTER TABLE "Book" ADD COLUMN "shopPublishedAt" TIMESTAMP(3);
ALTER TABLE "Book" ADD COLUMN "shopLastSyncAt" TIMESTAMP(3);
ALTER TABLE "Book" ADD COLUMN "shopSyncError" TEXT;
ALTER TABLE "Book" ADD COLUMN "shopListing" JSONB;
