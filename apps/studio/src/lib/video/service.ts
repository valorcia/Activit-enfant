/**
 * Vidéos publicitaires — opérations côté serveur web (création, liste, suppression, envoi boutique).
 * Le montage Remotion et l'appel aux fournisseurs d'animation se font dans le worker (src/lib/video/worker.ts).
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { buildAnimationPrompt } from "@malle/video/prompts";
import { publishVideoToShop } from "@malle/video/shop";
import { prisma } from "../db";
import { getStorage, assetUrl } from "../storage";
import { enqueue } from "../queue/jobs";
import { QUEUES } from "../queue/boss";
import { getShopSettings, getVideoSettings } from "../settings";
import { buildListingFromBook, loadBookForListing } from "../shop/publish";
import { KitCustomizationSchema } from "../kits/schemas";
import { defaultAdForm, type AdFormOptions, type ListingLike } from "./props";
import { afterCreate, estimateClipCostUsd, resolveClipProvider, type ClipProviderName } from "./state";

export const CreateAdVideosSchema = z.object({
  formats: z.array(z.enum(["story", "square", "landscape"])).min(1, "Choisissez au moins un format"),
  durationSeconds: z.number().int().min(6).max(20),
  hook: z.string().trim().min(1, "Accroche requise").max(90),
  bullets: z.array(z.string().trim().max(70)).max(3),
  cta: z.string().trim().min(1).max(40),
  clipProvider: z.enum(["none", "runway", "manual", "mock"]),
  clipSourceAssetId: z.string().optional().nullable(),
  clipPrompt: z.string().max(1000).optional().nullable(),
  clipDurationSeconds: z.union([z.literal(5), z.literal(10)]).default(5),
  musicAssetId: z.string().optional().nullable(),
});
export type CreateAdVideosInput = z.infer<typeof CreateAdVideosSchema>;

/** Options enregistrées dans AdVideo.props (le montage final est recalculé par le worker). */
export interface StoredAdOptions extends AdFormOptions {
  musicAssetId?: string | null;
}

export interface IllustrationChoice {
  assetId: string;
  label: string;
  src: string;
  prompt: string | null;
}

async function listingFor(bookId: string): Promise<ListingLike> {
  const [book, shop] = await Promise.all([loadBookForListing(bookId), getShopSettings()]);
  return buildListingFromBook(book, shop) as ListingLike;
}

/** Illustrations utilisables comme image d'accroche (couverture d'abord). */
export async function illustrationChoices(bookId: string): Promise<IllustrationChoice[]> {
  const ills = await prisma.illustration.findMany({
    where: { bookId, isCurrent: true, assetId: { not: null }, status: { in: ["ACCEPTED", "GENERATED"] } },
    orderBy: [{ kind: "asc" }, { createdAt: "asc" }],
    select: { assetId: true, kind: true, slot: true, prompt: true, status: true },
    take: 40,
  });
  const fromActivities = await prisma.illustration.findMany({
    where: { activity: { books: { some: { bookId } } }, isCurrent: true, kind: "FINAL", assetId: { not: null }, status: { in: ["ACCEPTED", "GENERATED"] } },
    select: { assetId: true, kind: true, slot: true, prompt: true, status: true, activity: { select: { title: true } } },
    take: 20,
  });
  const label = (kind: string, slot: string | null) => (kind === "COVER" ? "Couverture" : slot ? slot.replace(/-/g, " ") : kind === "FINAL" ? "Illustration" : kind.toLowerCase());
  const seen = new Set<string>();
  const out: IllustrationChoice[] = [];
  for (const i of [...ills.filter((x) => x.kind === "COVER"), ...ills.filter((x) => x.kind !== "COVER"), ...fromActivities]) {
    if (!i.assetId || seen.has(i.assetId)) continue;
    seen.add(i.assetId);
    const title = "activity" in i && i.activity ? (i.activity as { title: string }).title : null;
    out.push({ assetId: i.assetId, label: title ?? label(i.kind, i.slot), src: assetUrl(i.assetId)!, prompt: i.prompt });
  }
  return out;
}

/** Prompt de mouvement (anglais) proposé pour animer une illustration. */
export function animationPromptFor(description: string | null | undefined, universe: string | undefined, durationSeconds: 5 | 10 = 5) {
  const desc = (description ?? "").replace(/\s+/g, " ").trim().slice(0, 300) || "the main character of a children's activity book in a cheerful scene";
  return buildAnimationPrompt({ description: desc, universe, durationSeconds });
}

/** Valeurs par défaut du formulaire « Vidéos pub ». */
export async function adFormDefaults(bookId: string) {
  const [listing, video, book, choices] = await Promise.all([
    listingFor(bookId),
    getVideoSettings(),
    prisma.book.findUniqueOrThrow({ where: { id: bookId }, select: { customization: true, kitType: true } }),
    illustrationChoices(bookId),
  ]);
  const universe = KitCustomizationSchema.safeParse(book.customization ?? {}).data?.universe || undefined;
  const form = defaultAdForm(listing, video.defaultDurationSeconds);
  return {
    form,
    universe,
    choices,
    prompts: Object.fromEntries(choices.map((c) => [c.assetId, animationPromptFor(c.prompt, universe)])),
    runwayConfigured: Boolean(video.runwayApiKey),
    usdPerSecond: video.usdPerSecond,
    defaultMusicAssetId: video.defaultMusicAssetId,
    allowMock: process.env.NODE_ENV !== "production",
  };
}

/** Crée une vidéo par format demandé et met en file la première étape (clip ou montage). */
export async function createAdVideos(bookId: string, raw: unknown) {
  const input = CreateAdVideosSchema.parse(raw);
  const video = await getVideoSettings();
  const resolved = resolveClipProvider(input.clipProvider as ClipProviderName, { runwayConfigured: Boolean(video.runwayApiKey), allowMock: process.env.NODE_ENV !== "production" });
  if ("error" in resolved) throw new Error(resolved.error);
  const provider = resolved.provider;
  if (provider !== "none" && !input.clipSourceAssetId) throw new Error("Choisissez l'illustration à animer.");
  const universe = KitCustomizationSchema.safeParse((await prisma.book.findUniqueOrThrow({ where: { id: bookId }, select: { customization: true } })).customization ?? {}).data?.universe || undefined;
  const clipPrompt = provider === "none" ? null : input.clipPrompt?.trim() || animationPromptFor(null, universe, input.clipDurationSeconds);
  const options: StoredAdOptions = { durationSeconds: input.durationSeconds, hook: input.hook, bullets: input.bullets.filter(Boolean), cta: input.cta, musicAssetId: input.musicAssetId ?? video.defaultMusicAssetId };
  const created: string[] = [];
  for (const format of input.formats) {
    const t = afterCreate(provider);
    const ad = await prisma.adVideo.create({
      data: {
        bookId,
        format,
        status: t.status,
        step: t.step,
        props: options as unknown as Prisma.InputJsonValue,
        clipProvider: provider,
        clipPrompt,
        clipDurationSeconds: provider === "none" ? null : input.clipDurationSeconds,
        clipSourceAssetId: provider === "none" ? null : input.clipSourceAssetId,
        durationSeconds: input.durationSeconds,
        costUsd: estimateClipCostUsd(provider, input.clipDurationSeconds, video.usdPerSecond),
      },
    });
    const job = await enqueue(t.action === "clip" ? QUEUES.adClip : QUEUES.adRender, { bookId, adVideoId: ad.id });
    await prisma.adVideo.update({ where: { id: ad.id }, data: { jobId: job.id } });
    created.push(ad.id);
  }
  return created;
}

export interface AdVideoView {
  id: string;
  bookId: string;
  bookTitle: string;
  format: string;
  status: string;
  step: string | null;
  error: string | null;
  clipProvider: string;
  durationSeconds: number;
  costUsd: number;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  shopVideoUrl: string | null;
  bookLinkedToShop: boolean;
  createdAt: string;
}

export async function listAdVideos(where: { bookId?: string } = {}): Promise<AdVideoView[]> {
  const rows = await prisma.adVideo.findMany({
    where: where.bookId ? { bookId: where.bookId } : {},
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { book: { select: { title: true, shopProductId: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    bookId: r.bookId,
    bookTitle: r.book.title,
    format: r.format,
    status: r.status,
    step: r.step,
    error: r.error,
    clipProvider: r.clipProvider,
    durationSeconds: r.durationSeconds,
    costUsd: Number(r.costUsd),
    videoUrl: assetUrl(r.assetId) ?? null,
    thumbnailUrl: assetUrl(r.thumbnailAssetId) ?? null,
    shopVideoUrl: r.shopVideoUrl,
    bookLinkedToShop: Boolean(r.book.shopProductId),
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function deleteAdVideo(id: string) {
  const ad = await prisma.adVideo.findUnique({ where: { id } });
  if (!ad) return;
  await prisma.adVideo.delete({ where: { id } });
  if (ad.jobId) await prisma.job.updateMany({ where: { id: ad.jobId, status: { in: ["QUEUED", "RUNNING", "PAUSED", "WAITING_INPUT"] } }, data: { status: "CANCELLED", finishedAt: new Date() } });
  await prisma.manualRequest.updateMany({ where: { fingerprint: clipRequestFingerprint(id), status: "PENDING" }, data: { status: "CANCELLED", resolvedAt: new Date() } });
}

export function clipRequestFingerprint(adVideoId: string) {
  return `advideo:${adVideoId}:clip`;
}

/** Envoie la vidéo prête à la boutique (média VIDEO du produit lié). */
export async function sendAdVideoToShop(id: string): Promise<{ url: string }> {
  const ad = await prisma.adVideo.findUniqueOrThrow({ where: { id }, include: { asset: true, book: { select: { title: true, shopProductId: true } } } });
  if (!ad.asset) throw new Error("La vidéo n'est pas encore prête.");
  if (!ad.book.shopProductId) throw new Error("Ce livre n'est pas encore lié à un produit de la boutique (onglet Boutique → Publier).");
  const shop = await getShopSettings();
  if (!shop.shopApiUrl || !shop.shopApiKey) throw new Error("Boutique non configurée (Paramètres → Boutique).");
  const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "malle-send-")), `${ad.id}.mp4`);
  fs.writeFileSync(tmp, await getStorage().get(ad.asset.key));
  try {
    const res = await publishVideoToShop(shop.shopApiUrl, ad.book.shopProductId, tmp, { format: ad.format, title: `${ad.book.title} — ${ad.format}`, apiKey: shop.shopApiKey });
    const url = /^https?:/.test(res.url) ? res.url : `${shop.shopApiUrl}${res.url.startsWith("/") ? "" : "/"}${res.url}`;
    await prisma.adVideo.update({ where: { id }, data: { shopVideoUrl: url, step: "Prête · envoyée à la boutique" } });
    return { url };
  } finally {
    fs.rmSync(path.dirname(tmp), { recursive: true, force: true });
  }
}

/** Musique téléversée (réutilisable comme musique par défaut). */
export async function storeMusic(file: File) {
  const ext = /\.(mp3|m4a|wav|ogg|aac)$/i.exec(file.name)?.[1]?.toLowerCase() ?? "mp3";
  const mime = ext === "mp3" ? "audio/mpeg" : ext === "m4a" || ext === "aac" ? "audio/mp4" : `audio/${ext}`;
  if (file.size > 30 * 1024 * 1024) throw new Error("Musique trop lourde (30 Mo maximum)");
  const { storeAsset } = await import("../storage");
  return storeAsset({ key: `music/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`, data: Buffer.from(await file.arrayBuffer()), mime });
}

