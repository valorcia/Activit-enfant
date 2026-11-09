import "server-only";
import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/db";
import { env } from "@/lib/env";
import { getConnector, withToken, SocialApiError } from "./index";
import { composePostText } from "./copywriter";

function absolute(url: string): string {
  return url.startsWith("http") ? url : `${env.appUrl}${url.startsWith("/") ? "" : "/"}${url}`;
}

export function channelOfPost(post: { provider: "META" | "TIKTOK"; account?: { kind: string } | null; format: string }): string {
  if (post.provider === "TIKTOK") return "tiktok";
  if (post.format === "AD_PRIMARY_TEXT") return "meta_ad";
  return post.account?.kind === "INSTAGRAM" ? "instagram" : "facebook";
}

/**
 * Publie un post via le connecteur de son compte. Met à jour le statut, l'URL
 * externe et, en cas de jeton invalide, marque le compte « à reconnecter ».
 */
export async function publishSocialPost(postId: string, db: PrismaClient = defaultPrisma): Promise<{ ok: boolean; error?: string }> {
  const post = await db.socialPost.findUnique({ where: { id: postId }, include: { account: true } });
  if (!post) return { ok: false, error: "Post introuvable" };
  if (!post.account) return { ok: false, error: "Aucun compte sélectionné : utilisez la publication manuelle" };
  if (post.account.needsReconnect || !post.account.isActive) return { ok: false, error: "Compte à reconnecter" };

  await db.socialPost.update({ where: { id: postId }, data: { status: "PUBLISHING", error: null } });
  try {
    if (post.provider === "ETSY") throw new SocialApiError("Les fiches Etsy se publient depuis l'onglet Etsy du produit");
    const connector = getConnector(post.provider);
    const text = composePostText({ hook: post.hook, body: post.body, cta: post.cta, hashtags: post.hashtags, linkUrl: post.linkUrl }, channelOfPost({ ...post, provider: post.provider }));
    let result;
    if (post.videoUrl) {
      if (!connector.publishVideoPost) throw new SocialApiError("Publication vidéo non prise en charge pour ce réseau : publiez-la manuellement");
      result = await connector.publishVideoPost(withToken(post.account), { text, videoUrl: absolute(post.videoUrl), coverUrl: post.imageUrls[0] ? absolute(post.imageUrls[0]) : null, linkUrl: post.linkUrl });
    } else {
      result = await connector.publishPhotoPost(withToken(post.account), { text, imageUrls: post.imageUrls.map(absolute), linkUrl: post.linkUrl });
    }
    await db.socialPost.update({ where: { id: postId }, data: { status: "PUBLISHED", publishedAt: new Date(), externalPostId: result.externalPostId, externalUrl: result.externalUrl ?? null } });
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await db.socialPost.update({ where: { id: postId }, data: { status: "FAILED", error: message.slice(0, 500) } });
    if (e instanceof SocialApiError && e.reconnect) {
      await db.socialAccount.update({ where: { id: post.account.id }, data: { needsReconnect: true } });
    }
    return { ok: false, error: message };
  }
}

/** Synchronise les dépenses d'une campagne depuis le compte publicitaire lié. */
export async function syncCampaignSpend(campaignId: string, since: Date, until: Date, db: PrismaClient = defaultPrisma): Promise<{ days: number; error?: string }> {
  const campaign = await db.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign?.externalCampaignId || !campaign.adAccountId) return { days: 0, error: "Campagne non liée à un compte publicitaire" };
  const account = await db.socialAccount.findUnique({ where: { id: campaign.adAccountId } });
  if (!account || account.kind !== "AD_ACCOUNT") return { days: 0, error: "Compte publicitaire introuvable" };
  try {
    const rows = await getConnector(account.provider).getCampaignSpend(withToken(account), campaign.externalCampaignId, since, until);
    for (const r of rows) {
      const date = new Date(`${r.date}T00:00:00.000Z`);
      await db.adSpend.upsert({
        where: { campaignId_date_source: { campaignId, date, source: "API" } },
        create: { campaignId, date, source: "API", spendCents: r.spendCents, impressions: r.impressions, clicks: r.clicks, raw: r.raw as object },
        update: { spendCents: r.spendCents, impressions: r.impressions, clicks: r.clicks, raw: r.raw as object },
      });
    }
    return { days: rows.length };
  } catch (e) {
    if (e instanceof SocialApiError && e.reconnect) await db.socialAccount.update({ where: { id: account.id }, data: { needsReconnect: true } });
    return { days: 0, error: e instanceof Error ? e.message : String(e) };
  }
}
