-- Mode copier-coller : nouveau statut de tâche et demandes manuelles
ALTER TYPE "JobStatus" ADD VALUE 'WAITING_INPUT';

CREATE TYPE "ManualRequestKind" AS ENUM ('TEXT', 'IMAGE');
CREATE TYPE "ManualRequestStatus" AS ENUM ('PENDING', 'DONE', 'CANCELLED');

CREATE TABLE "ManualRequest" (
    "id" TEXT NOT NULL,
    "kind" "ManualRequestKind" NOT NULL,
    "status" "ManualRequestStatus" NOT NULL DEFAULT 'PENDING',
    "fingerprint" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "expectedFormat" TEXT,
    "schemaName" TEXT,
    "purpose" TEXT,
    "params" JSONB,
    "bookId" TEXT,
    "activityId" TEXT,
    "jobId" TEXT,
    "responseText" TEXT,
    "assetId" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "ManualRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ManualRequest_fingerprint_key" ON "ManualRequest"("fingerprint");
CREATE INDEX "ManualRequest_status_createdAt_idx" ON "ManualRequest"("status", "createdAt");
CREATE INDEX "ManualRequest_jobId_idx" ON "ManualRequest"("jobId");
CREATE INDEX "ManualRequest_bookId_idx" ON "ManualRequest"("bookId");

ALTER TABLE "ManualRequest" ADD CONSTRAINT "ManualRequest_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
