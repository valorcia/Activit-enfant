import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/db";
import { publishSocialPost, syncCampaignSpend } from "./publish";

/** Tâches planifiées du marketing social (appelées par le cron marketing). */
export async function runSocialJobs(db: PrismaClient = defaultPrisma, now = new Date()): Promise<{ published: number; failed: number; spendSynced: number }> {
  // (a) Posts programmés dont l'heure est passée
  const due = await db.socialPost.findMany({ where: { status: "SCHEDULED", scheduledAt: { lte: now }, accountId: { not: null } }, select: { id: true }, take: 20 });
  let published = 0;
  let failed = 0;
  for (const p of due) {
    const r = await publishSocialPost(p.id, db);
    if (r.ok) published++; else failed++;
  }
  // (b) Dépenses publicitaires des campagnes actives liées à un compte (J-2 → J)
  const campaigns = await db.campaign.findMany({ where: { status: "ACTIVE", externalCampaignId: { not: null }, adAccountId: { not: null } }, select: { id: true } });
  let spendSynced = 0;
  const since = new Date(now.getTime() - 2 * 86400_000);
  for (const c of campaigns) {
    const r = await syncCampaignSpend(c.id, since, now, db);
    spendSynced += r.days;
  }
  return { published, failed, spendSynced };
}
