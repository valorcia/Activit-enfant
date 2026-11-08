-- Pilote automatique : d'un brief à la campagne publicitaire
CREATE TYPE "AutopilotStatus" AS ENUM ('RUNNING', 'WAITING_INPUT', 'WAITING_APPROVAL', 'COMPLETED', 'FAILED', 'CANCELLED');

CREATE TABLE "AutopilotRun" (
    "id" TEXT NOT NULL,
    "bookId" TEXT,
    "jobId" TEXT,
    "status" "AutopilotStatus" NOT NULL DEFAULT 'RUNNING',
    "title" TEXT,
    "brief" TEXT,
    "stages" JSONB NOT NULL,
    "config" JSONB NOT NULL,
    "state" JSONB,
    "costUsd" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "maxCostUsd" DECIMAL(10,2) NOT NULL DEFAULT 10,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutopilotRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AutopilotRun_status_idx" ON "AutopilotRun"("status");
CREATE INDEX "AutopilotRun_bookId_createdAt_idx" ON "AutopilotRun"("bookId", "createdAt");

ALTER TABLE "AutopilotRun" ADD CONSTRAINT "AutopilotRun_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE SET NULL ON UPDATE CASCADE;
