import { prisma } from "../db";
import { getAiSettings } from "../settings";
import { getImageProvider, effectiveImageModel } from "../ai/registry";
import { getStorage, storeAsset } from "../storage";
import { getActivityContent } from "./activity";
import { getVisualReference, bookArtStyle } from "./visualReference";
import { finalIllustrationPrompt, stepIllustrationPrompt, coverIllustrationPrompt, negativeFor } from "./prompts";
import type { IllustrationKind } from "@prisma/client";

/**
 * Génère (ou régénère) UNE illustration : résultat final, étape ou couverture.
 * - Crée une nouvelle version (parentId = version précédente), marquée isCurrent.
 * - Utilise la fiche de référence et les images déjà ACCEPTÉES comme références visuelles.
 * - Ne considère jamais l'image comme validée : statut GENERATED (ou isDemo).
 */
export async function generateIllustration(opts: {
  activityId?: string;
  bookId?: string;
  kind: IllustrationKind;
  stepIndex?: number;
  jobId?: string;
  coverVariant?: number;
}) {
  const settings = await getAiSettings();
  const provider = getImageProvider(settings);
  const model = effectiveImageModel(settings);

  let prompt = "";
  let negative = "";
  let label = "";
  const references: Buffer[] = [];
  let artStyle = "aquarelle";

  if (opts.kind === "COVER") {
    const book = await prisma.book.findUniqueOrThrow({ where: { id: opts.bookId! } });
    const cover = (book.cover ?? {}) as { illustrationBrief?: string };
    artStyle = book.artStyle;
    prompt = coverIllustrationPrompt(cover.illustrationBrief || `${book.title} — children's activity book cover`, artStyle, opts.coverVariant ?? 0);
    negative = negativeFor(null);
    label = `Couverture — ${book.title}`;
  } else {
    const content = await getActivityContent(opts.activityId!);
    if (!content) throw new Error("Fiche d'activité absente");
    const ref = await getVisualReference(opts.activityId!);
    artStyle = await bookArtStyle(opts.activityId!);
    negative = negativeFor(ref);
    if (opts.kind === "FINAL") {
      prompt = finalIllustrationPrompt(content, ref, artStyle);
      label = `Résultat final — ${content.title}`;
    } else {
      const idx = opts.stepIndex ?? 0;
      if (!content.steps[idx]) throw new Error(`Étape ${idx + 1} inexistante`);
      prompt = stepIllustrationPrompt(content, idx, ref, artStyle);
      label = `Étape ${idx + 1} — ${content.steps[idx].title}`;
    }
    // Références : images déjà validées de la même activité (finale puis étapes précédentes)
    const accepted = await prisma.illustration.findMany({
      where: { activityId: opts.activityId, status: "ACCEPTED", isDemo: false, assetId: { not: null } },
      include: { asset: true },
      orderBy: [{ kind: "asc" }, { stepIndex: "asc" }],
      take: 3,
    });
    const storage = getStorage();
    for (const ill of accepted) {
      if (ill.asset) references.push(await storage.get(ill.asset.key));
    }
  }

  // Archive la version courante
  const previous = await prisma.illustration.findFirst({
    where: { activityId: opts.activityId ?? null, bookId: opts.kind === "COVER" ? opts.bookId : undefined, kind: opts.kind, stepIndex: opts.stepIndex ?? null, isCurrent: true },
    orderBy: { version: "desc" },
  });
  const record = await prisma.illustration.create({
    data: {
      activityId: opts.activityId,
      bookId: opts.kind === "COVER" ? opts.bookId : undefined,
      kind: opts.kind,
      stepIndex: opts.stepIndex,
      version: (previous?.version ?? 0) + 1,
      parentId: previous?.id,
      status: "GENERATING",
      prompt,
      negative,
      provider: provider.name,
      model,
      isCurrent: true,
    },
  });
  if (previous) await prisma.illustration.update({ where: { id: previous.id }, data: { isCurrent: false } });

  const started = Date.now();
  try {
    const result = await provider.generate({ prompt, negativePrompt: negative, size: settings.imageSize, quality: settings.imageQuality, model, references, label });
    const key = `illustrations/${opts.activityId ?? opts.bookId}/${record.id}.png`;
    const asset = await storeAsset({ key, data: result.data, mime: result.mime, width: result.width, height: result.height });
    await prisma.illustration.update({
      where: { id: record.id },
      data: { status: "GENERATED", assetId: asset.id, isDemo: result.isDemo, costUsd: result.costUsd, provider: result.provider, model: result.model },
    });
    await prisma.generationLog.create({
      data: { kind: "image", provider: result.provider, model: result.model, purpose: opts.kind === "COVER" ? "cover" : "illustration", bookId: opts.bookId, activityId: opts.activityId, jobId: opts.jobId, images: 1, costUsd: result.costUsd, durationMs: Date.now() - started, success: true },
    });
    return { illustrationId: record.id, assetId: asset.id, isDemo: result.isDemo, costUsd: result.costUsd };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.illustration.update({ where: { id: record.id }, data: { status: "FAILED", error: message } });
    await prisma.generationLog.create({
      data: { kind: "image", provider: provider.name, model, purpose: opts.kind === "COVER" ? "cover" : "illustration", bookId: opts.bookId, activityId: opts.activityId, jobId: opts.jobId, images: 0, costUsd: 0, durationMs: Date.now() - started, success: false, error: message },
    });
    throw err;
  }
}

/** Validation visuelle humaine : accepte ou refuse une illustration. */
export async function reviewIllustration(id: string, decision: "ACCEPTED" | "REJECTED", note?: string) {
  return prisma.illustration.update({ where: { id }, data: { status: decision, reviewNote: note ?? null } });
}

/** Liste des illustrations courantes d'une activité (finale + étapes). */
export async function currentIllustrations(activityId: string) {
  return prisma.illustration.findMany({ where: { activityId, isCurrent: true }, include: { asset: true }, orderBy: [{ kind: "asc" }, { stepIndex: "asc" }] });
}
