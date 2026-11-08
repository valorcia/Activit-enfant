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
import type { IllustrationKind } from "@prisma/client";
import { isManualInputRequired } from "@/lib/ai/manual-core";
import { markWaitingInput } from "@/lib/manual/requests";

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
  [QUEUES.bookOutline]: async ({ jobId, bookId }) => {
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

  [QUEUES.activityIllustrate]: async ({ jobId, activityId, bookId }) => {
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
      // Ne régénère pas une illustration déjà acceptée
      const existing = await prisma.illustration.findFirst({ where: { activityId, kind: p.kind, stepIndex: p.stepIndex ?? null, isCurrent: true, status: "ACCEPTED", isDemo: false } });
      if (existing) continue;
      // Mode copier-coller : une image déjà collée (non encore validée) n'est pas redemandée
      const pasted = await prisma.illustration.findFirst({ where: { activityId, kind: p.kind, stepIndex: p.stepIndex ?? null, isCurrent: true, status: "GENERATED", provider: "manual" } });
      if (pasted) continue;
      await setJob(jobId, { step: p.kind === "FINAL" ? "Illustration du résultat final" : `Illustration de l'étape ${p.stepIndex! + 1}`, progress: 10 + Math.round((i / plan.length) * 85) });
      try {
        const r = await generateIllustration({ activityId, bookId, kind: p.kind, stepIndex: p.stepIndex, jobId });
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

  [QUEUES.bookCover]: async ({ jobId, bookId, variants }) => {
    await setJob(jobId, { status: "RUNNING", step: "Textes de couverture", progress: 10 });
    const r = await generateCoverTexts(bookId!, { jobId });
    await setJob(jobId, { progress: 40, step: "Illustration de couverture", costUsd: r.usage.costUsd });
    const n = Math.max(1, Math.min(4, Number(variants ?? 2)));
    let waiting = 0;
    for (let v = 0; v < n; v++) {
      if (!(await gate(jobId))) return;
      // Mode copier-coller : variante déjà collée → on ne la redemande pas
      const pasted = await prisma.illustration.findFirst({ where: { bookId, kind: "COVER", isCurrent: true, status: { in: ["GENERATED", "ACCEPTED"] }, provider: "manual" }, skip: v });
      if (pasted) continue;
      try {
        const ill = await generateIllustration({ bookId, kind: "COVER", jobId, coverVariant: v });
        await setJob(jobId, { progress: 40 + Math.round(((v + 1) / n) * 55), costUsd: ill.costUsd });
      } catch (err) {
        if (isManualInputRequired(err)) {
          waiting++;
          continue;
        }
        await jobLog(jobId, `Échec couverture variante ${v + 1} : ${err instanceof Error ? err.message : err}`, "error");
      }
    }
    if (waiting > 0) {
      await markWaitingInput(jobId, waiting);
      throw new WaitingInputSignal(waiting);
    }
    await setJob(jobId, { status: "COMPLETED", progress: 100, step: "Couverture générée" });
  },

  [QUEUES.bookLayout]: async ({ jobId, bookId, force }) => {
    await setJob(jobId, { status: "RUNNING", step: "Assemblage des pages", progress: 30 });
    const pages = await rebuildBookPages(bookId!, { force: Boolean(force) });
    await setJob(jobId, { status: "COMPLETED", progress: 100, step: `${pages.length} pages assemblées`, result: { pages: pages.length } });
  },

  [QUEUES.bookExport]: async ({ jobId, exportId, bookId }) => {
    await setJob(jobId, { status: "RUNNING", step: "Rendu PDF", progress: 20 });
    const r = await runExport(exportId as string);
    await setJob(jobId, { status: "COMPLETED", progress: 100, step: `PDF de ${r.pageCount} pages`, result: r.checks as never });
    // Publication automatique vers la boutique après un export de livre (jamais bloquante pour l'export)
    if (bookId) await maybeAutoPublish(bookId, exportId as string, jobId);
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
  [QUEUES.bookPipeline]: async ({ jobId, bookId, withIllustrations, withCover }) => {
    const settings = await getAiSettings();
    await setJob(jobId, { status: "RUNNING", step: "Démarrage", progress: 1 });
    await prisma.book.update({ where: { id: bookId! }, data: { status: "GENERATING" } });
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
          await handlers[QUEUES.activityIllustrate]({ jobId: child.id, activityId: a.id, bookId });
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
        await handlers[QUEUES.bookCover]({ jobId: child.id, bookId, variants: 2 });
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

async function finish(jobId: string, bookId: string, status: "COMPLETED" | "FAILED" | "CANCELLED", error?: string) {
  await setJob(jobId, { status, progress: status === "COMPLETED" ? 100 : undefined, step: status === "COMPLETED" ? "Terminé — éléments à valider" : status === "CANCELLED" ? "Annulé" : "Échec", error: error ?? null });
  await prisma.book.update({ where: { id: bookId }, data: { status: status === "COMPLETED" ? "REVIEW" : "PLANNED" } });
}

/** Lance le pipeline complet d'un livre (utilisé par l'UI). */
export async function startBookPipeline(bookId: string, opts: { withIllustrations: boolean; withCover: boolean }) {
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
