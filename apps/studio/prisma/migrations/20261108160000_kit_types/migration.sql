-- Types de kits (chasse au trésor, lutins farceurs…), personnalisation et contenu structuré
ALTER TYPE "IllustrationKind" ADD VALUE IF NOT EXISTS 'KIT';

ALTER TABLE "Book" ADD COLUMN "kitType" TEXT NOT NULL DEFAULT 'activites';
ALTER TABLE "Book" ADD COLUMN "customization" JSONB;
ALTER TABLE "Book" ADD COLUMN "kitContent" JSONB;

ALTER TABLE "Activity" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'activity';

ALTER TABLE "Illustration" ADD COLUMN "slot" TEXT;
CREATE INDEX "Illustration_bookId_slot_idx" ON "Illustration"("bookId", "slot");
