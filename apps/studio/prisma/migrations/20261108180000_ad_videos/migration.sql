-- Vidéos publicitaires
ALTER TYPE "ManualRequestKind" ADD VALUE IF NOT EXISTS 'VIDEO';

CREATE TYPE "AdVideoStatus" AS ENUM ('QUEUED', 'RENDERING', 'WAITING_CLIP', 'READY', 'FAILED');

CREATE TABLE "AdVideo" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "status" "AdVideoStatus" NOT NULL DEFAULT 'QUEUED',
    "step" TEXT,
    "props" JSONB NOT NULL,
    "clipProvider" TEXT NOT NULL DEFAULT 'none',
    "clipPrompt" TEXT,
    "clipDurationSeconds" INTEGER,
    "clipSourceAssetId" TEXT,
    "clipJobId" TEXT,
    "clipStartedAt" TIMESTAMP(3),
    "clipAssetId" TEXT,
    "assetId" TEXT,
    "thumbnailAssetId" TEXT,
    "durationSeconds" INTEGER NOT NULL DEFAULT 15,
    "costUsd" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "shopVideoUrl" TEXT,
    "jobId" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdVideo_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AdVideo_bookId_createdAt_idx" ON "AdVideo"("bookId", "createdAt");
CREATE INDEX "AdVideo_status_idx" ON "AdVideo"("status");

ALTER TABLE "AdVideo" ADD CONSTRAINT "AdVideo_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdVideo" ADD CONSTRAINT "AdVideo_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AdVideo" ADD CONSTRAINT "AdVideo_thumbnailAssetId_fkey" FOREIGN KEY ("thumbnailAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AdVideo" ADD CONSTRAINT "AdVideo_clipAssetId_fkey" FOREIGN KEY ("clipAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
