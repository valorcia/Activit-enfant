"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { assertPermission } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { slugifyUtm, withUtm } from "@/lib/social/attribution";
import { buildCopywriterPrompt, CHANNELS, parseCopywriterOutput, type Channel, type ProductBrief, type PostVariant } from "@/lib/social/copywriter";
import { generateWithClaude, isClaudeConfigured } from "@/lib/social/copywriter-claude";
import { publishSocialPost, syncCampaignSpend } from "@/lib/social/publish";
import { buildProductBrief, productLandingBase } from "@/lib/social/brief";
import { approveCampaignPosts } from "@/lib/social/autopilot";

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string; fields?: Record<string, string> };

function zodFields(e: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of e.issues) out[String(i.path[0] ?? "_")] = i.message;
  return out;
}
function fail(error: string, fields?: Record<string, string>): Result<never> { return { ok: false, error, fields }; }
function handle(e: unknown): Result<never> {
  console.error("[marketing-social]", e);
  return fail(e instanceof Error ? e.message : "Erreur inattendue");
}
function revalidate() {
  revalidatePath("/admin/marketing");
  revalidatePath("/admin/marketing/campagnes");
  revalidatePath("/admin/marketing/posts");
  revalidatePath("/admin/marketing/connecteurs");
}

// ---------------------------------------------------------------------------
// Comptes connectés
// ---------------------------------------------------------------------------

export async function disconnectAccountAction(accountId: string): Promise<Result> {
  try {
    const user = await assertPermission("marketing:write");
    await prisma.socialAccount.update({ where: { id: accountId }, data: { isActive: false, accessTokenEnc: "revoked", refreshTokenEnc: null } });
    await audit({ userId: user.id, action: "social.disconnect", entity: "socialAccount", entityId: accountId });
    revalidate();
    return { ok: true, data: undefined };
  } catch (e) { return handle(e); }
}

// ---------------------------------------------------------------------------
// Campagnes
// ---------------------------------------------------------------------------

const optionalInt = z.preprocess((v) => (v === "" || v == null ? undefined : v), z.coerce.number().int().min(0).optional());
const optionalDate = z.preprocess((v) => (v === "" || v == null ? undefined : v), z.coerce.date().optional());

const campaignSchema = z.object({
  name: z.string().min(2).max(120),
  slug: z.string().max(60).optional(),
  productId: z.string().optional().nullable(),
  objective: z.string().max(80).optional().nullable(),
  channel: z.enum(["META", "TIKTOK", "OTHER"]).default("META"),
  status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "ENDED"]).default("DRAFT"),
  utmSource: z.string().min(2).max(40),
  utmMedium: z.enum(["social", "paid"]).default("paid"),
  startsAt: optionalDate,
  endsAt: optionalDate,
  dailyBudgetCents: optionalInt,
  adAccountId: z.string().optional().nullable(),
  externalCampaignId: z.string().max(80).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export async function saveCampaignAction(id: string | null, raw: unknown): Promise<Result<{ id: string }>> {
  try {
    const user = await assertPermission("marketing:write");
    const parsed = campaignSchema.safeParse(raw);
    if (!parsed.success) return fail("Formulaire invalide", zodFields(parsed.error));
    const d = parsed.data;
    const product = d.productId ? await prisma.product.findUnique({ where: { id: d.productId }, select: { slug: true } }) : null;
    let slug = slugifyUtm(d.slug || d.name);
    const clash = await prisma.campaign.findUnique({ where: { slug } });
    if (clash && clash.id !== id) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
    const base = product ? `${env.appUrl}/aventures/${product.slug}` : `${env.appUrl}/boutique`;
    const landingUrl = withUtm(base, { utm_source: d.utmSource, utm_medium: d.utmMedium, utm_campaign: slug });
    const data = {
      name: d.name, slug, productId: d.productId || null, objective: d.objective ?? null, channel: d.channel, status: d.status,
      utmSource: d.utmSource, utmMedium: d.utmMedium, utmCampaign: slug, landingUrl,
      startsAt: d.startsAt ?? null, endsAt: d.endsAt ?? null, dailyBudgetCents: d.dailyBudgetCents ?? null,
      adAccountId: d.adAccountId || null, externalCampaignId: d.externalCampaignId || null, notes: d.notes ?? null,
    };
    const row = id ? await prisma.campaign.update({ where: { id }, data }) : await prisma.campaign.create({ data });
    await audit({ userId: user.id, action: id ? "campaign.update" : "campaign.create", entity: "campaign", entityId: row.id });
    revalidate();
    return { ok: true, data: { id: row.id } };
  } catch (e) { return handle(e); }
}

export async function deleteCampaignAction(id: string): Promise<Result> {
  try {
    const user = await assertPermission("marketing:write");
    await prisma.campaign.delete({ where: { id } });
    await audit({ userId: user.id, action: "campaign.delete", entity: "campaign", entityId: id });
    revalidate();
    return { ok: true, data: undefined };
  } catch (e) { return handle(e); }
}

export async function saveManualSpendAction(campaignId: string, raw: { date: string; spendEuros: string; impressions?: string; clicks?: string }): Promise<Result> {
  try {
    const user = await assertPermission("marketing:write");
    const date = new Date(`${raw.date}T00:00:00.000Z`);
    const spendCents = Math.round(Number(String(raw.spendEuros).replace(",", ".")) * 100);
    if (Number.isNaN(date.getTime()) || !Number.isFinite(spendCents) || spendCents < 0) return fail("Date ou montant invalide");
    const toInt = (v?: string) => (v && v.trim() !== "" ? Math.max(0, Math.round(Number(v))) : null);
    await prisma.adSpend.upsert({
      where: { campaignId_date_source: { campaignId, date, source: "MANUAL" } },
      create: { campaignId, date, source: "MANUAL", spendCents, impressions: toInt(raw.impressions), clicks: toInt(raw.clicks) },
      update: { spendCents, impressions: toInt(raw.impressions), clicks: toInt(raw.clicks) },
    });
    await audit({ userId: user.id, action: "campaign.spend", entity: "campaign", entityId: campaignId, data: { date: raw.date, spendCents } });
    revalidate();
    return { ok: true, data: undefined };
  } catch (e) { return handle(e); }
}

export async function deleteSpendAction(spendId: string): Promise<Result> {
  try {
    await assertPermission("marketing:write");
    await prisma.adSpend.delete({ where: { id: spendId } });
    revalidate();
    return { ok: true, data: undefined };
  } catch (e) { return handle(e); }
}

export async function syncSpendAction(campaignId: string, days = 30): Promise<Result<{ days: number }>> {
  try {
    const user = await assertPermission("marketing:write");
    const now = new Date();
    const r = await syncCampaignSpend(campaignId, new Date(now.getTime() - days * 86400_000), now);
    if (r.error) return fail(r.error);
    await audit({ userId: user.id, action: "campaign.spend_sync", entity: "campaign", entityId: campaignId, data: { days: r.days } });
    revalidate();
    return { ok: true, data: { days: r.days } };
  } catch (e) { return handle(e); }
}

// ---------------------------------------------------------------------------
// Génération de posts
// ---------------------------------------------------------------------------

async function briefFor(productId: string, campaignId?: string | null): Promise<{ brief: ProductBrief; images: string[]; linkUrl: string }> {
  const product = await prisma.product.findUniqueOrThrow({ where: { id: productId }, select: { slug: true } });
  const campaign = campaignId ? await prisma.campaign.findUnique({ where: { id: campaignId } }) : null;
  const linkUrl = campaign ? campaign.landingUrl : withUtm(productLandingBase(product.slug), { utm_source: "social", utm_medium: "social", utm_campaign: "organique" });
  const { brief, images } = await buildProductBrief(productId, linkUrl);
  return { brief, images, linkUrl };
}

const genSchema = z.object({ productId: z.string().min(1), campaignId: z.string().optional().nullable(), channels: z.array(z.enum(CHANNELS)).min(1), variants: z.coerce.number().int().min(1).max(5).default(3), videoUrl: z.string().max(600).optional().nullable() });

/** Prépare la génération : renvoie le prompt (pour le mode copier-coller) et indique si l'API Claude est disponible. */
export async function prepareGenerationAction(raw: unknown): Promise<Result<{ prompt: string; apiAvailable: boolean }>> {
  try {
    await assertPermission("marketing:write");
    const parsed = genSchema.safeParse(raw);
    if (!parsed.success) return fail("Paramètres invalides", zodFields(parsed.error));
    const { brief } = await briefFor(parsed.data.productId, parsed.data.campaignId);
    return { ok: true, data: { prompt: buildCopywriterPrompt(brief, parsed.data.channels as Channel[], parsed.data.variants), apiAvailable: await isClaudeConfigured() } };
  } catch (e) { return handle(e); }
}

function toProvider(channel: Channel): "META" | "TIKTOK" { return channel === "tiktok" ? "TIKTOK" : "META"; }
function toFormat(channel: Channel, video = false): "FEED_IMAGE" | "TIKTOK_PHOTO" | "AD_PRIMARY_TEXT" | "REEL_COVER" | "TIKTOK_VIDEO" {
  if (channel === "meta_ad") return "AD_PRIMARY_TEXT";
  if (channel === "tiktok") return video ? "TIKTOK_VIDEO" : "TIKTOK_PHOTO";
  return video ? "REEL_COVER" : "FEED_IMAGE";
}

/** `videoUrl` : vidéo publicitaire du produit à joindre (Reel / TikTok) ; la publicité Meta reste en texte + image. */
async function saveVariants(userId: string, productId: string, campaignId: string | null | undefined, variants: PostVariant[], generatedBy: "api" | "manual", videoUrl?: string | null) {
  const { images, linkUrl } = await briefFor(productId, campaignId);
  const created = await prisma.$transaction(variants.map((v) => prisma.socialPost.create({
    data: {
      productId, campaignId: campaignId || null, provider: toProvider(v.channel), format: toFormat(v.channel, !!videoUrl && v.channel !== "meta_ad"), status: "DRAFT", videoUrl: videoUrl && v.channel !== "meta_ad" ? videoUrl : null,
      hook: v.hook, body: v.body, cta: v.cta, headline: v.headline ?? null, hashtags: v.hashtags, imageUrls: v.imageIndex != null && images[v.imageIndex] ? [images[v.imageIndex]] : images.slice(0, 1),
      linkUrl, generatedBy, variantLabel: v.label, createdById: userId,
    },
  })));
  await audit({ userId, action: "social.generate", entity: "socialPost", data: { productId, count: created.length, generatedBy } });
  revalidate();
  return created.map((c) => c.id);
}

/** Génère via l'API Claude et enregistre les brouillons. */
export async function generateWithApiAction(raw: unknown): Promise<Result<{ ids: string[] }>> {
  try {
    const user = await assertPermission("marketing:write");
    const parsed = genSchema.safeParse(raw);
    if (!parsed.success) return fail("Paramètres invalides", zodFields(parsed.error));
    if (!(await isClaudeConfigured())) return fail("Clé Claude non configurée : utilisez le mode copier-coller ou renseignez-la dans Paramètres → Intégrations");
    const { brief } = await briefFor(parsed.data.productId, parsed.data.campaignId);
    const variants = await generateWithClaude(buildCopywriterPrompt(brief, parsed.data.channels as Channel[], parsed.data.variants));
    const ids = await saveVariants(user.id, parsed.data.productId, parsed.data.campaignId, variants, "api", parsed.data.videoUrl);
    return { ok: true, data: { ids } };
  } catch (e) { return handle(e); }
}

/** Mode copier-coller : valide le JSON collé et enregistre les brouillons. */
export async function importPastedVariantsAction(raw: { productId: string; campaignId?: string | null; pasted: string; videoUrl?: string | null }): Promise<Result<{ ids: string[] }>> {
  try {
    const user = await assertPermission("marketing:write");
    if (!raw.productId) return fail("Produit manquant");
    let variants: PostVariant[];
    try { variants = parseCopywriterOutput(raw.pasted); } catch (e) { return fail(`Réponse non reconnue : ${e instanceof Error ? e.message : "JSON invalide"}`); }
    const ids = await saveVariants(user.id, raw.productId, raw.campaignId, variants, "manual", raw.videoUrl);
    return { ok: true, data: { ids } };
  } catch (e) { return handle(e); }
}

// ---------------------------------------------------------------------------
// Posts : édition, programmation, publication
// ---------------------------------------------------------------------------

const postSchema = z.object({
  hook: z.string().max(300).optional().nullable(),
  body: z.string().min(1).max(4000),
  cta: z.string().max(120).optional().nullable(),
  headline: z.string().max(80).optional().nullable(),
  hashtags: z.preprocess((v) => (typeof v === "string" ? v.split(/[\s,]+/).filter(Boolean) : v ?? []), z.array(z.string().max(40)).max(30)),
  imageUrls: z.array(z.string().max(600)).max(10).default([]),
  videoUrl: z.string().max(600).optional().nullable(),
  accountId: z.string().optional().nullable(),
  campaignId: z.string().optional().nullable(),
  scheduledAt: optionalDate,
});

export async function updatePostAction(id: string, raw: unknown): Promise<Result> {
  try {
    const user = await assertPermission("marketing:write");
    const parsed = postSchema.safeParse(raw);
    if (!parsed.success) return fail("Formulaire invalide", zodFields(parsed.error));
    const d = parsed.data;
    const post = await prisma.socialPost.findUniqueOrThrow({ where: { id } });
    const campaign = d.campaignId ? await prisma.campaign.findUnique({ where: { id: d.campaignId } }) : null;
    const linkUrl = campaign ? withUtm(campaign.landingUrl, { utm_source: campaign.utmSource, utm_medium: campaign.utmMedium, utm_campaign: campaign.utmCampaign, utm_content: id }) : post.linkUrl;
    await prisma.socialPost.update({
      where: { id },
      data: { hook: d.hook ?? null, body: d.body, cta: d.cta ?? null, headline: d.headline ?? null, hashtags: d.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)), imageUrls: d.imageUrls, ...(d.videoUrl !== undefined ? { videoUrl: d.videoUrl || null } : {}), accountId: d.accountId || null, campaignId: d.campaignId || null, linkUrl, scheduledAt: d.scheduledAt ?? null, status: post.status === "PUBLISHED" ? post.status : d.scheduledAt ? "SCHEDULED" : "DRAFT", error: null },
    });
    await audit({ userId: user.id, action: "social.post.update", entity: "socialPost", entityId: id });
    revalidate();
    return { ok: true, data: undefined };
  } catch (e) { return handle(e); }
}

export async function publishPostNowAction(id: string): Promise<Result> {
  try {
    const user = await assertPermission("marketing:write");
    const r = await publishSocialPost(id);
    await audit({ userId: user.id, action: "social.post.publish", entity: "socialPost", entityId: id, data: { ok: r.ok, error: r.error } });
    revalidate();
    return r.ok ? { ok: true, data: undefined } : fail(r.error ?? "Échec de publication");
  } catch (e) { return handle(e); }
}

/** Publication manuelle (mode dégradé) : marque le post comme publié avec l'URL saisie. */
export async function markPublishedManuallyAction(id: string, externalUrl?: string | null): Promise<Result> {
  try {
    const user = await assertPermission("marketing:write");
    await prisma.socialPost.update({ where: { id }, data: { status: "PUBLISHED", publishedAt: new Date(), externalUrl: externalUrl || null, error: null } });
    await audit({ userId: user.id, action: "social.post.manual_publish", entity: "socialPost", entityId: id });
    revalidate();
    return { ok: true, data: undefined };
  } catch (e) { return handle(e); }
}

export async function deletePostAction(id: string): Promise<Result> {
  try {
    const user = await assertPermission("marketing:write");
    await prisma.socialPost.delete({ where: { id } });
    await audit({ userId: user.id, action: "social.post.delete", entity: "socialPost", entityId: id });
    revalidate();
    return { ok: true, data: undefined };
  } catch (e) { return handle(e); }
}

// ---------------------------------------------------------------------------
// Autopilote : validation humaine des campagnes créées par l'API
// ---------------------------------------------------------------------------

/** Passe les posts brouillons d'une campagne autopilote en programmés (comptes connectés uniquement). */
export async function approveAutopilotCampaignAction(campaignId: string, raw: { startAt?: string | null; spacingHours?: number } = {}): Promise<Result<{ scheduled: number; skipped: number; reason: string | null }>> {
  try {
    const user = await assertPermission("marketing:write");
    const startAt = raw.startAt ? new Date(raw.startAt) : null;
    if (startAt && Number.isNaN(startAt.getTime())) return fail("Date de début invalide");
    const r = await approveCampaignPosts(campaignId, { startAt, spacingHours: raw.spacingHours });
    await audit({ userId: user.id, action: "campaign.autopilot_approve", entity: "campaign", entityId: campaignId, data: { scheduled: r.scheduled, skipped: r.skipped } });
    revalidate();
    revalidatePath("/admin/marketing/autopilote");
    return { ok: true, data: { scheduled: r.scheduled, skipped: r.skipped, reason: r.reason } };
  } catch (e) { return handle(e); }
}
