/**
 * Vidéos publicitaires — étapes exécutées par le worker (jamais par le serveur web) :
 *  - clip d'accroche : Runway (API, suivi par interrogations différées), copier-coller (demande « À coller »), démo ;
 *  - montage Remotion (MP4 + miniature), stockage, envoi à la boutique si le livre est lié.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import type { Prisma } from "@prisma/client";
import { renderAd, renderAdStill, createVideoProvider, ManualVideoProvider, RunwayProvider, RUNWAY_DEFAULTS, publishVideoToShop, type AdFormat } from "@malle/video";
import { prisma } from "../db";
import { getStorage, storeAsset } from "../storage";
import { enqueue, setJob, jobLog } from "../queue/jobs";
import { getBoss, QUEUES } from "../queue/boss";
import { getShopSettings, getStudioSettings, getVideoSettings } from "../settings";
import { buildListingFromBook, loadBookForListing } from "../shop/publish";
import { activeSites } from "../universes";
import { DEFAULT_SITE_SLUG, siteBySlug } from "../universes/sites";
import { markWaitingInput } from "../manual/requests";
import { buildAdProps, clipRatioFor, type ListingLike } from "./props";
import { afterClipAvailable, afterManualRequest, afterProviderState, afterRenderDone, afterRenderFailed, afterRenderStart, CLIP_POLL_SECONDS } from "./state";
import { clipRequestFingerprint, type StoredAdOptions } from "./service";

/** Dossier public du rendu Remotion (lié au bundle : les fichiers ajoutés après coup sont servis). */
export function videoWorkDir() {
  const dir = path.resolve(process.env.VIDEO_WORK_DIR ?? path.join(os.tmpdir(), "malle-video-public"));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

async function setAd(id: string, data: Prisma.AdVideoUpdateInput) {
  await prisma.adVideo.update({ where: { id }, data });
}

/** Copie un Asset du stockage dans le dossier public du rendu ; renvoie le nom de fichier relatif. */
async function stageAsset(assetId: string, name: string): Promise<string> {
  const asset = await prisma.asset.findUniqueOrThrow({ where: { id: assetId } });
  const ext = asset.mime.split("/")[1]?.replace("quicktime", "mov").replace("mpeg", "mp3").replace("jpeg", "jpg") ?? "bin";
  const file = `${name}.${ext}`;
  fs.writeFileSync(path.join(videoWorkDir(), file), await getStorage().get(asset.key));
  return file;
}

async function stageUrl(url: string, name: string): Promise<string | undefined> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return undefined;
    const type = res.headers.get("content-type") ?? "";
    const ext = type.includes("png") ? "png" : type.includes("jpeg") ? "jpg" : type.includes("webp") ? "webp" : type.includes("svg") ? "svg" : "png";
    const file = `${name}.${ext}`;
    fs.writeFileSync(path.join(videoWorkDir(), file), Buffer.from(await res.arrayBuffer()));
    return file;
  } catch {
    return undefined;
  }
}

function cleanupStaged(prefix: string) {
  const dir = videoWorkDir();
  for (const f of fs.readdirSync(dir)) if (f.startsWith(prefix)) fs.rmSync(path.join(dir, f), { force: true });
}

// ---------------------------------------------------------------------------
// Étape 1 : clip d'accroche
// ---------------------------------------------------------------------------

async function finishClip(adId: string, jobId: string, clipAssetId: string, bookId: string) {
  const t = afterClipAvailable();
  const job = await enqueue(QUEUES.adRender, { bookId, adVideoId: adId });
  await setAd(adId, { clip: { connect: { id: clipAssetId } }, status: t.status, step: t.step, jobId: job.id, error: null });
  await setJob(jobId, { status: "COMPLETED", progress: 100, step: "Clip d'accroche prêt" });
}

async function failAd(adId: string, jobId: string, error: string, step = "Échec") {
  await setAd(adId, { status: "FAILED", step, error });
  await jobLog(jobId, error, "error");
  await setJob(jobId, { status: "FAILED", error });
}

export async function runClipStep(adVideoId: string, jobId: string) {
  const ad = await prisma.adVideo.findUnique({ where: { id: adVideoId }, include: { book: { select: { title: true } } } });
  if (!ad) {
    await setJob(jobId, { status: "CANCELLED", step: "Vidéo supprimée" });
    return;
  }
  if (ad.clipAssetId) return finishClip(ad.id, jobId, ad.clipAssetId, ad.bookId);
  if (!ad.clipSourceAssetId) return failAd(ad.id, jobId, "Aucune illustration de départ pour le clip");
  const format = ad.format as AdFormat;
  const duration = (ad.clipDurationSeconds === 10 ? 10 : 5) as 5 | 10;
  const prompt = ad.clipPrompt ?? "";
  await setJob(jobId, { status: "RUNNING" });

  // --- Copier-coller : demande « À coller » de type vidéo, reprise automatique au téléversement
  if (ad.clipProvider === "manual") {
    const fingerprint = clipRequestFingerprint(ad.id);
    const existing = await prisma.manualRequest.findUnique({ where: { fingerprint } });
    if (existing?.status === "DONE" && existing.assetId) return finishClip(ad.id, jobId, existing.assetId, ad.bookId);
    if (!existing || existing.status === "CANCELLED") {
      const instructions = new ManualVideoProvider().instructions({ prompt, durationSeconds: duration, ratio: clipRatioFor(format) });
      const data = {
        kind: "VIDEO" as const,
        status: "PENDING" as const,
        title: `Clip d'accroche : ${ad.book.title} (${format})`,
        prompt: instructions,
        expectedFormat: `Fichier MP4 de ${duration} s, ${clipRatioFor(format) === "portrait" ? "vertical 9:16" : clipRatioFor(format) === "square" ? "carré 1:1" : "paysage 16:9"}`,
        purpose: "ad_clip",
        params: { adVideoId: ad.id, sourceAssetId: ad.clipSourceAssetId, durationSeconds: duration, ratio: clipRatioFor(format) },
        bookId: ad.bookId,
        jobId,
        error: null,
        resolvedAt: null,
      };
      if (existing) await prisma.manualRequest.update({ where: { id: existing.id }, data });
      else await prisma.manualRequest.create({ data: { ...data, fingerprint } });
    }
    const t = afterManualRequest();
    await setAd(ad.id, { status: t.status, step: t.step, jobId });
    await markWaitingInput(jobId, 1);
    return;
  }

  // --- Démonstration : petit clip monté localement à partir de l'illustration (aucun appel externe)
  if (ad.clipProvider === "mock") {
    const prefix = `${ad.id}-mock`;
    try {
      const src = await stageAsset(ad.clipSourceAssetId, `${prefix}-src`);
      const out = path.join(os.tmpdir(), `${prefix}.mp4`);
      await renderAd(
        { format, durationSeconds: 2, title: ad.book.title.slice(0, 80), hook: "Clip de démonstration", bullets: ["Démo"], priceCents: 0, heroImage: src },
        { format, outPath: out, publicDir: videoWorkDir(), scale: 0.5 },
      );
      const asset = await storeAsset({ key: `videos/${ad.bookId}/${ad.id}-clip.mp4`, data: fs.readFileSync(out), mime: "video/mp4" });
      fs.rmSync(out, { force: true });
      return finishClip(ad.id, jobId, asset.id, ad.bookId);
    } catch (e) {
      return failAd(ad.id, jobId, `Clip de démonstration impossible : ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      cleanupStaged(prefix);
    }
  }

  // --- Runway : lancement puis interrogations différées (pg-boss startAfter)
  if (ad.clipProvider === "runway") {
    const settings = await getVideoSettings();
    let provider: RunwayProvider;
    try {
      provider = createVideoProvider("runway", { RUNWAY_API_KEY: settings.runwayApiKey }) as RunwayProvider;
    } catch (e) {
      return failAd(ad.id, jobId, e instanceof Error ? e.message : String(e));
    }
    let clipJobId = ad.clipJobId;
    let startedAt = ad.clipStartedAt ?? new Date();
    if (!clipJobId) {
      try {
        const asset = await prisma.asset.findUniqueOrThrow({ where: { id: ad.clipSourceAssetId } });
        // JPEG ≤ 1280 px : data URI compacte acceptée par Runway
        const jpeg = await sharp(await getStorage().get(asset.key)).resize({ width: 1280, height: 1280, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 88 }).toBuffer();
        const r = await provider.generateFromImage({ imageBuffer: jpeg, imageMime: "image/jpeg", prompt, durationSeconds: duration, ratio: clipRatioFor(format) });
        clipJobId = r.jobId;
        startedAt = new Date();
        const cost = Math.round(duration * settings.usdPerSecond * 100) / 100;
        await setAd(ad.id, { clipJobId, clipStartedAt: startedAt, costUsd: cost, status: "WAITING_CLIP", step: "Animation envoyée à Runway" });
        await setJob(jobId, { step: "Animation envoyée à Runway", costUsd: cost });
        await jobLog(jobId, `Runway : tâche ${clipJobId} (${duration} s, ${RUNWAY_DEFAULTS.model})`);
      } catch (e) {
        return failAd(ad.id, jobId, e instanceof Error ? e.message : String(e), "Échec de l'envoi à Runway");
      }
    }
    const state = await provider.getStatus(clipJobId).catch((e: unknown) => ({ status: "running" as const, error: String(e) }));
    const t = afterProviderState(state, Date.now() - startedAt.getTime());
    if (t.action === "poll") {
      await setAd(ad.id, { status: t.status, step: t.step });
      await setJob(jobId, { step: t.step });
      const boss = await getBoss();
      await boss.send(QUEUES.adClip, { jobId, bookId: ad.bookId, adVideoId: ad.id }, { startAfter: CLIP_POLL_SECONDS, retryLimit: 2, retryDelay: 15 });
      return;
    }
    if (t.status === "FAILED") return failAd(ad.id, jobId, t.error ?? "Échec Runway", t.step);
    if (!("videoUrl" in state) || !state.videoUrl) return failAd(ad.id, jobId, "Runway n'a renvoyé aucune vidéo");
    const res = await fetch(state.videoUrl);
    if (!res.ok) return failAd(ad.id, jobId, `Téléchargement du clip impossible (${res.status})`);
    const asset = await storeAsset({ key: `videos/${ad.bookId}/${ad.id}-clip.mp4`, data: Buffer.from(await res.arrayBuffer()), mime: "video/mp4" });
    return finishClip(ad.id, jobId, asset.id, ad.bookId);
  }

  // Aucun clip demandé : directement au montage
  const job = await enqueue(QUEUES.adRender, { bookId: ad.bookId, adVideoId: ad.id });
  await setAd(ad.id, { jobId: job.id });
  await setJob(jobId, { status: "COMPLETED", progress: 100, step: "Aucun clip demandé" });
}

// ---------------------------------------------------------------------------
// Étape 2 : montage Remotion
// ---------------------------------------------------------------------------

/** Illustrations du livre utilisables dans le montage : couverture, puis illustrations du kit / des activités. */
async function bookImages(bookId: string) {
  const ills = await prisma.illustration.findMany({
    where: { bookId, isCurrent: true, assetId: { not: null }, status: { in: ["ACCEPTED", "GENERATED"] } },
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    select: { assetId: true, kind: true },
  });
  const finals = await prisma.illustration.findMany({
    where: { activity: { books: { some: { bookId } } }, isCurrent: true, kind: "FINAL", assetId: { not: null }, status: { in: ["ACCEPTED", "GENERATED"] } },
    select: { assetId: true },
    take: 8,
  });
  const cover = ills.find((i) => i.kind === "COVER")?.assetId ?? null;
  const others = [...ills.filter((i) => i.kind !== "COVER").map((i) => i.assetId!), ...finals.map((f) => f.assetId!)];
  return { cover, others: [...new Set(others)].filter((id) => id !== cover) };
}

export async function runRenderStep(adVideoId: string, jobId: string) {
  const ad = await prisma.adVideo.findUnique({ where: { id: adVideoId } });
  if (!ad) {
    await setJob(jobId, { status: "CANCELLED", step: "Vidéo supprimée" });
    return;
  }
  const start = afterRenderStart();
  await setAd(ad.id, { status: start.status, step: start.step, jobId, error: null });
  await setJob(jobId, { status: "RUNNING", step: start.step, progress: 5 });
  const prefix = `${ad.id}-`;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "malle-ad-"));
  try {
    const [bookForListing, shop, studio, video] = await Promise.all([loadBookForListing(ad.bookId), getShopSettings(), getStudioSettings(), getVideoSettings()]);
    const listing = buildListingFromBook(bookForListing, shop) as ListingLike;
    const options = ad.props as unknown as StoredAdOptions;
    const images = await bookImages(ad.bookId);
    const heroId = ad.clipSourceAssetId ?? images.cover ?? images.others[0];
    if (!heroId) throw new Error("Aucune illustration disponible : générez ou importez au moins la couverture du livre.");

    const hero = await stageAsset(heroId, `${prefix}hero`);
    const cover = images.cover && images.cover !== heroId ? await stageAsset(images.cover, `${prefix}cover`) : undefined;
    const kitImages: string[] = [];
    for (const [i, id] of images.others.filter((x) => x !== heroId).slice(0, 4).entries()) kitImages.push(await stageAsset(id, `${prefix}kit${i}`));
    const clip = ad.clipAssetId ? await stageAsset(ad.clipAssetId, `${prefix}clip`) : undefined;
    const music = options.musicAssetId ? await stageAsset(options.musicAssetId, `${prefix}music`).catch(() => undefined) : undefined;
    // Univers du livre : nom de marque et domaine affichés dans la vidéo
    const site = siteBySlug(await activeSites(), bookForListing.siteSlug);
    const logo = (!site || site.slug === DEFAULT_SITE_SLUG) && shop.shopApiUrl.startsWith("https://") ? await stageUrl(`${shop.shopApiUrl}/images/brand/logo-la-malle-a-jeux.webp`, `${prefix}logo`) : undefined;
    let host = site?.primaryDomain ?? "";
    try {
      host = host || (site?.url ? new URL(site.url).host : shop.shopApiUrl ? new URL(shop.shopApiUrl).host : "");
    } catch {
      host = "";
    }

    const format = ad.format as AdFormat;
    const props = buildAdProps(listing, options, { hero, cover, kitImages, clip, logo, music, musicVolume: video.musicVolume }, { format, brandName: site?.name || studio.defaultAuthor || "La Malle à Jeux", url: host });
    await setJob(jobId, { step: "Montage Remotion en cours", progress: 15 });
    const outMp4 = path.join(tmpDir, `${ad.id}.mp4`);
    let lastPct = 0;
    await renderAd(props, {
      format,
      outPath: outMp4,
      publicDir: videoWorkDir(),
      onProgress: (p) => {
        const pct = Math.round(15 + p * 75);
        if (pct - lastPct >= 10) {
          lastPct = pct;
          void setJob(jobId, { progress: pct });
        }
      },
    });
    const outPng = path.join(tmpDir, `${ad.id}.png`);
    await renderAdStill(props, { format, outPath: outPng, publicDir: videoWorkDir(), scale: 0.5 });

    const mp4 = await storeAsset({ key: `videos/${ad.bookId}/${ad.id}.mp4`, data: fs.readFileSync(outMp4), mime: "video/mp4", width: undefined, height: undefined });
    const thumb = await storeAsset({ key: `videos/${ad.bookId}/${ad.id}.png`, data: fs.readFileSync(outPng), mime: "image/png" });
    await setAd(ad.id, { asset: { connect: { id: mp4.id } }, thumbnail: { connect: { id: thumb.id } }, props: { ...(options as object), rendered: props } as Prisma.InputJsonValue });

    // Envoi automatique à la boutique si le livre est lié à un produit
    let sent = false;
    const book = await prisma.book.findUniqueOrThrow({ where: { id: ad.bookId }, select: { title: true, shopProductId: true } });
    if (book.shopProductId && shop.shopApiUrl && shop.shopApiKey) {
      try {
        const r = await publishVideoToShop(shop.shopApiUrl, book.shopProductId, outMp4, { format, title: `${book.title} — ${format}`, apiKey: shop.shopApiKey });
        const url = /^https?:/.test(r.url) ? r.url : `${shop.shopApiUrl}${r.url.startsWith("/") ? "" : "/"}${r.url}`;
        await setAd(ad.id, { shopVideoUrl: url });
        sent = true;
        await jobLog(jobId, `Vidéo envoyée à la boutique : ${url}`);
      } catch (e) {
        await jobLog(jobId, `Envoi à la boutique impossible : ${e instanceof Error ? e.message : String(e)}`, "warn");
      }
    }
    const done = afterRenderDone(sent);
    await setAd(ad.id, { status: done.status, step: done.step, error: null });
    await setJob(jobId, { status: "COMPLETED", progress: 100, step: done.step, result: { assetId: mp4.id, thumbnailAssetId: thumb.id } });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const t = afterRenderFailed(message);
    await setAd(ad.id, { status: t.status, step: t.step, error: message });
    await jobLog(jobId, message, "error");
    await setJob(jobId, { status: "FAILED", error: message });
  } finally {
    cleanupStaged(prefix);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}
