import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { getStorage } from "../storage";
import { analyzeImage, type ImageAnalysis } from "./analyze";
import { clamp01, clampZoom, effectiveFit, ratioForSlot } from "./framing";
import { PageLayoutSchema, type PageLayout } from "../schemas/layout";

/** Analyse (gratuite) d'un asset image et mémorisation du résultat. */
export async function analyzeAsset(assetId: string, data?: Buffer): Promise<ImageAnalysis | null> {
  const asset = await prisma.asset.findUnique({ where: { id: assetId } });
  if (!asset || !asset.mime.startsWith("image/")) return null;
  try {
    const buf = data ?? (await getStorage().get(asset.key));
    const a = await analyzeImage(buf);
    await prisma.asset.update({ where: { id: assetId }, data: { focalX: a.focalX, focalY: a.focalY, dominantColor: a.dominantColor, contrast: a.contrast, width: asset.width ?? a.width, height: asset.height ?? a.height } });
    return a;
  } catch {
    return null;
  }
}

/**
 * Après la création d'une illustration : analyse de l'image, point focal automatique et
 * format cible mémorisés (le cadrage manuel n'est jamais écrasé).
 */
export async function initIllustrationFraming(illustrationId: string, data?: Buffer) {
  const ill = await prisma.illustration.findUnique({ where: { id: illustrationId } });
  if (!ill?.assetId) return;
  const a = await analyzeAsset(ill.assetId, data);
  const targetRatio = ill.targetRatio ?? ratioForSlot(ill.slot, ill.kind);
  if (ill.framedManually) {
    await prisma.illustration.update({ where: { id: ill.id }, data: { targetRatio } });
    return;
  }
  await prisma.illustration.update({ where: { id: ill.id }, data: { targetRatio, focalX: a?.focalX ?? 0.5, focalY: a?.focalY ?? 0.5 } });
}

export interface FramingInput {
  focalX: number;
  focalY: number;
  zoom: number;
  fit: "cover" | "contain" | null;
}

/** Enregistre un cadrage manuel puis met à jour les pages qui utilisent l'image (aucun appel IA). */
export async function saveFraming(illustrationId: string, f: FramingInput) {
  const ill = await prisma.illustration.update({
    where: { id: illustrationId },
    data: { focalX: clamp01(f.focalX), focalY: clamp01(f.focalY), zoom: clampZoom(f.zoom), fit: f.fit, framedManually: true },
  });
  const bookId = await bookIdOf(ill);
  if (bookId) await applyFramingToBookPages(bookId);
  return ill;
}

/** « Recadrage automatique » : retour au point focal détecté et à l'ajustement automatique. */
export async function resetFraming(illustrationId: string) {
  const ill = await prisma.illustration.findUniqueOrThrow({ where: { id: illustrationId }, include: { asset: true } });
  let focalX = ill.asset?.focalX ?? null;
  let focalY = ill.asset?.focalY ?? null;
  if ((focalX == null || focalY == null) && ill.assetId) {
    const a = await analyzeAsset(ill.assetId);
    focalX = a?.focalX ?? 0.5;
    focalY = a?.focalY ?? 0.5;
  }
  const updated = await prisma.illustration.update({ where: { id: illustrationId }, data: { focalX: focalX ?? 0.5, focalY: focalY ?? 0.5, zoom: 1, fit: null, framedManually: false } });
  const bookId = await bookIdOf(updated);
  if (bookId) await applyFramingToBookPages(bookId);
  return updated;
}

export async function bookIdOf(ill: { bookId: string | null; activityId: string | null }): Promise<string | null> {
  if (ill.bookId) return ill.bookId;
  if (!ill.activityId) return null;
  const link = await prisma.bookActivity.findFirst({ where: { activityId: ill.activityId }, select: { bookId: true } });
  return link?.bookId ?? null;
}

type IllForFraming = { id: string; focalX: number; focalY: number; zoom: number; fit: string | null; asset: { width: number | null; height: number | null; dominantColor: string | null } | null };

/** Applique le cadrage des illustrations aux blocs image d'une mise en page (fonction pure). */
export function applyFramingToLayout(layout: PageLayout, ills: Map<string, IllForFraming>): { layout: PageLayout; changed: boolean } {
  let changed = false;
  const blocks = layout.blocks.map((b) => {
    if (b.type !== "image" || !b.illustrationId) return b;
    const ill = ills.get(b.illustrationId);
    if (!ill) return b;
    const fit = effectiveFit({ fit: ill.fit, imgW: ill.asset?.width, imgH: ill.asset?.height, frameW: b.w, frameH: b.h });
    // Fond blanc imposé par le gabarit (dessins à colorier) : on le garde
    const next = { ...b, fit, focalX: ill.focalX, focalY: ill.focalY, zoom: ill.zoom, bg: b.style?.background === "#FFFFFF" ? "#FFFFFF" : ill.asset?.dominantColor ?? b.bg };
    if (next.fit !== b.fit || next.focalX !== b.focalX || next.focalY !== b.focalY || next.zoom !== b.zoom || next.bg !== b.bg) changed = true;
    return next;
  });
  return { layout: { ...layout, blocks }, changed };
}

/** Met à jour le cadrage de toutes les pages d'un livre (après assemblage ou recadrage). */
export async function applyFramingToBookPages(bookId: string): Promise<number> {
  const pages = await prisma.bookPage.findMany({ where: { bookId } });
  const ids = new Set<string>();
  const parsed = pages.map((p) => ({ p, layout: PageLayoutSchema.safeParse(p.layout) }));
  for (const { layout } of parsed) if (layout.success) for (const b of layout.data.blocks) if (b.type === "image" && b.illustrationId) ids.add(b.illustrationId);
  if (!ids.size) return 0;
  const ills = await prisma.illustration.findMany({ where: { id: { in: [...ids] } }, select: { id: true, focalX: true, focalY: true, zoom: true, fit: true, asset: { select: { width: true, height: true, dominantColor: true } } } });
  // Images sans analyse (anciennes) : analyse à la volée, une seule fois
  for (const i of ills) {
    if (i.asset && !i.asset.dominantColor) {
      const full = await prisma.illustration.findUnique({ where: { id: i.id }, select: { assetId: true, framedManually: true } });
      if (full?.assetId) {
        const a = await analyzeAsset(full.assetId);
        if (a) {
          i.asset.dominantColor = a.dominantColor;
          i.asset.width = i.asset.width ?? a.width;
          i.asset.height = i.asset.height ?? a.height;
          if (!full.framedManually) {
            await prisma.illustration.update({ where: { id: i.id }, data: { focalX: a.focalX, focalY: a.focalY } });
            i.focalX = a.focalX;
            i.focalY = a.focalY;
          }
        }
      }
    }
  }
  const map = new Map(ills.map((i) => [i.id, i]));
  let updated = 0;
  for (const { p, layout } of parsed) {
    if (!layout.success) continue;
    const r = applyFramingToLayout(layout.data, map);
    if (r.changed) {
      await prisma.bookPage.update({ where: { id: p.id }, data: { layout: r.layout as unknown as Prisma.InputJsonValue } });
      updated++;
    }
  }
  return updated;
}

/**
 * Remplace une illustration par sa nouvelle version dans les pages d'un livre (blocs image et
 * étapes) et dans la couverture, sans reconstruire les pages : le texte et les retouches
 * manuelles sont conservés.
 */
export async function swapIllustrationInPages(bookId: string, oldId: string, next: { id: string; src: string; isDemo: boolean }): Promise<number> {
  const pages = await prisma.bookPage.findMany({ where: { bookId } });
  let updated = 0;
  for (const p of pages) {
    const parsed = PageLayoutSchema.safeParse(p.layout);
    if (!parsed.success) continue;
    let changed = false;
    const blocks = parsed.data.blocks.map((b) => {
      if (b.type === "image" && b.illustrationId === oldId) {
        changed = true;
        return { ...b, illustrationId: next.id, src: next.src, isDemo: next.isDemo };
      }
      if (b.type === "step" && b.illustrationId === oldId) {
        changed = true;
        return { ...b, illustrationId: next.id, imageSrc: next.src, isDemo: next.isDemo };
      }
      return b;
    });
    if (changed) {
      await prisma.bookPage.update({ where: { id: p.id }, data: { layout: { ...parsed.data, blocks } as unknown as Prisma.InputJsonValue } });
      updated++;
    }
  }
  const book = await prisma.book.findUnique({ where: { id: bookId }, select: { cover: true } });
  const cover = (book?.cover ?? null) as { illustrationId?: string } | null;
  if (cover?.illustrationId === oldId) await prisma.book.update({ where: { id: bookId }, data: { cover: { ...cover, illustrationId: next.id } as Prisma.InputJsonValue } });
  await applyFramingToBookPages(bookId);
  return updated;
}
