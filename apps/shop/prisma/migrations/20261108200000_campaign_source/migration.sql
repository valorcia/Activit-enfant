-- Origine d'une campagne : admin (création manuelle) ou api (autopilote du studio)
ALTER TABLE "Campaign" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'admin';
CREATE INDEX "Campaign_source_idx" ON "Campaign"("source");
