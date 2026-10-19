-- CreateEnum
CREATE TYPE "BookStatus" AS ENUM ('DRAFT', 'PLANNED', 'GENERATING', 'REVIEW', 'READY', 'EXPORTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ActivityStatus" AS ENUM ('CONCEPT', 'DRAFT', 'REVIEW', 'BLOCKED', 'VALIDATED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "IllustrationKind" AS ENUM ('FINAL', 'STEP', 'COVER', 'MATERIAL');

-- CreateEnum
CREATE TYPE "IllustrationStatus" AS ENUM ('PENDING', 'GENERATING', 'GENERATED', 'ACCEPTED', 'REJECTED', 'FAILED');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('QUEUED', 'RUNNING', 'PAUSED', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ExportKind" AS ENUM ('BOOK_PRINT', 'BOOK_DIGITAL', 'ACTIVITY', 'ACTIVITY_SHEETS', 'COVER');

-- CreateEnum
CREATE TYPE "ExportStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "IssueSeverity" AS ENUM ('INFO', 'WARNING', 'ERROR', 'BLOCKER');

-- CreateTable
CREATE TABLE "Book" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "collection" TEXT,
    "bookType" TEXT NOT NULL,
    "ageRange" TEXT NOT NULL,
    "targetCount" INTEGER NOT NULL DEFAULT 10,
    "artStyle" TEXT NOT NULL,
    "pageFormat" TEXT NOT NULL DEFAULT 'A4_PORTRAIT',
    "customWidthMm" INTEGER,
    "customHeightMm" INTEGER,
    "language" TEXT NOT NULL DEFAULT 'fr',
    "status" "BookStatus" NOT NULL DEFAULT 'DRAFT',
    "brief" TEXT,
    "cover" JSONB,
    "theme" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Book_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookActivity" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "BookActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookSnapshot" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "label" TEXT,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "ageRange" TEXT NOT NULL,
    "difficulty" INTEGER NOT NULL DEFAULT 2,
    "durationMinutes" INTEGER NOT NULL DEFAULT 30,
    "status" "ActivityStatus" NOT NULL DEFAULT 'CONCEPT',
    "concept" JSONB,
    "currentVersionId" TEXT,
    "contentHash" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "safetyBlocked" BOOLEAN NOT NULL DEFAULT false,
    "safetyNotes" TEXT,
    "validatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityVersion" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "content" JSONB NOT NULL,
    "note" TEXT,
    "source" TEXT NOT NULL DEFAULT 'ai',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisualReference" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VisualReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "sha256" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Illustration" (
    "id" TEXT NOT NULL,
    "activityId" TEXT,
    "bookId" TEXT,
    "kind" "IllustrationKind" NOT NULL,
    "stepIndex" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,
    "parentId" TEXT,
    "status" "IllustrationStatus" NOT NULL DEFAULT 'PENDING',
    "prompt" TEXT,
    "negative" TEXT,
    "provider" TEXT,
    "model" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "assetId" TEXT,
    "costUsd" DECIMAL(10,5),
    "reviewNote" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Illustration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookPage" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "activityId" TEXT,
    "position" INTEGER NOT NULL,
    "templateKey" TEXT NOT NULL,
    "layout" JSONB NOT NULL,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Template" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "theme" JSONB NOT NULL,
    "builtin" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Export" (
    "id" TEXT NOT NULL,
    "bookId" TEXT,
    "snapshotId" TEXT,
    "activityId" TEXT,
    "kind" "ExportKind" NOT NULL,
    "status" "ExportStatus" NOT NULL DEFAULT 'QUEUED',
    "label" TEXT,
    "assetId" TEXT,
    "pageCount" INTEGER,
    "checks" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Export_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "queueJobId" TEXT,
    "type" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "bookId" TEXT,
    "activityId" TEXT,
    "parentId" TEXT,
    "payload" JSONB,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "step" TEXT,
    "result" JSONB,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "costUsd" DECIMAL(10,5) NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobLog" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'info',
    "message" TEXT NOT NULL,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GenerationLog" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "bookId" TEXT,
    "activityId" TEXT,
    "jobId" TEXT,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "images" INTEGER,
    "costUsd" DECIMAL(10,5) NOT NULL DEFAULT 0,
    "durationMs" INTEGER,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GenerationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QualityIssue" (
    "id" TEXT NOT NULL,
    "bookId" TEXT,
    "activityId" TEXT,
    "pageId" TEXT,
    "severity" "IssueSeverity" NOT NULL,
    "code" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QualityIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "Book_status_idx" ON "Book"("status");

-- CreateIndex
CREATE INDEX "BookActivity_bookId_position_idx" ON "BookActivity"("bookId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "BookActivity_bookId_activityId_key" ON "BookActivity"("bookId", "activityId");

-- CreateIndex
CREATE UNIQUE INDEX "BookSnapshot_bookId_version_key" ON "BookSnapshot"("bookId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "Activity_slug_key" ON "Activity"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Activity_currentVersionId_key" ON "Activity"("currentVersionId");

-- CreateIndex
CREATE INDEX "Activity_status_idx" ON "Activity"("status");

-- CreateIndex
CREATE INDEX "Activity_category_ageRange_idx" ON "Activity"("category", "ageRange");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityVersion_activityId_number_key" ON "ActivityVersion"("activityId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "VisualReference_activityId_key" ON "VisualReference"("activityId");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_key_key" ON "Asset"("key");

-- CreateIndex
CREATE INDEX "Illustration_activityId_kind_stepIndex_idx" ON "Illustration"("activityId", "kind", "stepIndex");

-- CreateIndex
CREATE INDEX "Illustration_bookId_kind_idx" ON "Illustration"("bookId", "kind");

-- CreateIndex
CREATE INDEX "Illustration_status_idx" ON "Illustration"("status");

-- CreateIndex
CREATE INDEX "BookPage_bookId_position_idx" ON "BookPage"("bookId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "Template_key_key" ON "Template"("key");

-- CreateIndex
CREATE INDEX "Export_bookId_createdAt_idx" ON "Export"("bookId", "createdAt");

-- CreateIndex
CREATE INDEX "Job_bookId_createdAt_idx" ON "Job"("bookId", "createdAt");

-- CreateIndex
CREATE INDEX "Job_status_idx" ON "Job"("status");

-- CreateIndex
CREATE INDEX "JobLog_jobId_createdAt_idx" ON "JobLog"("jobId", "createdAt");

-- CreateIndex
CREATE INDEX "GenerationLog_createdAt_idx" ON "GenerationLog"("createdAt");

-- CreateIndex
CREATE INDEX "GenerationLog_bookId_idx" ON "GenerationLog"("bookId");

-- CreateIndex
CREATE INDEX "QualityIssue_bookId_resolved_idx" ON "QualityIssue"("bookId", "resolved");

-- CreateIndex
CREATE INDEX "QualityIssue_activityId_resolved_idx" ON "QualityIssue"("activityId", "resolved");

-- AddForeignKey
ALTER TABLE "BookActivity" ADD CONSTRAINT "BookActivity_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookActivity" ADD CONSTRAINT "BookActivity_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookSnapshot" ADD CONSTRAINT "BookSnapshot_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "ActivityVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityVersion" ADD CONSTRAINT "ActivityVersion_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisualReference" ADD CONSTRAINT "VisualReference_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Illustration" ADD CONSTRAINT "Illustration_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Illustration" ADD CONSTRAINT "Illustration_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Illustration" ADD CONSTRAINT "Illustration_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookPage" ADD CONSTRAINT "BookPage_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookPage" ADD CONSTRAINT "BookPage_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Export" ADD CONSTRAINT "Export_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Export" ADD CONSTRAINT "Export_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "BookSnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Export" ADD CONSTRAINT "Export_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobLog" ADD CONSTRAINT "JobLog_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityIssue" ADD CONSTRAINT "QualityIssue_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityIssue" ADD CONSTRAINT "QualityIssue_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
