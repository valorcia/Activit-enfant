import { prisma } from "../db";
import { getAiSettings } from "../settings";
import { getImageProvider, effectiveImageModel, manualImages } from "../ai/registry";
import { imageCost } from "../ai/pricing";
import { getStorage, storeAsset } from "../storage";
import { isManualInputRequired } from "../ai/manual-core";
import { ratioForSlot, sizeForRatio, type TargetRatio } from "../images/framing";
import { bookIdOf, initIllustrationFraming, swapIllustrationInPages } from "../images/service";
import type { AiSettings } from "../schemas/settings";

/**
 * Reprise d'une image existante, toujours volontaire (jamais lancée par un pipeline) :
 * - « final » : version finale d'une esquisse validée — même prompt, l'esquisse sert de
 *   référence (images.edit) pour garder la composition ;
 * - « correction » : même prompt + correction libre, l'image actuelle en référence ;
 * - « fresh » : nouvelle image avec le même prompt, sans référence à l'image actuelle.
 */
export type ReworkMode = "final" | "correction" | "fresh";

type IllLike = { prompt: string | null; slot: string | null; kind: string; targetRatio: string | null; isSketch: boolean };

/** Prompt de la reprise : prompt d'origine (consignes de format comprises) + correction éventuelle. */
export function reworkPrompt(ill: Pick<IllLike, "prompt">, mode: ReworkMode, correction?: string): string {
  const base = (ill.prompt ?? "").trim();
  const lines = [base];
  if (mode === "final") lines.push("", "Version finale : reprendre exactement la composition, les personnages, les couleurs et le cadrage de l'image de référence fournie (esquisse validée), avec un rendu soigné et détaillé, prêt pour l'impression.");
  if (mode === "correction" && correction?.trim()) lines.push("", `Correction demandée (garder le reste de l'image identique) : ${correction.trim()}`);
  return lines.join("\n");
}

/** Qualité de la reprise : la finale passe en qualité d'impression, une correction d'esquisse reste en esquisse. */
export function reworkQuality(ill: Pick<IllLike, "isSketch">, mode: ReworkMode, settings: Pick<AiSettings, "imageQuality" | "sketchQuality">) {
  if (mode === "final") return { quality: settings.imageQuality, sketch: false };
  return ill.isSketch ? { quality: settings.sketchQuality, sketch: true } : { quality: settings.imageQuality, sketch: false };
}

export function reworkRatio(ill: Pick<IllLike, "targetRatio" | "slot" | "kind">): TargetRatio {
  const r = ill.targetRatio;
  return r === "portrait" || r === "landscape" || r === "square" ? r : ratioForSlot(ill.slot, ill.kind);
}

/** Estimation du coût d'une reprise (affichée avant confirmation). */
export async function estimateRework(illustrationId: string, mode: ReworkMode) {
  const settings = await getAiSettings();
  const ill = await prisma.illustration.findUniqueOrThrow({ where: { id: illustrationId } });
  const { quality } = reworkQuality(ill, mode, settings);
  const size = sizeForRatio(reworkRatio(ill));
  const model = effectiveImageModel(settings);
  const manual = manualImages(settings);
  return { costUsd: manual || settings.imageProvider === "mock" ? 0 : imageCost(model, quality, size), quality, size, model, manual };
}

/** Reprend une image : nouvelle version, pages mises à jour, coût journalisé. */
export async function reworkIllustration(opts: { illustrationId: string; mode: ReworkMode; correction?: string; jobId?: string }) {
  const settings = await getAiSettings();
  const ill = await prisma.illustration.findUniqueOrThrow({ where: { id: opts.illustrationId }, include: { asset: true } });
  if (!ill.prompt) throw new Error("Prompt d'origine absent : impossible de reprendre cette image");
  const bookId = await bookIdOf(ill);
  const provider = getImageProvider(settings, { bookId: bookId ?? undefined, activityId: ill.activityId ?? undefined, jobId: opts.jobId });
  const model = effectiveImageModel(settings);
  const prompt = reworkPrompt(ill, opts.mode, opts.correction);
  const { quality, sketch } = reworkQuality(ill, opts.mode, settings);
  const ratio = reworkRatio(ill);
  const size = sizeForRatio(ratio);

  // Références : l'image actuelle (finale / correction) puis la planche des personnages (kits)
  const references: Buffer[] = [];
  if (opts.mode !== "fresh" && ill.asset) references.push(await getStorage().get(ill.asset.key));
  if (ill.kind === "KIT" || ill.kind === "COVER") {
    const { characterSheetReference, isCharacterSheetSlot } = await import("../kits/generate");
    if (!(ill.slot && isCharacterSheetSlot(ill.slot)) && ill.bookId) {
      const sheet = await characterSheetReference(ill.bookId);
      if (sheet) references.push(sheet);
    }
  }

  const keepFraming = opts.mode !== "fresh";
  const record = await prisma.illustration.create({
    data: {
      activityId: ill.activityId,
      bookId: ill.bookId,
      kind: ill.kind,
      stepIndex: ill.stepIndex,
      slot: ill.slot,
      version: ill.version + 1,
      parentId: ill.id,
      // Une esquisse validée reste validée en version finale : aucun pipeline ne la refera
      status: "GENERATING",
      prompt,
      negative: ill.negative,
      provider: provider.name,
      model,
      isCurrent: true,
      targetRatio: ratio,
      isSketch: sketch,
      quality,
      ...(keepFraming ? { focalX: ill.focalX, focalY: ill.focalY, zoom: ill.zoom, fit: ill.fit, framedManually: ill.framedManually } : {}),
    },
  });
  await prisma.illustration.update({ where: { id: ill.id }, data: { isCurrent: false } });
  const started = Date.now();
  const purpose = opts.mode === "final" ? "illustration-finale" : opts.mode === "correction" ? "illustration-correction" : "illustration-regeneree";
  try {
    const r = await provider.generate({ prompt, negativePrompt: ill.negative ?? undefined, size, quality, model, references: references.length ? references : undefined, label: `${opts.mode === "final" ? "Version finale" : "Reprise"} — ${ill.slot ?? ill.kind}` });
    const asset = await storeAsset({ key: `illustrations/${ill.bookId ?? ill.activityId}/${ill.slot ? `kit-${ill.slot}-` : ""}${record.id}.png`, data: r.data, mime: r.mime, width: r.width, height: r.height });
    const status = opts.mode === "final" && ill.status === "ACCEPTED" ? "ACCEPTED" : "GENERATED";
    await prisma.illustration.update({ where: { id: record.id }, data: { status, assetId: asset.id, isDemo: r.isDemo, costUsd: r.costUsd, provider: r.provider, model: r.model } });
    await initIllustrationFraming(record.id, r.data).catch(() => undefined);
    await prisma.generationLog.create({ data: { kind: "image", provider: r.provider, model: r.model, purpose, bookId: bookId ?? undefined, activityId: ill.activityId ?? undefined, jobId: opts.jobId, images: 1, costUsd: r.costUsd, durationMs: Date.now() - started, success: true } }).catch(() => undefined);
    if (bookId) await swapIllustrationInPages(bookId, ill.id, { id: record.id, src: `/api/assets/${asset.id}`, isDemo: r.isDemo });
    return { illustrationId: record.id, costUsd: r.costUsd, isDemo: r.isDemo };
  } catch (err) {
    await prisma.illustration.delete({ where: { id: record.id } }).catch(() => undefined);
    await prisma.illustration.update({ where: { id: ill.id }, data: { isCurrent: true } }).catch(() => undefined);
    if (!isManualInputRequired(err)) {
      await prisma.generationLog.create({ data: { kind: "image", provider: provider.name, model, purpose, bookId: bookId ?? undefined, jobId: opts.jobId, images: 0, costUsd: 0, durationMs: Date.now() - started, success: false, error: err instanceof Error ? err.message : String(err) } }).catch(() => undefined);
    }
    throw err;
  }
}

/** Illustrations courantes d'un livre (kit, couverture, activités). */
export async function currentBookIllustrations(bookId: string) {
  const links = await prisma.bookActivity.findMany({ where: { bookId }, select: { activityId: true } });
  return prisma.illustration.findMany({
    where: { isCurrent: true, OR: [{ bookId }, { activityId: { in: links.map((l) => l.activityId) } }] },
    include: { asset: true },
    orderBy: [{ kind: "asc" }, { slot: "asc" }, { stepIndex: "asc" }],
  });
}

/** Esquisses à finaliser et coûts (esquisses déjà payées, version finale estimée). */
export async function sketchSummary(bookId: string) {
  const settings = await getAiSettings();
  const model = effectiveImageModel(settings);
  const ills = await currentBookIllustrations(bookId);
  const sketches = ills.filter((i) => i.isSketch && i.assetId && i.status !== "REJECTED");
  const sketchCost = sketches.reduce((a, i) => a + Number(i.costUsd ?? 0), 0);
  const finalCost = sketches.reduce((a, i) => a + imageCost(model, settings.imageQuality, sizeForRatio(reworkRatio(i))), 0);
  return { count: sketches.length, ids: sketches.map((i) => i.id), sketchCostUsd: sketchCost, finalCostUsd: settings.imageProvider === "mock" || manualImages(settings) ? 0 : finalCost, quality: settings.imageQuality };
}

/**
 * « Valider les esquisses et générer la version finale » : les esquisses retenues sont
 * validées puis reprises une à une en qualité finale (même prompt, esquisse en référence).
 * Les images non retenues (refusées) ne sont pas payées.
 */
export async function finalizeSketches(bookId: string, opts: { illustrationIds?: string[]; jobId?: string; onProgress?: (done: number, total: number, label: string) => Promise<void> } = {}) {
  const ills = await currentBookIllustrations(bookId);
  const targets = ills.filter((i) => i.isSketch && i.assetId && i.status !== "REJECTED" && (!opts.illustrationIds || opts.illustrationIds.includes(i.id)));
  let cost = 0;
  let done = 0;
  const errors: string[] = [];
  let waiting = 0;
  for (const ill of targets) {
    await opts.onProgress?.(done, targets.length, ill.slot ?? ill.kind);
    await prisma.illustration.update({ where: { id: ill.id }, data: { status: "ACCEPTED" } });
    try {
      const r = await reworkIllustration({ illustrationId: ill.id, mode: "final", jobId: opts.jobId });
      cost += r.costUsd;
    } catch (err) {
      if (isManualInputRequired(err)) waiting++;
      else errors.push(`${ill.slot ?? ill.kind} : ${err instanceof Error ? err.message : String(err)}`);
    }
    done++;
  }
  return { finalized: done - errors.length - waiting, total: targets.length, costUsd: cost, errors, waiting };
}
