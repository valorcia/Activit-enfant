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
import { getAiSettings } from "@/lib/settings";
import type { IllustrationKind } from "@prisma/client";

type Handler = (data: JobPayload) => Promise<unknown>;

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
      await setJob(jobId, { step: p.kind === "FINAL" ? "Illustration du résultat final" : `Illustration de l'étape ${p.stepIndex! + 1}`, progress: 10 + Math.round((i / plan.length) * 85) });
      try {
        const r = await generateIllustration({ activityId, bookId, kind: p.kind, stepIndex: p.stepIndex, jobId });
        cost += r.costUsd;
        await setJob(jobId, { costUsd: r.costUsd });
      } catch (err) {
        await jobLog(jobId, `Échec illustration ${p.kind} ${p.stepIndex ?? ""} : ${err instanceof Error ? err.message : err}`, "error");
      }
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
    for (let v = 0; v < n; v++) {
      if (!(await gate(jobId))) return;
      try {
        const ill = await generateIllustration({ bookId, kind: "COVER", jobId, coverVariant: v });
        await setJob(jobId, { progress: 40 + Math.round(((v + 1) / n) * 55), costUsd: ill.costUsd });
      } catch (err) {
        await jobLog(jobId, `Échec couverture variante ${v + 1} : ${err instanceof Error ? err.message : err}`, "error");
      }
    }
    await setJob(jobId, { status: "COMPLETED", progress: 100, step: "Couverture générée" });
  },

  [QUEUES.bookLayout]: async ({ jobId, bookId, force }) => {
    await setJob(jobId, { status: "RUNNING", step: "Assemblage des pages", progress: 30 });
    const pages = await rebuildBookPages(bookId!, { force: Boolean(force) });
    await setJob(jobId, { status: "COMPLETED", progress: 100, step: `${pages.length} pages assemblées`, result: { pages: pages.length } });
  },

  [QUEUES.bookExport]: async ({ jobId, exportId }) => {
    await setJob(jobId, { status: "RUNNING", step: "Rendu PDF", progress: 20 });
    const r = await runExport(exportId as string);
    await setJob(jobId, { status: "COMPLETED", progress: 100, step: `PDF de ${r.pageCount} pages`, result: r.checks as never });
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

    // 1. Fiches
    for (let i = 0; i < links.length; i++) {
      if (!(await gate(jobId))) return finish(jobId, bookId!, "CANCELLED");
      const a = links[i].activity;
      if (a.currentVersionId && a.status !== "CONCEPT") continue; // déjà rédigée : on conserve
      await setJob(jobId, { step: `Rédaction ${i + 1}/${total} : ${a.title}`, progress: 2 + Math.round((i / total) * 30) });
      const child = await prisma.job.create({ data: { type: QUEUES.activityGenerate, status: "RUNNING", bookId, activityId: a.id, parentId: jobId, startedAt: new Date() } });
      try {
        const r = await generateActivityContent(a.id, { jobId: child.id, bookId });
        const v = await generateVisualReference(a.id, { jobId: child.id, bookId });
        await setJob(child.id, { status: "COMPLETED", progress: 100, step: "Fiche rédigée", costUsd: r.usage.costUsd + v.usage.costUsd });
        await setJob(jobId, { costUsd: r.usage.costUsd + v.usage.costUsd });
      } catch (err) {
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
        const m = err instanceof Error ? err.message : String(err);
        errors.push(`Couverture : ${m}`);
        await setJob(child.id, { status: "FAILED", error: m });
      }
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
