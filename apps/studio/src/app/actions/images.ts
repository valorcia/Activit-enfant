"use server";
import { revalidatePath } from "next/cache";
import sharp from "sharp";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { enqueue, QUEUES } from "@/lib/queue/jobs";
import { storeAsset } from "@/lib/storage";
import { bookIdOf, initIllustrationFraming, resetFraming, saveFraming, swapIllustrationInPages } from "@/lib/images/service";
import { estimateRework, sketchSummary, type ReworkMode } from "@/lib/generation/rework";
import { createPreviewToken } from "@/lib/preview/token";

/**
 * Actions sur les images d'un livre : cadrage (gratuit, sans IA), reprise volontaire
 * (coût estimé et confirmé), remplacement par téléversement, versions finales des esquisses,
 * lien d'aperçu partagé.
 */
type Result<T> = { ok: true; data: T } | { ok: false; error: string };

function fail(e: unknown): { ok: false; error: string } {
  return { ok: false, error: e instanceof Error ? e.message : String(e) };
}

async function revalidateBookOf(illustrationId: string) {
  const ill = await prisma.illustration.findUnique({ where: { id: illustrationId }, select: { bookId: true, activityId: true } });
  const bookId = ill ? await bookIdOf(ill) : null;
  if (bookId) {
    revalidatePath(`/books/${bookId}`);
    revalidatePath(`/books/${bookId}/apercu`);
  }
  return bookId;
}

const FramingSchema = z.object({
  focalX: z.number().min(0).max(1),
  focalY: z.number().min(0).max(1),
  zoom: z.number().min(1).max(3),
  fit: z.enum(["cover", "contain"]).nullable(),
});

/** Enregistre le cadrage et met à jour les pages : aucun appel IA, aucun coût. */
export async function saveFramingAction(illustrationId: string, input: unknown): Promise<Result<null>> {
  try {
    const f = FramingSchema.parse(input);
    await saveFraming(illustrationId, f);
    await revalidateBookOf(illustrationId);
    return { ok: true, data: null };
  } catch (e) {
    return fail(e);
  }
}

/** « Recadrage automatique » : point focal détecté (zone d'intérêt), ajustement automatique. */
export async function resetFramingAction(illustrationId: string): Promise<Result<{ focalX: number; focalY: number; zoom: number; fit: "cover" | "contain" | null }>> {
  try {
    const ill = await resetFraming(illustrationId);
    await revalidateBookOf(illustrationId);
    return { ok: true, data: { focalX: ill.focalX, focalY: ill.focalY, zoom: ill.zoom, fit: ill.fit === "cover" || ill.fit === "contain" ? ill.fit : null } };
  } catch (e) {
    return fail(e);
  }
}

export async function estimateReworkAction(illustrationId: string, mode: ReworkMode): Promise<Result<{ costUsd: number; quality: string; size: string; manual: boolean }>> {
  try {
    const r = await estimateRework(illustrationId, mode);
    return { ok: true, data: { costUsd: r.costUsd, quality: r.quality, size: r.size, manual: r.manual } };
  } catch (e) {
    return fail(e);
  }
}

/** Reprise volontaire d'une image (après confirmation du coût dans l'interface). */
export async function reworkIllustrationAction(illustrationId: string, mode: ReworkMode, correction?: string): Promise<Result<{ jobId: string }>> {
  try {
    if (!["final", "correction", "fresh"].includes(mode)) throw new Error("Mode inconnu");
    if (mode === "correction" && !correction?.trim()) throw new Error("Décrivez la correction à apporter");
    const ill = await prisma.illustration.findUniqueOrThrow({ where: { id: illustrationId }, select: { bookId: true, activityId: true } });
    const bookId = await bookIdOf(ill);
    const job = await enqueue(QUEUES.illustrationRework, { illustrationId, mode, correction: correction?.trim().slice(0, 800), bookId: bookId ?? undefined });
    if (bookId) revalidatePath(`/books/${bookId}/apercu`);
    return { ok: true, data: { jobId: job.id } };
  } catch (e) {
    return fail(e);
  }
}

/** Remplace une image par un fichier téléversé (aucun coût) ; pages mises à jour. */
export async function replaceIllustrationUploadAction(formData: FormData): Promise<Result<{ illustrationId: string }>> {
  try {
    const illustrationId = String(formData.get("illustrationId") ?? "");
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) throw new Error("Aucun fichier reçu");
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) throw new Error("Format accepté : PNG, JPG ou WebP");
    if (file.size > 25 * 1024 * 1024) throw new Error("Image trop lourde (25 Mo maximum)");
    const ill = await prisma.illustration.findUniqueOrThrow({ where: { id: illustrationId } });
    const png = await sharp(Buffer.from(await file.arrayBuffer())).rotate().png().toBuffer();
    const meta = await sharp(png).metadata();
    const next = await prisma.illustration.create({
      data: { activityId: ill.activityId, bookId: ill.bookId, kind: ill.kind, stepIndex: ill.stepIndex, slot: ill.slot, version: ill.version + 1, parentId: ill.id, status: "GENERATED", prompt: ill.prompt, negative: ill.negative, provider: "upload", model: "upload", isCurrent: true, targetRatio: ill.targetRatio, isSketch: false, quality: "high", costUsd: 0 },
    });
    const asset = await storeAsset({ key: `illustrations/${ill.bookId ?? ill.activityId}/upload-${next.id}.png`, data: png, mime: "image/png", width: meta.width, height: meta.height });
    await prisma.illustration.update({ where: { id: next.id }, data: { assetId: asset.id } });
    await prisma.illustration.update({ where: { id: ill.id }, data: { isCurrent: false } });
    await initIllustrationFraming(next.id, png);
    const bookId = await bookIdOf(ill);
    if (bookId) await swapIllustrationInPages(bookId, ill.id, { id: next.id, src: `/api/assets/${asset.id}`, isDemo: false });
    await revalidateBookOf(next.id);
    return { ok: true, data: { illustrationId: next.id } };
  } catch (e) {
    return fail(e);
  }
}

export async function sketchSummaryAction(bookId: string) {
  return sketchSummary(bookId);
}

/** « Valider les esquisses et générer la version finale » (toutes, ou une sélection). */
export async function finalizeSketchesAction(bookId: string, illustrationIds?: string[]): Promise<Result<{ jobId: string }>> {
  try {
    const s = await sketchSummary(bookId);
    if (!s.count) throw new Error("Aucune esquisse à finaliser");
    const job = await enqueue(QUEUES.bookFinalize, { bookId, illustrationIds });
    revalidatePath(`/books/${bookId}/apercu`);
    return { ok: true, data: { jobId: job.id } };
  } catch (e) {
    return fail(e);
  }
}

/** Lien d'aperçu en lecture seule, valable 7 jours. */
export async function createPreviewLinkAction(bookId: string): Promise<Result<{ url: string; expiresAt: string }>> {
  try {
    await prisma.book.findUniqueOrThrow({ where: { id: bookId }, select: { id: true } });
    const { token, expiresAt } = await createPreviewToken(bookId);
    const base = (process.env.APP_URL ?? "").replace(/\/$/, "");
    return { ok: true, data: { url: `${base}/preview/${token}`, expiresAt: expiresAt.toISOString() } };
  } catch (e) {
    return fail(e);
  }
}
