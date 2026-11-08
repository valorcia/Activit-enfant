-- CreateEnum
CREATE TYPE "SiteStatus" AS ENUM ('ACTIVE', 'TEST', 'ARCHIVED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ProductTemplate" ADD VALUE 'GUIDE';
ALTER TYPE "ProductTemplate" ADD VALUE 'RECIPES';

-- DropIndex
DROP INDEX "BlogPost_slug_key";

-- DropIndex
DROP INDEX "Category_slug_key";

-- DropIndex
DROP INDEX "Collection_slug_key";

-- DropIndex
DROP INDEX "NewsletterSubscriber_email_key";

-- DropIndex
DROP INDEX "StaticPage_slug_key";

-- AlterTable
ALTER TABLE "BlogPost" ADD COLUMN     "siteId" TEXT NOT NULL DEFAULT 'site-default';

-- AlterTable
ALTER TABLE "Bundle" ADD COLUMN     "siteId" TEXT NOT NULL DEFAULT 'site-default';

-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "siteId" TEXT NOT NULL DEFAULT 'site-default';

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "siteId" TEXT NOT NULL DEFAULT 'site-default';

-- AlterTable
ALTER TABLE "Collection" ADD COLUMN     "siteId" TEXT NOT NULL DEFAULT 'site-default';

-- AlterTable
ALTER TABLE "NewsletterSubscriber" ADD COLUMN     "siteId" TEXT NOT NULL DEFAULT 'site-default';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "siteId" TEXT NOT NULL DEFAULT 'site-default';

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "siteId" TEXT NOT NULL DEFAULT 'site-default';

-- AlterTable
ALTER TABLE "SocialAccount" ADD COLUMN     "audienceId" TEXT;

-- AlterTable
ALTER TABLE "StaticPage" ADD COLUMN     "siteId" TEXT NOT NULL DEFAULT 'site-default';

-- CreateTable
CREATE TABLE "Audience" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Audience_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Site" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "audienceId" TEXT NOT NULL,
    "preset" TEXT NOT NULL DEFAULT 'kit-enfants',
    "status" "SiteStatus" NOT NULL DEFAULT 'TEST',
    "domains" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "primaryDomain" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Site_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Audience_slug_key" ON "Audience"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Site_slug_key" ON "Site"("slug");

-- CreateIndex
CREATE INDEX "Site_status_idx" ON "Site"("status");

-- CreateIndex
CREATE UNIQUE INDEX "BlogPost_siteId_slug_key" ON "BlogPost"("siteId", "slug");

-- CreateIndex
CREATE INDEX "Bundle_siteId_status_idx" ON "Bundle"("siteId", "status");

-- CreateIndex
CREATE INDEX "Campaign_siteId_idx" ON "Campaign"("siteId");

-- CreateIndex
CREATE INDEX "Category_siteId_position_idx" ON "Category"("siteId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "Category_siteId_slug_key" ON "Category"("siteId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "Collection_siteId_slug_key" ON "Collection"("siteId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "NewsletterSubscriber_siteId_email_key" ON "NewsletterSubscriber"("siteId", "email");

-- CreateIndex
CREATE INDEX "Order_siteId_createdAt_idx" ON "Order"("siteId", "createdAt");

-- CreateIndex
CREATE INDEX "Product_siteId_status_publishedAt_idx" ON "Product"("siteId", "status", "publishedAt");

-- CreateIndex
CREATE INDEX "SocialAccount_audienceId_idx" ON "SocialAccount"("audienceId");

-- CreateIndex
CREATE UNIQUE INDEX "StaticPage_siteId_slug_key" ON "StaticPage"("siteId", "slug");


-- Données : 4 audiences initiales et l'univers par défaut « La Malle à Jeux »,
-- qui reçoit toutes les lignes existantes (DEFAULT 'site-default' ci-dessus).
INSERT INTO "Audience" ("id", "slug", "name", "description", "color") VALUES
  ('aud-familles-enfants', 'familles-enfants', 'Familles & enfants', 'Parents d''enfants de 3 à 10 ans : jeux, sciences, histoires, cuisine avec les enfants.', '#FF826F'),
  ('aud-maison-jardin', 'maison-jardin', 'Maison & jardin', 'Propriétaires : piscine, jardin, entretien, bricolage.', '#0E7490'),
  ('aud-cuisine', 'cuisine', 'Cuisine', 'Amateurs de cuisine du quotidien et de recettes.', '#C2410C'),
  ('aud-vie-pratique', 'vie-pratique', 'Vie pratique', 'Bonnes pratiques au quotidien : organisation, budget, santé, administratif.', '#7C3AED')
ON CONFLICT DO NOTHING;

INSERT INTO "Site" ("id", "slug", "name", "audienceId", "preset", "status", "domains", "primaryDomain", "isDefault", "settings", "updatedAt")
VALUES ('site-default', 'la-malle-a-jeux', 'La Malle à Jeux', 'aud-familles-enfants', 'kit-enfants', 'ACTIVE', ARRAY[]::TEXT[], NULL, true,
        COALESCE((SELECT jsonb_object_agg("key", "value") FROM "SiteSetting" WHERE "key" IN ('brand', 'theme', 'homepage', 'navigation', 'seo', 'analytics', 'conversion')), '{}'::jsonb), CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Collection" ADD CONSTRAINT "Collection_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bundle" ADD CONSTRAINT "Bundle_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlogPost" ADD CONSTRAINT "BlogPost_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsletterSubscriber" ADD CONSTRAINT "NewsletterSubscriber_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Site" ADD CONSTRAINT "Site_audienceId_fkey" FOREIGN KEY ("audienceId") REFERENCES "Audience"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaticPage" ADD CONSTRAINT "StaticPage_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialAccount" ADD CONSTRAINT "SocialAccount_audienceId_fkey" FOREIGN KEY ("audienceId") REFERENCES "Audience"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

