import "server-only";
import { z } from "zod";
import type { CampaignChannel, PrismaClient, SocialAccountKind, SocialPostFormat, SocialPostStatus } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/db";
import { env } from "@/lib/env";
import { audit } from "@/lib/audit";
import { parseVideoAlt, type VideoFormat } from "@/lib/api/video";
import { slugifyUtm, withUtm } from "./attribution";
import { buildCopywriterPrompt, copywriterOutputSchema, type Channel, type PostVariant } from "./copywriter";
import { generateWithClaude, isClaudeConfigured } from "./copywriter-claude";
import { buildProductBrief, productLandingBase } from "./brief";
import { campaignRoi, periodFromKey } from "./roi";
import { accountsForAudience } from "./accounts";

/**
 * Autopilote marketing : crée en un appel la campagne tracée et les publications
 * d'un produit (texte généré par Claude ou fourni par le studio en mode copier-coller).
 *
 * Choix de modèle : UNE campagne par appel (un seul `utm_campaign`), même multi-canaux.
 * `Campaign.channel` vaut META si tous les canaux sont Meta (Instagram/Facebook),
 * TIKTOK si seul TikTok est demandé, OTHER sinon. Chaque post porte son propre
 * `utm_source` (instagram | facebook | tiktok) et `utm_content` = id du post, ce qui
 * garde l'attribution par canal et par publication.
 */

export const AUTOPILOT_CHANNELS = ["instagram", "facebook", "tiktok"] as const;
export type AutopilotChannel = (typeof AUTOPILOT_CHANNELS)[number];

export const autopilotInputSchema = z.object({
  channels: z.array(z.enum(AUTOPILOT_CHANNELS)).min(1, "Au moins un canal").transform((c) => [...new Set(c)]),
  variantsPerChannel: z.coerce.number().int().min(1).max(3).default(2),
  videoUrls: z.array(z.string().url()).max(10).optional().default([]),
  copy: z.unknown().optional().nullable(),
  campaign: z.object({
    name: z.string().min(2).max(120).optional(),
    dailyBudgetCents: z.coerce.number().int().min(0).max(10_000_00).optional().nullable(),
    startsAt: z.coerce.date().optional().nullable(),
    objective: z.string().max(80).optional().nullable(),
  }).optional().default({}),
  schedule: z.object({
    mode: z.enum(["draft", "auto"]).default("draft"),
    startAt: z.coerce.date().optional().nullable(),
    spacingHours: z.coerce.number().min(1).max(24 * 14).default(24),
  }).optional().default({ mode: "draft", startAt: null, spacingHours: 24 }),
});
export type AutopilotInput = z.input<typeof autopilotInputSchema>;

export const COPY_SCHEMA_HELP =
  'JSON {"variants":[{"channel":"instagram|facebook|tiktok","label":"angle","hook":"accroche","body":"texte","cta":"appel à l\'action","headline":null,"hashtags":["#..."],"imageIndex":0}]} — une entrée par variante et par canal demandé.';

export type AutopilotResult =
  | { ok: true; data: AutopilotData }
  | { ok: false; status: 404 | 409 | 422; error: string; details?: unknown };

export interface AutopilotPostSummary { id: string; channel: AutopilotChannel; format: SocialPostFormat; status: SocialPostStatus; scheduledAt: string | null; accountName: string | null }
export interface AutopilotData {
  campaignId: string;
  campaignSlug: string;
  landingUrl: string;
  adminUrl: string;
  posts: AutopilotPostSummary[];
  generatedBy: "api" | "provided";
}

export function campaignChannelFor(channels: AutopilotChannel[]): CampaignChannel {
  if (channels.every((c) => c === "tiktok")) return "TIKTOK";
  if (channels.every((c) => c !== "tiktok")) return "META";
  return "OTHER";
}

const ACCOUNT_KIND: Record<AutopilotChannel, SocialAccountKind> = { instagram: "INSTAGRAM", facebook: "PAGE", tiktok: "TIKTOK" };
const PROVIDER: Record<AutopilotChannel, "META" | "TIKTOK"> = { instagram: "META", facebook: "META", tiktok: "TIKTOK" };

/** Formats verticaux (Reel, TikTok) → vidéo story ; fil (Facebook) → vidéo carrée si présente. */
export function formatFor(channel: AutopilotChannel, videos: { story: string | null; square: string | null }): { format: SocialPostFormat; videoUrl: string | null } {
  if (channel === "instagram") return videos.story ? { format: "REEL_COVER", videoUrl: videos.story } : { format: "FEED_IMAGE", videoUrl: null };
  if (channel === "tiktok") return videos.story ? { format: "TIKTOK_VIDEO", videoUrl: videos.story } : { format: "TIKTOK_PHOTO", videoUrl: null };
  return { format: "FEED_IMAGE", videoUrl: null };
}

/** Répartit les vidéos par format : URLs fournies (format deviné) puis vidéos du produit (la plus récente par format). */
export function pickVideos(provided: string[], productVideos: Array<{ url: string; alt: string | null; width: number | null; height: number | null; createdAt: Date }>): { story: string | null; square: string | null } {
  const out: { story: string | null; square: string | null } = { story: null, square: null };
  for (const url of provided) {
    const u = url.toLowerCase();
    const format: VideoFormat = /square|carre|1x1|1080x1080/.test(u) ? "square" : "story";
    if (!out[format as "story" | "square"]) out[format as "story" | "square"] = url;
  }
  const sorted = [...productVideos].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  for (const v of sorted) {
    let format = parseVideoAlt(v.alt).format;
    if (!format && v.width && v.height) format = v.height > v.width ? "story" : v.height === v.width ? "square" : "landscape";
    if (format === "story" && !out.story) out.story = v.url;
    if (format === "square" && !out.square) out.square = v.url;
  }
  return out;
}

/** Sélectionne `n` variantes par canal ; complète en réutilisant les variantes disponibles si nécessaire. */
export function selectVariants(variants: PostVariant[], channels: AutopilotChannel[], n: number): Array<{ channel: AutopilotChannel; variant: PostVariant }> {
  const out: Array<{ channel: AutopilotChannel; variant: PostVariant }> = [];
  for (const channel of channels) {
    let mine = variants.filter((v) => v.channel === channel);
    // Facebook peut reprendre une variante Instagram (même ton) si le copywriter l'a omise
    if (!mine.length && channel === "facebook") mine = variants.filter((v) => v.channel === "instagram").map((v) => ({ ...v, channel: "facebook" as const }));
    for (const variant of mine.slice(0, n)) out.push({ channel, variant });
  }
  return out;
}

export interface AutopilotContext { apiKeyPrefix?: string | null; now?: Date; db?: PrismaClient; generate?: (prompt: string) => Promise<PostVariant[]>; claudeAvailable?: () => Promise<boolean> }

export async function runAutopilot(productIdOrSlug: string, rawInput: unknown, ctx: AutopilotContext = {}): Promise<AutopilotResult> {
  const db = ctx.db ?? defaultPrisma;
  const now = ctx.now ?? new Date();
  const parsed = autopilotInputSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, status: 422, error: "Requête invalide", details: parsed.error.flatten() };
  const input = parsed.data;

  const product = await db.product.findFirst({
    where: { OR: [{ id: productIdOrSlug }, { slug: productIdOrSlug }] },
    include: { images: { where: { role: "VIDEO" }, select: { url: true, alt: true, width: true, height: true, createdAt: true } }, site: { select: { audienceId: true, primaryDomain: true, domains: true } } },
  });
  if (!product) return { ok: false, status: 404, error: "Produit introuvable" };
  const isPublished = product.status === "PUBLISHED";

  // Slug de campagne unique (= utm_campaign)
  const name = input.campaign.name?.trim() || `Lancement ${product.name}`;
  let slug = slugifyUtm(name);
  if (await db.campaign.findUnique({ where: { slug } })) slug = `${slug}-${now.getTime().toString(36).slice(-5)}`;
  const base = productLandingBase(product.slug, product.site);
  const primary = input.channels[0];
  const utmMedium = "paid";
  const landingUrl = withUtm(base, { utm_source: primary, utm_medium: utmMedium, utm_campaign: slug });

  // Texte : fourni (copier-coller côté studio) ou généré par Claude
  const { brief, images } = await buildProductBrief(product.id, landingUrl, db);
  const prompt = buildCopywriterPrompt(brief, input.channels as Channel[], input.variantsPerChannel);
  let variants: PostVariant[];
  let generatedBy: "api" | "provided";
  if (input.copy != null) {
    const copy = copywriterOutputSchema.safeParse(typeof input.copy === "string" ? safeJson(input.copy) : input.copy);
    if (!copy.success) return { ok: false, status: 422, error: "Textes fournis invalides (schéma du copywriter)", details: { issues: copy.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })), schema: COPY_SCHEMA_HELP } };
    variants = copy.data.variants.map((v) => ({ ...v, hashtags: (v.hashtags ?? []).map((h) => (h.startsWith("#") ? h : `#${h}`).replace(/\s+/g, "")) }));
    generatedBy = "provided";
  } else {
    const available = await (ctx.claudeAvailable ?? isClaudeConfigured)();
    if (!available) return { ok: false, status: 409, error: "copywriter_unavailable", details: { prompt, schema: COPY_SCHEMA_HELP } };
    variants = await (ctx.generate ?? generateWithClaude)(prompt);
    generatedBy = "api";
  }
  const selected = selectVariants(variants, input.channels, input.variantsPerChannel);
  if (!selected.length) return { ok: false, status: 422, error: "Aucune variante ne correspond aux canaux demandés", details: { channels: input.channels, schema: COPY_SCHEMA_HELP } };

  const videos = pickVideos(input.videoUrls, product.images);
  // Comptes de l'audience de l'univers du produit (puis comptes communs)
  const accounts = accountsForAudience(await db.socialAccount.findMany({ where: { isActive: true, needsReconnect: false, kind: { in: input.channels.map((c) => ACCOUNT_KIND[c]) } }, orderBy: { createdAt: "asc" } }), product.site.audienceId);
  const accountFor = (c: AutopilotChannel) => accounts.find((a) => a.kind === ACCOUNT_KIND[c] && a.provider === PROVIDER[c]) ?? null;
  const autoSchedule = input.schedule.mode === "auto" && isPublished;
  const firstAt = input.schedule.startAt ?? new Date(now.getTime() + 3600_000);
  const spacingMs = input.schedule.spacingHours * 3600_000;

  const result = await db.$transaction(async (tx) => {
    const campaign = await tx.campaign.create({
      data: {
        name, slug, productId: product.id, siteId: product.siteId, objective: input.campaign.objective ?? "conversions", channel: campaignChannelFor(input.channels),
        status: autoSchedule ? "ACTIVE" : "DRAFT", startsAt: input.campaign.startsAt ?? (autoSchedule ? firstAt : null), dailyBudgetCents: input.campaign.dailyBudgetCents ?? null,
        landingUrl, utmSource: input.channels.length > 1 ? "multi" : primary, utmMedium, utmCampaign: slug, source: "api",
        notes: `Créée par l'autopilote (${generatedBy === "api" ? "textes générés par Claude" : "textes fournis par le studio"}) — canaux : ${input.channels.join(", ")}.`,
      },
    });
    const posts: AutopilotPostSummary[] = [];
    let slot = 0;
    for (const { channel, variant } of selected) {
      const { format, videoUrl } = formatFor(channel, videos);
      const account = accountFor(channel);
      const scheduled = autoSchedule && !!account;
      const scheduledAt = scheduled ? new Date(firstAt.getTime() + slot * spacingMs) : null;
      if (scheduled) slot += 1;
      const imageUrls = variant.imageIndex != null && images[variant.imageIndex] ? [images[variant.imageIndex]] : images.slice(0, 1);
      const post = await tx.socialPost.create({
        data: {
          campaignId: campaign.id, productId: product.id, accountId: account?.id ?? null, provider: PROVIDER[channel], format, status: scheduled ? "SCHEDULED" : "DRAFT",
          hook: variant.hook, body: variant.body, cta: variant.cta, headline: variant.headline ?? null, hashtags: variant.hashtags, imageUrls, videoUrl,
          scheduledAt, generatedBy: generatedBy === "api" ? "api" : "manual", variantLabel: variant.label,
        },
      });
      const linkUrl = withUtm(base, { utm_source: channel, utm_medium: utmMedium, utm_campaign: slug, utm_content: post.id });
      await tx.socialPost.update({ where: { id: post.id }, data: { linkUrl } });
      posts.push({ id: post.id, channel, format, status: post.status, scheduledAt: scheduledAt?.toISOString() ?? null, accountName: account?.name ?? null });
    }
    return { campaign, posts };
  });

  await audit({ actor: ctx.apiKeyPrefix ? `api:${ctx.apiKeyPrefix}` : "api", action: "campaign.autopilot", entity: "campaign", entityId: result.campaign.id, data: { productId: product.id, channels: input.channels, posts: result.posts.length, generatedBy, mode: input.schedule.mode } });

  return {
    ok: true,
    data: {
      campaignId: result.campaign.id, campaignSlug: slug, landingUrl,
      adminUrl: `${env.appUrl}/admin/marketing/campagnes/${result.campaign.id}`,
      posts: result.posts, generatedBy,
    },
  };
}

function safeUrl(u: string): URL | null {
  try { return new URL(u); } catch { return null; }
}

function safeJson(text: string): unknown {
  try {
    const t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "");
    return JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1));
  } catch { return text; }
}

/** Campagnes d'un produit avec leurs posts et leur rentabilité (toute la période). */
export async function productMarketing(productIdOrSlug: string, db: PrismaClient = defaultPrisma) {
  const product = await db.product.findFirst({ where: { OR: [{ id: productIdOrSlug }, { slug: productIdOrSlug }] }, select: { id: true } });
  if (!product) return null;
  const campaigns = await db.campaign.findMany({
    where: { productId: product.id }, orderBy: { createdAt: "desc" },
    include: { posts: { orderBy: [{ scheduledAt: "asc" }, { createdAt: "asc" }], include: { account: { select: { name: true } } } } },
  });
  const period = periodFromKey("tout");
  const out = [];
  for (const c of campaigns) {
    const [roi] = await campaignRoi(period, db, c.id);
    out.push({
      id: c.id, slug: c.slug, name: c.name, status: c.status, source: c.source, channel: c.channel, landingUrl: c.landingUrl, createdAt: c.createdAt.toISOString(),
      posts: c.posts.map((p) => ({
        id: p.id, provider: p.provider, format: p.format, status: p.status, label: p.variantLabel, hook: p.hook, linkUrl: p.linkUrl, videoUrl: p.videoUrl,
        scheduledAt: p.scheduledAt?.toISOString() ?? null, publishedAt: p.publishedAt?.toISOString() ?? null, externalUrl: p.externalUrl, accountName: p.account?.name ?? null, error: p.error,
      })),
      stats: { orders: roi?.orders ?? 0, revenueCents: roi?.revenueTtcCents ?? 0, revenueHtCents: roi?.revenueHtCents ?? 0, spendCents: roi?.adSpendCents ?? 0, roas: roi?.roas ?? null },
    });
  }
  return out;
}

/** Passe les posts brouillons d'une campagne en programmés (comptes connectés uniquement). */
export async function approveCampaignPosts(campaignId: string, opts: { startAt?: Date | null; spacingHours?: number; now?: Date } = {}, db: PrismaClient = defaultPrisma) {
  const now = opts.now ?? new Date();
  const campaign = await db.campaign.findUniqueOrThrow({ where: { id: campaignId }, include: { posts: { where: { status: "DRAFT" }, orderBy: { createdAt: "asc" } }, product: { select: { status: true } }, site: { select: { audienceId: true } } } });
  if (campaign.product && campaign.product.status !== "PUBLISHED") return { scheduled: 0, skipped: campaign.posts.length, reason: "Le produit n'est pas encore publié" };
  const accounts = accountsForAudience(await db.socialAccount.findMany({ where: { isActive: true, needsReconnect: false } }), campaign.site.audienceId);
  // Le canal d'un post est porté par son lien tracé (utm_source) ; repli sur le format
  const kindOf = (p: { format: SocialPostFormat; provider: string; linkUrl: string | null }): SocialAccountKind => {
    if (p.provider === "TIKTOK") return "TIKTOK";
    const source = p.linkUrl ? safeUrl(p.linkUrl)?.searchParams.get("utm_source") : null;
    if (source === "instagram") return "INSTAGRAM";
    if (source === "facebook") return "PAGE";
    return p.format === "REEL_COVER" || p.format === "STORY" ? "INSTAGRAM" : "PAGE";
  };
  const firstAt = opts.startAt ?? new Date(now.getTime() + 3600_000);
  const spacingMs = (opts.spacingHours ?? 24) * 3600_000;
  let slot = 0, skipped = 0;
  for (const p of campaign.posts) {
    const account = p.accountId ? accounts.find((a) => a.id === p.accountId) : accounts.find((a) => a.provider === p.provider && a.kind === kindOf(p));
    if (!account) { skipped += 1; continue; }
    await db.socialPost.update({ where: { id: p.id }, data: { status: "SCHEDULED", accountId: account.id, scheduledAt: new Date(firstAt.getTime() + slot * spacingMs) } });
    slot += 1;
  }
  if (slot > 0 && campaign.status === "DRAFT") await db.campaign.update({ where: { id: campaignId }, data: { status: "ACTIVE", startsAt: campaign.startsAt ?? firstAt } });
  return { scheduled: slot, skipped, reason: skipped ? "Certains posts n'ont pas de compte connecté : ils restent en brouillon (publication manuelle)" : null };
}
