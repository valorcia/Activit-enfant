-- CreateTable
CREATE TABLE "SiteEvent" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "visitorId" TEXT,
    "sessionId" TEXT,
    "path" TEXT,
    "productId" TEXT,
    "value" INTEGER,
    "source" TEXT,
    "medium" TEXT,
    "campaign" TEXT,
    "device" TEXT,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiteEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SiteEvent_siteId_createdAt_idx" ON "SiteEvent"("siteId", "createdAt");

-- CreateIndex
CREATE INDEX "SiteEvent_siteId_type_createdAt_idx" ON "SiteEvent"("siteId", "type", "createdAt");
