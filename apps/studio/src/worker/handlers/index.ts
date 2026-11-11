import { prisma } from "@/lib/db";
import { QUEUES } from "@/lib/queue/boss";
import { enqueue, setJob, jobLog, controlSignal, waitWhilePaused, type JobPayload } from "@/lib/queue/jobs";
import { generateOutline } from "@/lib/generation/outline";
import { generateActivityContent, getActivityContent } from "@/lib/generation/activity";
import { generateVisualReference, getVisualReference } from "@/lib/generation/visualReference";
import { generateIllustration } from "@/lib/generation/illustration";
import { generateCoverTexts } from "@/lib/generation/cover";
import { rebuildBookPages } from "@/lib/layout/book";
import { runActivityChecks } from "@/lib/quality/checks";
import { runExport } from "@/lib/export";
import { publishBookToShop } from "@/lib/shop/publish";
import { getShopSettings } from "@/lib/settings";
import { ShopListingSchema } from "@/lib/schemas/settings";
import { getAiSettings } from "@/lib/settings";
import type { IllustrationKind, Prisma } from "@prisma/client";
import { isManualInputRequired } from "@/lib/ai/manual-core";
import { markWaitingInput } from "@/lib/manual/requests";
import { isStructuredKit, kitType } from "@/lib/kits/types";
import { generateKitContent, generateKitIllustration, isCharacterSheetSlot, kitIllustrationPlan, pendingCount, readKitContent } from "@/lib/kits/generate";
import { runPool } from "@/lib/kits/batches";
import { bookImageSettings, realImageProvider } from "@/lib/ai/book-settings";
import { manualImages } from "@/lib/ai/registry";
import { isDrawingSlot } from "@/lib/kits/coloring";
import { ensureSheetBatchRequest, processSheetBatch, rejectedSheetSlots, sheetGridOf } from "@/lib/coloring/sheet-batch";
import { mainCount } from "@/lib/kits/content";
import { runClipStep, runRenderStep } from "@/lib/video/worker";
import { processAutopilotRun } from "@/lib/autopilot/runner";
import { needsGeneration } from "@/lib/generation/regen-policy";
import { finalizeSketches, reworkIllustration, type ReworkMode } from "@/lib/generation/rework";

type Handler = (data: JobPayload) => Promise<unknown>;

/** Signal interne : la tâche s'est mise en attente de réponses à coller (déjà marquée WAITING_INPUT). */
export class WaitingInputSignal extends Error {
  constructor(public readonly count: number) {
    super(`En attente de ${count} réponse(s) à coller`);
    this.name = "WaitingInputSignal";
  }
}

async function spentOnBook(bookId: string) {
  const agg = await prisma.generationLog.aggregate({ where: { bookId }, _sum: { costUsd: true } });
  return Number(agg._sum.costUsd ?? 0);
}

/** Vérifie pause/annulation ; renvoie false si le job doit s'arrêter. */
async function gate(jobId: string) {
  const s = await controlSignal(jobId);
  if (s === "cancelled") return false;
  if (s === "paused") {
    await jobLog(jobId, "Job en pause");
    const r = await waitWhilePaused(jobId);
    if (r === "cancelled") return false;
    await jobLog(jobId, "Reprise du job");
  }
  return true;
}

export const handlers: Record<string, Handler> = {
  // Copier-coller « en lot » : découpage des planches déposées (puis écran de vérification)
  [QUEUES.coloringSheets]: async ({ jobId, requestId }) => {
    await setJob(jobId, { status: "RUNNING", step: "Découpage des planches", progress: 5 });
    const p = await processSheetBatch(requestId as string, (m) => setJob(jobId, { step: m }));
    if (p.error) throw new Error(p.error);
    await setJob(jobId, { status: "COMPLETED", progress: 100, step: `${p.cells.length} dessin(s) découpé(s) : à vérifier`, result: { cells: p.cells.length } });
  },
  // Vidéos publicitaires : clip d'accroche (Runway / copier-coller / démo) puis montage Remotion
  [QUEUES.adClip]: async ({ jobId, adVideoId }) => runClipStep(adVideoId as string, jobId),
  [QUEUES.adRender]: async ({ jobId, adVideoId }) => runRenderStep(adVideoId as string, jobId),
  // Pilote automatique : brief → kit → PDF → boutique → vidéos → publicités
  [QUEUES.autopilotRun]: async ({ jobId, runId }) => processAutopilotRun(runId as string, jobId),
  [QUEUES.bookOutline]: async ({ jobId, bookId }) => {
    const kb = await prisma.book.findUniqueOrThrow({ where: { id: bookId! }, select: { kitType: true } });
    if (isStructuredKit(kb.kitType)) {
      await setJob(jobId, { status: "RUNNING", step: "Rédaction du contenu du kit", progress: 10 });
      try {
        const r = await generateKitContent(bookId!, { jobId, onProgress: (step) => setJob(jobId, { step }) });
        const n = mainCount(r.content);
        await setJob(jobId, { status: "COMPLETED", progress: 100, step: `Contenu du kit rédigé (${n} éléments${r.batches > 1 ? `, ${r.batches} lots` : ""})`, costUsd: r.usage.costUsd, result: { count: n } });
      } catch (err) {
        if (isManualInputRequired(err)) {
          const n = pendingCount(err);
          await markWaitingInput(jobId, n);
          throw new WaitingInputSignal(n);
        }
        throw err;
      }
      return;
    }
    await setJob(jobId, { status: "RUNNING", step: "Génération du sommaire", progress: 10 });
    const outline = await generateOutline(bookId!, { jobId });
    await setJob(jobId, { status: "COMPLETED", progress: 100, step: `${outline.activities.length} activités proposées`, result: { count: outline.activities.length } });
    return outline;
  },

  [QUEUES.activityGenerate]: async ({ jobId, activityId, bookId }) => {
    await setJob(jobId, { status: "RUNNING", step: "Rédaction de la fiche", progress: 20 });
    const r = await generateActivityContent(activityId!, { jobId, bookId });
    await setJob(jobId, { progress: 70, step: "Fiche de référence visuelle", costUsd: r.usage.costUsd });
    const v = await generateVisualReference(activityId!, { jobId, bookId });
    await setJob(jobId, { status: "COMPLETED", progress: 100, step: "Fiche rédigée", costUsd: v.usage.costUsd });
  },

  [QUEUES.activityIllustrate]: async ({ jobId, activityId, bookId, sketch }) => {
    await setJob(jobId, { status: "RUNNING", step: "Préparation", progress: 5 });
    const settings = await getAiSettings();
    const content = await getActivityContent(activityId!);
    if (!content) throw new Error("Fiche non rédigée");
    if (!(await getVisualReference(activityId!))) {
      await setJob(jobId, { step: "Fiche de référence visuelle", progress: 10 });
      const v = await generateVisualReference(activityId!, { jobId, bookId });
      await setJob(jobId, { costUsd: v.usage.costUsd });
    }
    const plan: { kind: IllustrationKind; stepIndex?: number }[] = [{ kind: "FINAL" }];
    if (settings.stepIllustrations) content.steps.slice(0, settings.maxStepIllustrations).forEach((_, i) => plan.push({ kind: "STEP", stepIndex: i }));
    let cost = 0;
    let waiting = 0;
    for (let i = 0; i < plan.length; i++) {
      if (!(await gate(jobId))) return;
      if (bookId && (await spentOnBook(bookId)) > settings.maxBudgetPerBookUsd) {
        await jobLog(jobId, `Budget du livre dépassé (${settings.maxBudgetPerBookUsd} $) : illustrations interrompues`, "warn");
        break;
      }
      const p = plan[i];
      // Pas de regénération implicite : une image acceptée, générée ou collée est conservée
      const current = await prisma.illustration.findFirst({ where: { activityId, kind: p.kind, stepIndex: p.stepIndex ?? null, isCurrent: true }, orderBy: { version: "desc" } });
      if (!needsGeneration(current, { realProvider: settings.imageProvider !== "mock" || settings.mode === "manual" })) continue;
      await setJob(jobId, { step: p.kind === "FINAL" ? "Illustration du résultat final" : `Illustration de l'étape ${p.stepIndex! + 1}`, progress: 10 + Math.round((i / plan.length) * 85) });
      try {
        const r = await generateIllustration({ activityId, bookId, kind: p.kind, stepIndex: p.stepIndex, jobId, sketch: typeof sketch === "boolean" ? sketch : undefined });
        cost += r.costUsd;
        await setJob(jobId, { costUsd: r.costUsd });
      } catch (err) {
        if (isManualInputRequired(err)) {
          waiting++;
          continue;
        }
        await jobLog(jobId, `Échec illustration ${p.kind} ${p.stepIndex ?? ""} : ${err instanceof Error ? err.message : err}`, "error");
      }
    }
    if (waiting > 0) {
      await markWaitingInput(jobId, waiting);
      throw new WaitingInputSignal(waiting);
    }
    await runActivityChecks(activityId!, { requireSteps: settings.stepIllustrations });
    await setJob(jobId, { status: "COMPLETED", progress: 100, step: "Illustrations générées", result: { costUsd: cost } });
  },

  [QUEUES.illustrationSingle]: async ({ jobId, activityId, bookId, kind, stepIndex, coverVariant }) => {
    await setJob(jobId, { status: "RUNNING", step: "Génération de l'illustration", progress: 20 });
    const r = await generateIllustration({ activityId, bookId, kind: kind as IllustrationKind, stepIndex: stepIndex as number | undefined, jobId, coverVariant: coverVariant as number | undefined });
    if (activityId) await runActivityChecks(activityId);
    await setJob(jobId, { status: "COMPLETED", progress: 100, step: "Illustration générée", costUsd: r.costUsd, result: { illustrationId: r.illustrationId, isDemo: r.isDemo } });
  },

  [QUEUES.bookCover]: async ({ jobId, bookId, variants, onlyIfMissing, sketch }) => {
    await setJob(jobId, { status: "RUNNING", step: "Textes de couverture", progress: 10 });
    // Relance d'un pipeline : la couverture existante n'est jamais regénérée implicitement
    if (onlyIfMissing) {
      const s0 = await getAiSettings();
      const current = await prisma.illustration.findFirst({ where: { bookId, kind: "COVER", isCurrent: true }, orderBy: { version: "desc" } });
      if (!needsGeneration(current, { realProvider: s0.imageProvider !== "mock" || s0.mode === "manual" })) {
        await setJob(jobId, { status: "COMPLETED", progress: 100, step: "Couverture conservée (aucune regénération)" });
        return;
      }
    }
    const cb = await prisma.book.findUniqueOrThrow({ where: { id: bookId! }, select: { kitType: true, kitContent: true } });
    // Kits : les textes de couverture viennent du contenu du kit (pas d'appel IA supplémentaire)
    if (!(isStructuredKit(cb.kitType) && cb.kitContent)) {
      const r = await generateCoverTexts(bookId!, { jobId });
      await setJob(jobId, { costUsd: r.usage.costUsd });
    }
    await setJob(jobId, { progress: 40, step: "Illustration de couverture" });
    const n = Math.max(1, Math.min(4, Number(variants ?? 2)));
    let waiting = 0;
    let produced = 0;
    let lastError = "";
    for (let v = 0; v < n; v++) {
      if (!(await gate(jobId))) return;
      // Mode copier-coller : variante déjà collée → on ne la redemande pas
      const pasted = await prisma.illustration.findFirst({ where: { bookId, kind: "COVER", isCurrent: true, status: { in: ["GENERATED", "ACCEPTED"] }, provider: "manual" }, skip: v });
      if (pasted) { produced++; continue; }
      try {
        const ill = await generateIllustration({ bookId, kind: "COVER", jobId, coverVariant: v, sketch: typeof sketch === "boolean" ? sketch : undefined });
        produced++;
        await setJob(jobId, { progress: 40 + Math.round(((v + 1) / n) * 55), costUsd: ill.costUsd });
      } catch (err) {
        if (isManualInputRequired(err)) {
          waiting++;
          continue;
        }
        lastError = err instanceof Error ? err.message : String(err);
        await jobLog(jobId, `Échec couverture variante ${v + 1} : ${lastError}`, "error");
      }
    }
    if (waiting > 0) {
      await markWaitingInput(jobId, waiting);
      throw new WaitingInputSignal(waiting);
    }
    // Aucune variante obtenue : l'échec doit remonter (avec sa cause) au lieu d'annoncer « Couverture générée »
    if (produced === 0 && lastError) {
      await setJob(jobId, { status: "FAILED", error: lastError, step: "Échec de la couverture" });
      throw new Error(lastError);
    }
    await setJob(jobId, { status: "COMPLETED", progress: 100, step: "Couverture générée" });
  },

  // Reprise volontaire d'une image (version finale, correction, nouvelle image)
  [QUEUES.illustrationRework]: async ({ jobId, illustrationId, mode, correction }) => {
    await setJob(jobId, { status: "RUNNING", step: mode === "final" ? "Version finale de l'image" : "Reprise de l'image", progress: 20 });
    try {
      const r = await reworkIllustration({ illustrationId: illustrationId as string, mode: mode as ReworkMode, correction: correction as string | undefined, jobId });
      await setJob(jobId, { status: "COMPLETED", progress: 100, step: "Image mise à jour dans les pages", costUsd: r.costUsd, result: { illustrationId: r.illustrationId } });
    } catch (err) {
      if (isManualInputRequired(err)) {
        await markWaitingInput(jobId, 1);
        throw new WaitingInputSignal(1);
      }
      throw err;
    }
  },

  // « Valider les esquisses et générer la version finale »
  [QUEUES.bookFinalize]: async ({ jobId, bookId, illustrationIds }) => {
    await setJob(jobId, { status: "RUNNING", step: "Versions finales", progress: 5 });
    const r = await finalizeSketches(bookId!, {
      illustrationIds: Array.isArray(illustrationIds) ? (illustrationIds as string[]) : undefined,
      jobId,
      onProgress: async (done, total, label) => setJob(jobId, { step: `Version finale ${done + 1}/${total} : ${label}`, progress: 5 + Math.round((done / Math.max(1, total)) * 90) }),
    });
    for (const e of r.errors) await jobLog(jobId, `Échec version finale ${e}`, "error");
    if (r.waiting > 0) {
      await markWaitingInput(jobId, r.waiting);
      throw new WaitingInputSignal(r.waiting);
    }
    await setJob(jobId, { status: r.errors.length && !r.finalized ? "FAILED" : "COMPLETED", progress: 100, step: `${r.finalized}/${r.total} image(s) en version finale`, costUsd: r.costUsd, error: r.errors.length ? r.errors.join(" | ") : null, result: r as unknown as Prisma.InputJsonValue });
  },

  [QUEUES.bookLayout]: async ({ jobId, bookId, force }) => {
    await setJob(jobId, { status: "RUNNING", step: "Assemblage des pages", progress: 30 });
    const pages = await rebuildBookPages(bookId!, { force: Boolean(force) });
    await setJob(jobId, { status: "COMPLETED", progress: 100, step: `${pages.length} pages assemblées`, result: { pages: pages.length } });
  },

  [QUEUES.bookExport]: async ({ jobId, exportId, bookId, skipAutoPublish }) => {
    await setJob(jobId, { status: "RUNNING", step: "Rendu PDF", progress: 20 });
    const r = await runExport(exportId as string);
    await setJob(jobId, { status: "COMPLETED", progress: 100, step: `PDF de ${r.pageCount} pages`, result: r.checks as never });
    // Publication automatique vers la boutique après un export de livre (jamais bloquante pour l'export).
    // Le pilote automatique publie lui-même, avec ses propres réglages.
    if (bookId && !skipAutoPublish) await maybeAutoPublish(bookId, exportId as string, jobId);
  },

  /** Publication (ou re-synchronisation) manuelle d'un livre vers la boutique. */
  [QUEUES.shopPublish]: async ({ jobId, bookId, exportId, publish }) => {
    await setJob(jobId, { status: "RUNNING", step: "Synchronisation avec la boutique", progress: 10 });
    const r = await publishBookToShop(bookId!, { exportId: exportId as string | undefined, publish: publish as boolean | undefined, log: (m) => jobLog(jobId, m) });
    for (const w of r.warnings) await jobLog(jobId, w, "warn");
    const label = r.status === "published" ? "Publié dans la boutique" : r.status === "draft_pending_review" ? "Brouillon en attente de validation dans la boutique" : "Fiche mise à jour";
    await setJob(jobId, { status: "COMPLETED", progress: 100, step: label, result: { productId: r.product.id, slug: r.product.slug, publicUrl: r.product.publicUrl, status: r.status } });
  },

  /**
   * Pipeline complet d'un livre :
   * concepts → fiches → références visuelles → illustrations → pages → contrôles → statut REVIEW.
   * Chaque activité avance indépendamment ; un échec n'efface rien de ce qui a été produit.
   */
  [QUEUES.bookPipeline]: async ({ jobId, bookId, withIllustrations, withCover, sketch }) => {
    const sk = typeof sketch === "boolean" ? sketch : undefined;
    const settings = await getAiSettings();
    await setJob(jobId, { status: "RUNNING", step: "Démarrage", progress: 1 });
    await prisma.book.update({ where: { id: bookId! }, data: { status: "GENERATING" } });
    const pb = await prisma.book.findUniqueOrThrow({ where: { id: bookId! }, select: { kitType: true } });
    if (isStructuredKit(pb.kitType)) return runKitPipeline(jobId, bookId!, { withIllustrations: withIllustrations !== false, withCover: withCover !== false, sketch: sk });
    const links = await prisma.bookActivity.findMany({ where: { bookId: bookId! }, include: { activity: true }, orderBy: { position: "asc" } });
    const total = links.length;
    const errors: string[] = [];
    let waiting = 0; // mode copier-coller : réponses à coller avant de continuer

    // 1. Fiches (idempotent : une fiche déjà rédigée est conservée, une référence visuelle manquante est complétée)
    for (let i = 0; i < links.length; i++) {
      if (!(await gate(jobId))) return finish(jobId, bookId!, "CANCELLED");
      const a = links[i].activity;
      const hasContent = Boolean(a.currentVersionId && a.status !== "CONCEPT");
      const hasReference = hasContent && Boolean(await getVisualReference(a.id));
      if (hasContent && hasReference) continue;
      await setJob(jobId, { step: `Rédaction ${i + 1}/${total} : ${a.title}`, progress: 2 + Math.round((i / total) * 30) });
      const child = await prisma.job.create({ data: { type: QUEUES.activityGenerate, status: "RUNNING", bookId, activityId: a.id, parentId: jobId, startedAt: new Date() } });
      try {
        let cost = 0;
        if (!hasContent) cost += (await generateActivityContent(a.id, { jobId: child.id, bookId })).usage.costUsd;
        if (!hasReference) cost += (await generateVisualReference(a.id, { jobId: child.id, bookId })).usage.costUsd;
        await setJob(child.id, { status: "COMPLETED", progress: 100, step: "Fiche rédigée", costUsd: cost });
        await setJob(jobId, { costUsd: cost });
      } catch (err) {
        if (isManualInputRequired(err)) {
          waiting++;
          await setJob(child.id, { status: "WAITING_INPUT", step: "Réponse à coller" });
          continue;
        }
        const m = err instanceof Error ? err.message : String(err);
        errors.push(`${a.title} : ${m}`);
        await setJob(child.id, { status: "FAILED", error: m });
        await jobLog(jobId, `Échec rédaction « ${a.title} » : ${m}`, "error");
      }
      if ((await spentOnBook(bookId!)) > settings.maxBudgetPerBookUsd) {
        await jobLog(jobId, "Budget maximal du livre atteint : arrêt du pipeline", "warn");
        return finish(jobId, bookId!, "FAILED", "Budget maximal atteint");
      }
    }

    // 2. Illustrations
    if (withIllustrations !== false) {
      for (let i = 0; i < links.length; i++) {
        if (!(await gate(jobId))) return finish(jobId, bookId!, "CANCELLED");
        const a = links[i].activity;
        const content = await getActivityContent(a.id);
        if (!content) continue;
        await setJob(jobId, { step: `Illustrations ${i + 1}/${total} : ${a.title}`, progress: 32 + Math.round((i / total) * 50) });
        const child = await prisma.job.create({ data: { type: QUEUES.activityIllustrate, status: "RUNNING", bookId, activityId: a.id, parentId: jobId, startedAt: new Date() } });
        try {
          await handlers[QUEUES.activityIllustrate]({ jobId: child.id, activityId: a.id, bookId, sketch: sk });
          const c = await prisma.job.findUnique({ where: { id: child.id } });
          await setJob(jobId, { costUsd: Number(c?.costUsd ?? 0) });
        } catch (err) {
          if (err instanceof WaitingInputSignal) {
            waiting += err.count;
            continue;
          }
          const m = err instanceof Error ? err.message : String(err);
          errors.push(`${a.title} (illustrations) : ${m}`);
          await setJob(child.id, { status: "FAILED", error: m });
        }
      }
    }

    // 3. Couverture
    if (withCover) {
      if (!(await gate(jobId))) return finish(jobId, bookId!, "CANCELLED");
      await setJob(jobId, { step: "Couverture", progress: 84 });
      const child = await prisma.job.create({ data: { type: QUEUES.bookCover, status: "RUNNING", bookId, parentId: jobId, startedAt: new Date() } });
      try {
        await handlers[QUEUES.bookCover]({ jobId: child.id, bookId, variants: 2, onlyIfMissing: true, sketch: sk });
      } catch (err) {
        if (err instanceof WaitingInputSignal) {
          waiting += err.count;
        } else {
        const m = err instanceof Error ? err.message : String(err);
        errors.push(`Couverture : ${m}`);
        await setJob(child.id, { status: "FAILED", error: m });
        }
      }
    }

    // Mode copier-coller : on s'arrête ici, la tâche reprendra automatiquement une fois les réponses collées
    if (waiting > 0) {
      await markWaitingInput(jobId, waiting);
      return;
    }

    // 4. Pages + contrôles
    if (!(await gate(jobId))) return finish(jobId, bookId!, "CANCELLED");
    await setJob(jobId, { step: "Assemblage des pages", progress: 90 });
    await rebuildBookPages(bookId!);
    await setJob(jobId, { step: "Contrôles qualité", progress: 96 });
    for (const l of links) await runActivityChecks(l.activityId, { requireSteps: settings.stepIllustrations }).catch(() => undefined);

    await finish(jobId, bookId!, errors.length ? "COMPLETED" : "COMPLETED", errors.length ? `${errors.length} erreur(s) : ${errors.join(" | ")}` : undefined);
  },
};

/**
 * Pipeline d'un kit structuré : contenu (si absent) → illustrations par emplacement →
 * couverture → pages. Idempotent : ce qui existe (contenu, images générées ou collées) est conservé.
 */
async function runKitPipeline(jobId: string, bookId: string, opts: { withIllustrations: boolean; withCover: boolean; sketch?: boolean }) {
  const settings = await getAiSettings();
  let waiting = 0;
  const errors: string[] = [];
  let book = await prisma.book.findUniqueOrThrow({ where: { id: bookId } });
  let content = readKitContent(book);
  if (!content) {
    await setJob(jobId, { step: "Rédaction du contenu du kit", progress: 5 });
    try {
      const r = await generateKitContent(bookId, { jobId });
      await setJob(jobId, { costUsd: r.usage.costUsd });
      book = await prisma.book.findUniqueOrThrow({ where: { id: bookId } });
      content = readKitContent(book);
    } catch (err) {
      if (isManualInputRequired(err)) {
        await markWaitingInput(jobId, 1);
        return;
      }
      throw err;
    }
  }
  if (!content) return finish(jobId, bookId, "FAILED", "Contenu du kit invalide");

  if (opts.withIllustrations) {
    const imgSettings = bookImageSettings(settings, book);
    const coloring = kitType(book.kitType).format === "coloring";
    // Cahier de coloriage : esquisses seulement si activées pour le type / le livre
    const sketch = coloring ? Boolean(opts.sketch ?? imgSettings.sketchMode) && imgSettings.sketchMode : opts.sketch;
    const plan = kitIllustrationPlan(content, book);
    const real = realImageProvider(imgSettings);
    const rejected = coloring ? await rejectedSheetSlots(bookId) : new Set<string>();
    // Copier-coller « en lot » (cahier de coloriage) : une seule demande pour toutes les planches
    if (coloring && manualImages(imgSettings) && sheetGridOf(book) > 1) {
      const r = await ensureSheetBatchRequest(bookId, jobId, plan);
      if (r.pending) {
        await jobLog(jobId, `Lot d'images : ${r.drawings} dessin(s) en ${r.sheets} planche(s) à produire dans ChatGPT puis à déposer (page « À coller »)`);
        waiting++;
      }
    }
    // Reprise image par image : seules les images manquantes (ou de démonstration à remplacer) sont générées
    const current = await prisma.illustration.findMany({ where: { bookId, kind: "KIT", isCurrent: true }, orderBy: { version: "desc" } });
    const bySlot = new Map<string, (typeof current)[number]>();
    for (const c of current) if (c.slot && !bySlot.has(c.slot)) bySlot.set(c.slot, c);
    const todo = plan.filter((it) => needsGeneration(bySlot.get(it.slot) ?? null, { realProvider: real }) && !(waiting && coloring && isDrawingSlot(it.slot)));
    const total = plan.length;
    let done = total - todo.length;
    let stopped: "budget" | "cancelled" | null = null;
    const step = (label: string) => setJob(jobId, { step: `Illustrations ${done}/${total}${label ? ` : ${label}` : ""}`, progress: 10 + Math.round((done / Math.max(1, total)) * 70) });
    const one = async (it: (typeof plan)[number]) => {
      if (stopped) return;
      if (!(await gate(jobId))) { stopped = "cancelled"; return; }
      if ((await spentOnBook(bookId)) > settings.maxBudgetPerBookUsd) {
        if (!stopped) await jobLog(jobId, `Budget du livre dépassé (${settings.maxBudgetPerBookUsd} $, Paramètres → IA) : illustrations interrompues à ${done}/${total}, relancez pour continuer`, "warn");
        stopped = "budget";
        return;
      }
      try {
        const via = rejected.has(it.slot) && settings.imageProvider === "openai" ? ("api" as const) : undefined;
        const r = await generateKitIllustration({ bookId, slot: it.slot, prompt: it.prompt, label: it.label, jobId, sketch, via });
        await setJob(jobId, { costUsd: r.costUsd });
      } catch (err) {
        if (isManualInputRequired(err)) { waiting++; return; }
        const m = err instanceof Error ? err.message : String(err);
        errors.push(`${it.label} : ${m}`);
        await jobLog(jobId, `Échec illustration « ${it.label} » : ${m}`, "error");
      } finally {
        done++;
        await step(it.label);
      }
    };
    await step("");
    // La planche de personnages d'abord (elle sert de référence aux autres), puis une file avec concurrence réglable
    const sheets = todo.filter((it) => isCharacterSheetSlot(it.slot) || it.slot === "dessin-1");
    for (const it of sheets) await one(it);
    const rest = todo.filter((it) => !sheets.includes(it));
    const concurrency = imgSettings.mode === "manual" ? 1 : Math.max(1, Math.min(10, settings.maxConcurrentGenerations));
    await runPool(rest.map((it) => () => one(it)), concurrency);
    if (stopped === "cancelled") return finish(jobId, bookId, "CANCELLED");
  }

  if (opts.withCover) {
    if (!(await gate(jobId))) return finish(jobId, bookId, "CANCELLED");
    await setJob(jobId, { step: "Couverture", progress: 84 });
    const child = await prisma.job.create({ data: { type: QUEUES.bookCover, status: "RUNNING", bookId, parentId: jobId, startedAt: new Date() } });
    try {
      await handlers[QUEUES.bookCover]({ jobId: child.id, bookId, variants: 1, onlyIfMissing: true, sketch: opts.sketch });
    } catch (err) {
      if (err instanceof WaitingInputSignal) waiting += err.count;
      else {
        const m = err instanceof Error ? err.message : String(err);
        errors.push(`Couverture : ${m}`);
        await setJob(child.id, { status: "FAILED", error: m });
      }
    }
  }

  if (waiting > 0) {
    await markWaitingInput(jobId, waiting);
    return;
  }
  await setJob(jobId, { step: "Assemblage des pages", progress: 92 });
  const pages = await rebuildBookPages(bookId);
  await jobLog(jobId, `${pages.length} pages assemblées`);
  await finish(jobId, bookId, "COMPLETED", errors.length ? `${errors.length} erreur(s) : ${errors.join(" | ")}` : undefined);
}

async function finish(jobId: string, bookId: string, status: "COMPLETED" | "FAILED" | "CANCELLED", error?: string) {
  await setJob(jobId, { status, progress: status === "COMPLETED" ? 100 : undefined, step: status === "COMPLETED" ? "Terminé — éléments à valider" : status === "CANCELLED" ? "Annulé" : "Échec", error: error ?? null });
  await prisma.book.update({ where: { id: bookId }, data: { status: status === "COMPLETED" ? "REVIEW" : "PLANNED" } });
}

/** Lance le pipeline complet d'un livre (utilisé par l'UI). */
export async function startBookPipeline(bookId: string, opts: { withIllustrations: boolean; withCover: boolean; sketch?: boolean }) {
  return enqueue(QUEUES.bookPipeline, { bookId, ...opts });
}


/**
 * Après un export de livre réussi : si la boutique est configurée et la publication
 * automatique active (réglage global, surchargeable par livre), on synchronise la fiche
 * et on la publie. Les erreurs sont journalisées sur le job d'export sans le faire échouer.
 */
async function maybeAutoPublish(bookId: string, exportId: string, jobId: string) {
  try {
    const exp = await prisma.export.findUnique({ where: { id: exportId }, select: { kind: true, status: true } });
    if (!exp || exp.status !== "COMPLETED" || (exp.kind !== "BOOK_DIGITAL" && exp.kind !== "BOOK_PRINT")) return;
    const settings = await getShopSettings();
    if (!settings.shopApiUrl || !settings.shopApiKey) return;
    const book = await prisma.book.findUnique({ where: { id: bookId }, select: { shopListing: true, exports: { where: { status: "COMPLETED", kind: "BOOK_DIGITAL" }, select: { id: true }, take: 1 } } });
    if (!book) return;
    // Un export imprimable ne déclenche la publication que s'il n'existe pas de version numérique
    if (exp.kind === "BOOK_PRINT" && book.exports.length > 0) return;
    const listing = ShopListingSchema.safeParse(book.shopListing ?? {});
    const auto = listing.success && listing.data.autoPublish !== undefined ? listing.data.autoPublish : settings.autoPublish;
    if (!auto) return;
    await jobLog(jobId, "Publication automatique vers la boutique…");
    const r = await publishBookToShop(bookId, { exportId, publish: true, log: (m) => jobLog(jobId, m) });
    for (const w of r.warnings) await jobLog(jobId, w, "warn");
    await jobLog(jobId, r.status === "published" ? `Publié : ${r.product.publicUrl ?? r.product.slug}` : `Fiche créée en brouillon (validation dans la boutique) : ${r.product.editUrl}`);
  } catch (err) {
    await jobLog(jobId, `Publication boutique échouée : ${err instanceof Error ? err.message : err}`, "error");
  }
}
