/**
 * Pilote automatique — exécution dans le worker.
 *
 * Un run = une tâche « autopilot.run ». Chaque passage exécute l'étape courante :
 * - les étapes courtes (plan, rédaction, contrôles, planche, mise en page, publication, publicités)
 *   s'exécutent directement ;
 * - les étapes longues réutilisent les tâches existantes (pipeline d'illustrations, export PDF,
 *   vidéos) : le run les lance puis vérifie leur avancement toutes les 15 s (relance différée pg-boss).
 * En mode copier-coller, une étape qui attend des réponses met le run « en attente » ; il reprend
 * automatiquement dès que les réponses sont collées.
 */
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db";
import { getBoss, QUEUES } from "../queue/boss";
import { enqueue, jobLog, setJob } from "../queue/jobs";
import { getAiSettings, getShopSettings, getVideoSettings } from "../settings";
import { AutopilotSettingsSchema, type AutopilotSettings, type AutopilotStageKey } from "../schemas/settings";
import { isManualInputRequired } from "../ai/manual-core";
import { markWaitingInput } from "../manual/requests";
import { getTextProvider, effectiveTextModel, manualImages } from "../ai/registry";
import { sketchSummary } from "../generation/rework";
import { checkBookImages, summarizeImageIssues } from "../quality/images";
import { generateStructured, contextBlock } from "../ai/structured";
import { createKitFromPlan, resolveBrief } from "../kits/create";
import { KitCustomizationSchema, type KitContentFormat } from "../kits/schemas";
import { mainCount } from "../kits/content";
import { isAdultAge, isStructuredKit, kitType } from "../kits/types";
import { activeSites } from "../universes";
import { siteBySlug } from "../universes/sites";
import { MARKETING_SLOTS, generateKitContent, generateKitIllustration, isCharacterSheetSlot, kitIllustrationPlan, readKitContent } from "../kits/generate";
import { rebuildBookPages } from "../layout/book";
import { createExport } from "../export";
import { publishBookToShop } from "../shop/publish";
import { adFormDefaults, animationPromptFor, createAdVideos, sendAdVideoToShop } from "../video/service";
import { checkKitContent, summarizeQuality } from "./quality";
import { estimateRun } from "./estimate";
import { applyOutcome, beforeStage, currentStage, markStarted, parseStages, type Stage, type StageOutcome, type RunStatus } from "./stages";
import { buildMarketingBody, callMarketingAutopilot } from "./marketing";
import { callEtsyPublish, etsyStageOutcome } from "./etsy";

/** Conversion approximative pour le coût de création envoyé à la boutique (en centimes d'euro). */
export const EUR_PER_USD = 0.92;

export interface RunState {
  illustrationsJobId?: string;
  /** Mode esquisse : validation des esquisses demandée, puis tâche des versions finales */
  sketchApprovalRequested?: boolean;
  finalizeJobId?: string;
  pdfExportIds?: string[];
  pdfJobIds?: string[];
  pdfAutofixAttempts?: number;
  pdfAutofixNotes?: string[];
  videoIds?: string[];
  videoNotes?: string[];
  productId?: string;
  publicUrl?: string | null;
  editUrl?: string;
  publishStatus?: string;
  etsy?: { listingId: string | null; url: string | null; state: string };
  adsCopy?: Record<string, unknown> | null;
  campaign?: { campaignId: string; campaignSlug: string; landingUrl: string; adminUrl: string; posts: number; generatedBy: string };
  contentSource?: string;
  /** Univers de la boutique choisi au lancement (sinon proposé par le plan) */
  siteSlug?: string | null;
}

type RunRow = NonNullable<Awaited<ReturnType<typeof loadRun>>>;

async function loadRun(runId: string) {
  return prisma.autopilotRun.findUnique({ where: { id: runId } });
}

function stateOf(run: { state: unknown }): RunState {
  return (run.state ?? {}) as RunState;
}

function configOf(run: { config: unknown }): AutopilotSettings {
  return AutopilotSettingsSchema.parse(run.config ?? {});
}

/** Coût réel cumulé du run : générations (texte, images) du livre et du run + clips vidéo. */
export async function runCost(run: { bookId: string | null; jobId: string | null; state: unknown }): Promise<number> {
  const or: Prisma.GenerationLogWhereInput[] = [];
  if (run.bookId) or.push({ bookId: run.bookId });
  if (run.jobId) or.push({ jobId: run.jobId });
  const gen = or.length ? await prisma.generationLog.aggregate({ where: { OR: or }, _sum: { costUsd: true } }) : null;
  const ids = stateOf(run).videoIds ?? [];
  const vid = ids.length ? await prisma.adVideo.aggregate({ where: { id: { in: ids } }, _sum: { costUsd: true } }) : null;
  return Math.round((Number(gen?._sum.costUsd ?? 0) + Number(vid?._sum.costUsd ?? 0)) * 10000) / 10000;
}

/** Remet le traitement du run dans la file (immédiatement ou après un délai). */
export async function scheduleRun(runId: string, jobId: string, delaySeconds = 0) {
  const boss = await getBoss();
  const queueJobId = await boss.send(QUEUES.autopilotRun, { runId, jobId }, { startAfter: Math.max(0, Math.round(delaySeconds)), retryLimit: 1, retryDelay: 30, expireInSeconds: 3600 * 2 });
  await prisma.job.update({ where: { id: jobId }, data: { status: "RUNNING", queueJobId: queueJobId ?? undefined } }).catch(() => undefined);
}

/** Crée un run et lance son traitement. */
export async function startRun(input: { brief: string; config: AutopilotSettings; title?: string | null; stages: Stage[]; siteSlug?: string | null }) {
  const run = await prisma.autopilotRun.create({
    data: { brief: input.brief, title: input.title ?? null, config: input.config as unknown as Prisma.InputJsonValue, stages: input.stages as unknown as Prisma.InputJsonValue, maxCostUsd: input.config.maxCostUsd, status: "RUNNING", ...(input.siteSlug ? { state: { siteSlug: input.siteSlug } as Prisma.InputJsonValue } : {}) },
  });
  const job = await enqueue(QUEUES.autopilotRun, { runId: run.id });
  await prisma.autopilotRun.update({ where: { id: run.id }, data: { jobId: job.id } });
  return run.id;
}

/**
 * Traitement d'un run (handler de la file « autopilot.run »).
 * Enchaîne les étapes tant qu'elles se terminent immédiatement, puis se replanifie si nécessaire.
 */
export async function processAutopilotRun(runId: string, jobId: string) {
  let run = await loadRun(runId);
  if (!run) return;
  if (["COMPLETED", "FAILED", "CANCELLED", "WAITING_APPROVAL"].includes(run.status)) return;
  if (run.status === "WAITING_INPUT") run = await prisma.autopilotRun.update({ where: { id: runId }, data: { status: "RUNNING" } });
  await setJob(jobId, { status: "RUNNING", step: "Pilote automatique" });
  const cfg = configOf(run);

  for (let guard = 0; guard < 20; guard++) {
    run = (await loadRun(runId))!;
    if (run.status === "CANCELLED") return;
    const stages = parseStages(run.stages);
    const stage = currentStage(stages);
    if (!stage) {
      await finalize(run, "COMPLETED", null, stages);
      return;
    }
    const cost = await runCost(run);
    const decision = beforeStage(stage, cfg, cost, await estimateStage(run, stage.key, cfg));
    if (decision.type === "approval") {
      await saveTransition(run, applyOutcome({ status: run.status as RunStatus, stages }, stage.key, { type: "approval", reason: decision.reason }, cost), cost, jobId);
      return;
    }
    const started = markStarted(stages, stage.key, cost);
    await prisma.autopilotRun.update({ where: { id: runId }, data: { stages: started as unknown as Prisma.InputJsonValue, costUsd: cost } });
    await setJob(jobId, { step: `${stage.label}…` });

    let outcome: StageOutcome;
    try {
      outcome = await runStage(stage.key, (await loadRun(runId))!, cfg, jobId);
    } catch (err) {
      if (isManualInputRequired(err)) {
        await markWaitingInput(jobId, 1);
        outcome = { type: "waiting_input", detail: `Réponse à coller : ${err.title} (page « À coller »)`, poll: false };
      } else {
        const message = err instanceof Error ? err.message : String(err);
        await jobLog(jobId, `${stage.label} : ${message}`, "error");
        outcome = { type: "failed", error: message };
      }
    }
    run = (await loadRun(runId))!;
    if (run.status === "CANCELLED") return;
    const newCost = await runCost(run);
    const t = applyOutcome({ status: run.status as RunStatus, stages: parseStages(run.stages) }, stage.key, outcome, newCost);
    await saveTransition(run, t, newCost, jobId);
    if (t.requeueSeconds === 0) continue; // étape suivante dans le même passage
    if (t.requeueSeconds != null) await scheduleRun(runId, jobId, t.requeueSeconds);
    return;
  }
  // Garde-fou : on rend la main et on reprend au prochain passage
  await scheduleRun(runId, jobId, 1);
}

async function saveTransition(run: RunRow, t: ReturnType<typeof applyOutcome>, cost: number, jobId: string) {
  await prisma.autopilotRun.update({ where: { id: run.id }, data: { status: t.status, stages: t.stages as unknown as Prisma.InputJsonValue, error: t.error, costUsd: cost } });
  const cur = currentStage(t.stages);
  if (t.status === "COMPLETED") return finalize({ ...run, status: "COMPLETED" }, "COMPLETED", null, t.stages);
  if (t.status === "FAILED") {
    await setJob(jobId, { status: "FAILED", step: "Pilote automatique interrompu", error: t.error });
    return;
  }
  if (t.status === "WAITING_APPROVAL") await setJob(jobId, { status: "PAUSED", step: `En attente de validation : ${cur?.label ?? ""}` });
  else if (t.status === "WAITING_INPUT" && t.requeueSeconds == null) {
    /* déjà marqué « en attente de réponses » par markWaitingInput */
  } else await setJob(jobId, { status: "RUNNING", step: cur ? `${cur.label} — ${cur.detail ?? "en cours"}` : "Pilote automatique" });
}

async function finalize(run: RunRow | (RunRow & { status: string }), status: "COMPLETED", error: string | null, stages: Stage[]) {
  await prisma.autopilotRun.update({ where: { id: run.id }, data: { status, error, stages: stages as unknown as Prisma.InputJsonValue } });
  if (run.jobId) await setJob(run.jobId, { status: "COMPLETED", progress: 100, step: "Pilote automatique terminé" });
}

async function patchState(runId: string, patch: Partial<RunState>) {
  const run = await prisma.autopilotRun.findUniqueOrThrow({ where: { id: runId }, select: { state: true } });
  await prisma.autopilotRun.update({ where: { id: runId }, data: { state: { ...stateOf(run), ...patch } as unknown as Prisma.InputJsonValue } });
}

/** Coût estimé de l'étape à venir (plafond de coût). */
async function estimateStage(run: RunRow, key: AutopilotStageKey, cfg: AutopilotSettings): Promise<number> {
  const ai = await getAiSettings();
  const video = await getVideoSettings();
  let format: KitContentFormat = "treasure_hunt";
  let count = 10;
  let contentProvided = false;
  if (run.bookId) {
    const book = await prisma.book.findUnique({ where: { id: run.bookId }, select: { kitType: true, targetCount: true, kitContent: true } });
    if (book) {
      const def = kitType(book.kitType);
      format = def.format ?? "treasure_hunt";
      count = book.targetCount || def.defaultCount;
      contentProvided = Boolean(book.kitContent);
    }
  }
  const est = estimateRun({ format, count, contentProvided, ai, autopilot: cfg, runwayUsdPerSecond: video.usdPerSecond });
  // L'étape vidéo bascule sur le montage seul si le clip dépasse le plafond : pas de blocage.
  // Etsy : frais facturés par Etsy, hors budget IA du run.
  if (key === "video" || key === "etsy") return 0;
  return est.stages[key] ?? 0;
}

// ---------------------------------------------------------------------------
// Étapes
// ---------------------------------------------------------------------------

async function runStage(key: AutopilotStageKey, run: RunRow, cfg: AutopilotSettings, jobId: string): Promise<StageOutcome> {
  switch (key) {
    case "plan": return stagePlan(run, jobId);
    case "content": return stageContent(run, jobId);
    case "quality": return stageQuality(run);
    case "character": return stageCharacter(run, jobId);
    case "illustrations": return stageIllustrations(run, cfg);
    case "layout": return stageLayout(run);
    case "pdf": return stagePdf(run, cfg);
    case "publish": return stagePublish(run, cfg);
    case "etsy": return stageEtsy(run, cfg);
    case "video": return stageVideo(run, cfg);
    case "ads": return stageAds(run, cfg, jobId);
  }
}

function requireBook(run: RunRow): string {
  if (!run.bookId) throw new Error("Kit introuvable : l'étape « Plan » doit d'abord créer le kit.");
  return run.bookId;
}

async function stagePlan(run: RunRow, jobId: string): Promise<StageOutcome> {
  if (run.bookId) {
    const book = await prisma.book.findUnique({ where: { id: run.bookId }, select: { title: true } });
    if (book) return { type: "done", detail: `Kit « ${book.title} » déjà créé` };
  }
  const resolved = await resolveBrief(run.brief ?? "", { jobId, siteSlug: stateOf(run).siteSlug ?? null });
  const def = kitType(resolved.plan.kitType);
  if (!isStructuredKit(def.key)) {
    return { type: "failed", error: `Le pilote automatique produit les contenus structurés (kits enfants, guides pratiques, recettes, fiches d'expériences). Type détecté : « ${def.label} ». Utilisez « Créer depuis un brief » pour ce type.` };
  }
  await patchState(run.id, { siteSlug: resolved.plan.siteSlug ?? null });
  const { bookId, contentImported } = await createKitFromPlan({ plan: resolved.plan, brief: run.brief ?? undefined, contentJson: resolved.contentJson });
  await prisma.autopilotRun.update({ where: { id: run.id }, data: { bookId, title: resolved.plan.title } });
  await patchState(run.id, { contentSource: resolved.source });
  const source = resolved.source === "contenu" ? "contenu complet importé tel quel" : resolved.source === "json" ? "plan JSON importé" : "plan proposé par l'IA";
  const site = siteBySlug(await activeSites(), resolved.plan.siteSlug);
  const audience = isAdultAge(resolved.plan.ageRange) ? "adultes" : `${resolved.plan.ageRange.replace("-", " à ")} ans`;
  return { type: "done", detail: `${def.label} « ${resolved.plan.title} » · ${resolved.plan.count} ${def.countLabel} · ${audience}${site ? ` · univers ${site.name}` : ""} (${source}${contentImported ? "" : ""})` };
}

async function stageContent(run: RunRow, jobId: string): Promise<StageOutcome> {
  const bookId = requireBook(run);
  const book = await prisma.book.findUniqueOrThrow({ where: { id: bookId } });
  const existing = readKitContent(book);
  const def = kitType(book.kitType);
  if (existing) return { type: "done", detail: `Contenu déjà présent : ${mainCount(existing)} ${def.countLabel}` };
  const r = await generateKitContent(bookId, { jobId });
  const n = mainCount(r.content);
  return { type: "done", detail: `Contenu rédigé : ${n} ${def.countLabel}` };
}

async function stageQuality(run: RunRow): Promise<StageOutcome> {
  const bookId = requireBook(run);
  const book = await prisma.book.findUniqueOrThrow({ where: { id: bookId } });
  const content = readKitContent(book);
  if (!content) return { type: "failed", error: "Contenu du kit absent ou invalide." };
  const def = kitType(book.kitType);
  const c = KitCustomizationSchema.safeParse(book.customization ?? {}).data;
  const report = checkKitContent(content, { expectedCount: c?.count ?? book.targetCount ?? def.defaultCount, companion: c?.companion });
  if (report.fixes.length) {
    const n = mainCount(report.content);
    await prisma.book.update({ where: { id: bookId }, data: { kitContent: report.content as unknown as Prisma.InputJsonValue, targetCount: n } });
  }
  if (!report.ok) return { type: "failed", error: report.issues.filter((i) => i.level === "error").map((i) => i.message).join(" ") + " Corrigez le contenu (onglet Kit → importer un JSON corrigé) puis « Relancer l'étape »." };
  return { type: "done", detail: summarizeQuality(report) };
}

async function stageCharacter(run: RunRow, jobId: string): Promise<StageOutcome> {
  const bookId = requireBook(run);
  const book = await prisma.book.findUniqueOrThrow({ where: { id: bookId } });
  const content = readKitContent(book);
  if (!content) return { type: "failed", error: "Contenu du kit absent." };
  const sheet = kitIllustrationPlan(content).find((p) => isCharacterSheetSlot(p.slot));
  if (!sheet) return { type: "skipped", detail: "Pas de planche de personnages pour ce kit" };
  const existing = await prisma.illustration.findFirst({ where: { bookId, kind: "KIT", slot: sheet.slot, isCurrent: true, status: { in: ["GENERATED", "ACCEPTED"] } } });
  if (existing) return { type: "done", detail: "Planche de personnages déjà prête : elle sert de référence aux illustrations" };
  const r = await generateKitIllustration({ bookId, slot: sheet.slot, prompt: sheet.prompt, label: sheet.label, jobId });
  return { type: "done", detail: `Planche générée${r.isDemo ? " (démo)" : ""} : référence de toutes les illustrations suivantes` };
}

async function stageIllustrations(run: RunRow, cfg: AutopilotSettings): Promise<StageOutcome> {
  const bookId = requireBook(run);
  const state = stateOf(run);
  // Mode esquisse (sauf copier-coller : les images faites dans ChatGPT ne coûtent rien à l'unité)
  const sketchFirst = cfg.sketchFirst !== false && !manualImages(await getAiSettings());
  if (!state.illustrationsJobId) {
    const job = await enqueue(QUEUES.bookPipeline, { bookId, withIllustrations: true, withCover: true, sketch: sketchFirst });
    await patchState(run.id, { illustrationsJobId: job.id });
    return { type: "poll", detail: sketchFirst ? "Esquisses lancées (qualité basse)" : "Illustrations lancées" };
  }
  if (state.finalizeJobId) return pollFinalize(state.finalizeJobId);
  const job = await prisma.job.findUnique({ where: { id: state.illustrationsJobId } });
  if (!job) return { type: "failed", error: "Tâche d'illustrations introuvable : relancez l'étape." };
  if (job.status === "FAILED" || job.status === "CANCELLED") return { type: "failed", error: job.error ?? `Tâche ${job.status === "FAILED" ? "échouée" : "annulée"}` };
  if (job.status === "WAITING_INPUT") return { type: "waiting_input", detail: `${job.step ?? "Images à coller"} (page « À coller »)`, poll: true };
  if (job.status !== "COMPLETED") return { type: "poll", detail: `${sketchFirst ? "Esquisses — " : ""}${job.step ?? "Illustrations en cours"}` };
  // Vérification : chaque emplacement a son image, et la couverture existe
  const book = await prisma.book.findUniqueOrThrow({ where: { id: bookId } });
  const content = readKitContent(book);
  const plan = content ? kitIllustrationPlan(content) : [];
  const done = await prisma.illustration.findMany({ where: { bookId, kind: "KIT", isCurrent: true, status: { in: ["GENERATED", "ACCEPTED"] } }, select: { slot: true, isDemo: true } });
  const have = new Set(done.map((d) => d.slot));
  const missing = plan.filter((p) => !have.has(p.slot));
  const cover = await prisma.illustration.count({ where: { bookId, kind: "COVER", isCurrent: true, status: { in: ["GENERATED", "ACCEPTED"] } } });
  if (missing.length || !cover) {
    const list = [...missing.map((m) => m.label), ...(cover ? [] : ["Couverture"])];
    return { type: "failed", error: `${list.length} illustration(s) manquante(s) : ${list.slice(0, 8).join(", ")}${list.length > 8 ? "…" : ""}. ${job.error ?? ""} Relancez l'étape (les images déjà faites sont conservées).`.trim() };
  }
  const demo = done.filter((d) => d.isDemo).length;
  const summary = `${done.length} illustrations + couverture${demo ? ` (dont ${demo} de démonstration)` : ""}`;
  const sketches = sketchFirst ? await sketchSummary(bookId) : null;
  if (!sketches?.count) return { type: "done", detail: summary };

  // Esquisses prêtes : pages assemblées pour l'aperçu, puis validation (désactivable) avant les versions finales
  if (cfg.sketchApproval !== false && !state.sketchApprovalRequested) {
    await rebuildBookPages(bookId);
    await patchState(run.id, { sketchApprovalRequested: true });
    return {
      type: "approval",
      reason: `Esquisses prêtes : ${sketches.count} image(s) pour ${usdFr(sketches.sketchCostUsd)}. Vérifiez l'aperçu du livre (recadrez, remplacez ou corrigez une image si besoin), puis « Valider et continuer » pour générer la version finale des esquisses validées (estimation ${usdFr(sketches.finalCostUsd)}).`,
    };
  }
  // Une finalisation lancée depuis l'aperçu est reprise telle quelle (jamais payée deux fois)
  const active = await prisma.job.findFirst({ where: { bookId, type: QUEUES.bookFinalize, status: { in: ["QUEUED", "RUNNING", "PAUSED", "WAITING_INPUT"] } }, orderBy: { createdAt: "desc" } });
  const fin = active ?? (await enqueue(QUEUES.bookFinalize, { bookId }));
  await patchState(run.id, { finalizeJobId: fin.id });
  return { type: "poll", detail: `Versions finales lancées : ${sketches.count} image(s), estimation ${usdFr(sketches.finalCostUsd)}` };
}

async function pollFinalize(jobId: string): Promise<StageOutcome> {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) return { type: "failed", error: "Tâche des versions finales introuvable : relancez l'étape." };
  if (job.status === "FAILED" || job.status === "CANCELLED") return { type: "failed", error: job.error ?? "Versions finales interrompues" };
  if (job.status === "WAITING_INPUT") return { type: "waiting_input", detail: `${job.step ?? "Images à coller"} (page « À coller »)`, poll: true };
  if (job.status !== "COMPLETED") return { type: "poll", detail: `Versions finales — ${job.step ?? "en cours"}` };
  return { type: "done", detail: `Esquisses validées puis ${job.step ?? "versions finales générées"}` };
}

function usdFr(n: number) {
  return `${n.toFixed(2).replace(".", ",")} $`;
}

async function stageLayout(run: RunRow): Promise<StageOutcome> {
  const bookId = requireBook(run);
  const pages = await rebuildBookPages(bookId);
  // Contrôle des images (résolution, format, image vide) : alerte, échec seulement si bloquant
  const qc = await checkBookImages(bookId);
  if (qc.blocking > 0) {
    const first = qc.issues.filter((i) => i.severity === "blocking").slice(0, 3).map((i) => `page ${i.pageIndex + 1} : ${i.message}`);
    return { type: "failed", error: `${summarizeImageIssues(qc)} — ${first.join(" ; ")}. Corrigez depuis l'aperçu (/books/${bookId}/apercu : recadrer, remplacer ou regénérer l'image), puis « Relancer l'étape ».` };
  }
  return { type: "done", detail: `${pages.length} pages assemblées · ${summarizeImageIssues(qc)}` };
}

async function stagePdf(run: RunRow, cfg: AutopilotSettings): Promise<StageOutcome> {
  const bookId = requireBook(run);
  const state = stateOf(run);
  if (!state.pdfExportIds?.length) {
    // (relance après correction automatique : pdfExportIds remis à zéro)
    const kinds = cfg.printPdf ? (["BOOK_DIGITAL", "BOOK_PRINT"] as const) : (["BOOK_DIGITAL"] as const);
    const exportIds: string[] = [];
    const jobIds: string[] = [];
    for (const kind of kinds) {
      const exp = await createExport({ kind, bookId, label: "Pilote automatique" });
      const job = await enqueue(QUEUES.bookExport, { bookId, exportId: exp.id, skipAutoPublish: true });
      exportIds.push(exp.id);
      jobIds.push(job.id);
    }
    await patchState(run.id, { pdfExportIds: exportIds, pdfJobIds: jobIds });
    return { type: "poll", detail: "Rendu PDF lancé" };
  }
  const exports = await prisma.export.findMany({ where: { id: { in: state.pdfExportIds } } });
  const failed = exports.find((e) => e.status === "FAILED");
  if (failed) return { type: "failed", error: failed.error ?? "Échec du rendu PDF" };
  if (exports.some((e) => e.status !== "COMPLETED")) return { type: "poll", detail: "Rendu PDF en cours" };
  const problems: string[] = [];
  const overflowing: Array<{ pageIndex: number; blockId: string }> = [];
  for (const e of exports) {
    const checks = (e.checks ?? {}) as { overflows?: Array<{ pageIndex: number; blockId: string }>; missingImages?: number };
    const overflows = checks.overflows ?? [];
    const missing = checks.missingImages ?? 0;
    if (overflows.length) problems.push(`${overflows.length} débordement(s) de texte`);
    if (missing) problems.push(`${missing} image(s) manquante(s)`);
    overflowing.push(...overflows);
  }
  const missingImages = exports.some((e) => ((e.checks ?? {}) as { missingImages?: number }).missingImages);
  // Correction automatique des débordements (police réduite sur les blocs concernés), 2 tentatives
  const attempts = state.pdfAutofixAttempts ?? 0;
  if (overflowing.length && !missingImages && attempts < 2) {
    const fixed = await shrinkOverflowingBlocks(bookId, overflowing);
    if (fixed > 0) {
      await patchState(run.id, { pdfExportIds: [], pdfJobIds: [], pdfAutofixAttempts: attempts + 1, pdfAutofixNotes: [...(state.pdfAutofixNotes ?? []), `${fixed} bloc(s) de texte réduit(s)`] });
      return { type: "poll", detail: `Correction automatique de ${fixed} débordement(s), nouvel export…`, delaySeconds: 1 };
    }
  }
  if (problems.length) return { type: "failed", error: `Le PDF contient ${[...new Set(problems)].join(" et ")}${attempts ? ` malgré ${attempts} correction(s) automatique(s)` : ""}. Corrigez dans l'éditeur de pages, puis « Relancer l'étape ».` };
  const digital = exports.find((e) => e.kind === "BOOK_DIGITAL") ?? exports[0];
  const notes = state.pdfAutofixNotes?.length ? ` (corrigé automatiquement : ${state.pdfAutofixNotes.join(", ")})` : "";
  return { type: "done", detail: `PDF de ${digital?.pageCount ?? "?"} pages, sans débordement ni image manquante${exports.length > 1 ? " (+ version imprimable)" : ""}${notes}` };
}

/** Réduit la taille de police des blocs de texte qui débordent (−20 %, minimum 8 pt). */
async function shrinkOverflowingBlocks(bookId: string, overflows: Array<{ pageIndex: number; blockId: string }>): Promise<number> {
  const pages = await prisma.bookPage.findMany({ where: { bookId }, orderBy: { position: "asc" } });
  let fixed = 0;
  const byPage = new Map<number, Set<string>>();
  for (const o of overflows) byPage.set(o.pageIndex, (byPage.get(o.pageIndex) ?? new Set()).add(o.blockId));
  for (const [index, ids] of byPage) {
    const page = pages[index];
    if (!page) continue;
    const layout = page.layout as { blocks?: Array<{ id: string; type: string; style?: { fontSizePt?: number } }> };
    let changed = false;
    for (const b of layout.blocks ?? []) {
      if (!ids.has(b.id) || b.type !== "text") continue;
      const current = b.style?.fontSizePt ?? 11;
      const next = Math.max(8, Math.round(current * 0.8 * 10) / 10);
      if (next >= current) continue;
      b.style = { ...(b.style ?? {}), fontSizePt: next };
      changed = true;
      fixed++;
    }
    if (changed) await prisma.bookPage.update({ where: { id: page.id }, data: { layout: layout as unknown as Prisma.InputJsonValue } });
  }
  return fixed;
}

async function stagePublish(run: RunRow, cfg: AutopilotSettings): Promise<StageOutcome> {
  const bookId = requireBook(run);
  const shop = await getShopSettings();
  if (!shop.shopApiUrl || !shop.shopApiKey) return { type: "failed", error: "Boutique non configurée : renseignez l'URL et la clé API dans Paramètres → Boutique, puis « Reprendre »." };
  const state = stateOf(run);
  const cost = await runCost(run);
  const r = await publishBookToShop(bookId, { exportId: state.pdfExportIds?.[0], publish: cfg.publishDirect, creationCostCents: Math.round(cost * EUR_PER_USD * 100) });
  await patchState(run.id, { productId: r.product.id, publicUrl: r.product.publicUrl, editUrl: r.product.editUrl, publishStatus: r.status });
  const label = r.status === "published" ? `Publié : ${r.product.publicUrl ?? r.product.slug}` : r.status === "draft_pending_review" ? "Brouillon en attente de validation dans la boutique" : "Fiche mise à jour";
  return { type: "done", detail: `${label}${r.warnings.length ? ` — ${r.warnings.join(" ")}` : ""}` };
}

async function stageEtsy(run: RunRow, cfg: AutopilotSettings): Promise<StageOutcome> {
  const bookId = requireBook(run);
  const book = await prisma.book.findUniqueOrThrow({ where: { id: bookId }, select: { shopProductId: true } });
  const productId = book.shopProductId ?? stateOf(run).productId;
  if (!productId) return { type: "failed", error: "Le kit n'est pas encore dans la boutique : l'étape « Boutique » doit réussir avant Etsy." };
  const shop = await getShopSettings();
  const outcome = await callEtsyPublish({ baseUrl: shop.shopApiUrl, apiKey: shop.shopApiKey }, productId, { state: cfg.etsyState });
  if (outcome.kind === "ok") await patchState(run.id, { etsy: { listingId: outcome.data.listingId, url: outcome.data.url, state: outcome.data.state } });
  return etsyStageOutcome(outcome);
}

async function stageVideo(run: RunRow, cfg: AutopilotSettings): Promise<StageOutcome> {
  const bookId = requireBook(run);
  const state = stateOf(run);
  if (!state.videoIds?.length) {
    const defaults = await adFormDefaults(bookId);
    const video = await getVideoSettings();
    const notes: string[] = [];
    let clipProvider = cfg.clipProvider;
    if (clipProvider === "mock" && process.env.NODE_ENV === "production") clipProvider = "none";
    if (clipProvider === "runway" && !video.runwayApiKey) { clipProvider = "none"; notes.push("clé Runway absente : montage seul"); }
    if (clipProvider === "runway") {
      const clipCost = cfg.videoFormats.length * cfg.clipDurationSeconds * video.usdPerSecond;
      const spent = await runCost(run);
      if (cfg.maxCostUsd > 0 && spent + clipCost > cfg.maxCostUsd) { clipProvider = "none"; notes.push(`clip Runway (${clipCost.toFixed(2)} $) au-delà du plafond : montage seul`); }
    }
    // Image d'accroche : visuel « héros » du kit, sinon couverture
    const hero = await prisma.illustration.findFirst({ where: { bookId, kind: "KIT", slot: MARKETING_SLOTS.hero, isCurrent: true, assetId: { not: null } }, select: { assetId: true, prompt: true } });
    const source = hero?.assetId ? { assetId: hero.assetId, prompt: hero.prompt } : defaults.choices[0] ? { assetId: defaults.choices[0].assetId, prompt: defaults.choices[0].prompt } : null;
    if (clipProvider !== "none" && !source) { clipProvider = "none"; notes.push("aucune illustration à animer : montage seul"); }
    const ids = await createAdVideos(bookId, {
      formats: cfg.videoFormats,
      durationSeconds: cfg.videoDurationSeconds,
      hook: defaults.form.hook,
      bullets: defaults.form.bullets,
      cta: defaults.form.cta,
      clipProvider,
      clipSourceAssetId: clipProvider === "none" ? null : source?.assetId ?? null,
      clipPrompt: clipProvider === "none" ? null : animationPromptFor(source?.prompt, defaults.universe, cfg.clipDurationSeconds),
      clipDurationSeconds: cfg.clipDurationSeconds,
      musicAssetId: defaults.defaultMusicAssetId,
    });
    await patchState(run.id, { videoIds: ids, videoNotes: notes });
    return { type: "poll", detail: `${ids.length} vidéo(s) lancée(s)${notes.length ? ` (${notes.join(" ; ")})` : ""}` };
  }
  const videos = await prisma.adVideo.findMany({ where: { id: { in: state.videoIds } }, include: { book: { select: { shopProductId: true } } } });
  if (videos.length === 0) return { type: "failed", error: "Vidéos introuvables (supprimées ?) : relancez l'étape." };
  const failed = videos.find((v) => v.status === "FAILED");
  if (failed) return { type: "failed", error: `Vidéo ${failed.format} : ${failed.error ?? "échec"}` };
  if (videos.some((v) => v.status === "WAITING_CLIP" && v.clipProvider === "manual")) return { type: "waiting_input", detail: "Clip d'accroche à téléverser (page « À coller »)", poll: true };
  if (videos.some((v) => v.status !== "READY")) return { type: "poll", detail: videos.map((v) => `${v.format} : ${v.step ?? v.status}`).join(" · ") };
  // Envoi à la boutique si le montage ne l'a pas fait (livre publié entre-temps)
  const notes = [...(state.videoNotes ?? [])];
  for (const v of videos) {
    if (!v.shopVideoUrl && v.book.shopProductId) {
      try { await sendAdVideoToShop(v.id); } catch (e) { notes.push(`envoi ${v.format} à la boutique impossible : ${e instanceof Error ? e.message : e}`); }
    }
  }
  const sent = await prisma.adVideo.count({ where: { id: { in: state.videoIds }, shopVideoUrl: { not: null } } });
  return { type: "done", detail: `${videos.length} vidéo(s) prête(s) (${videos.map((v) => v.format).join(", ")})${sent ? `, ${sent} envoyée(s) à la boutique` : ""}${notes.length ? ` — ${notes.join(" ; ")}` : ""}` };
}

const AdsCopySchema = z.record(z.string(), z.unknown());

async function stageAds(run: RunRow, cfg: AutopilotSettings, jobId: string): Promise<StageOutcome> {
  const bookId = requireBook(run);
  const book = await prisma.book.findUniqueOrThrow({ where: { id: bookId }, select: { title: true, shopProductId: true, siteSlug: true, kitType: true } });
  if (!book.shopProductId) return { type: "failed", error: "Le kit n'est pas encore dans la boutique : l'étape « Boutique » doit réussir avant les publicités." };
  const adsSite = siteBySlug(await activeSites(), book.siteSlug);
  const adsBrand = adsSite?.name ?? "La Malle à Jeux";
  const adsWhat = isAdultAge(kitType(book.kitType).defaultAge) ? `${kitType(book.kitType).label.toLowerCase()} au format PDF` : "kits d'activités à imprimer pour enfants";
  const shop = await getShopSettings();
  const state = stateOf(run);
  const videos = state.videoIds?.length ? await prisma.adVideo.findMany({ where: { id: { in: state.videoIds }, status: "READY", shopVideoUrl: { not: null } }, select: { shopVideoUrl: true } }) : [];
  const body = (copy: Record<string, unknown> | null) =>
    buildMarketingBody({ title: book.title, channels: cfg.channels, variantsPerChannel: cfg.variantsPerChannel, videoUrls: videos.map((v) => v.shopVideoUrl!).filter(Boolean), copy, dailyBudgetCents: cfg.dailyBudgetCents, postsMode: cfg.postsMode, startOffsetHours: cfg.postsStartOffsetHours, spacingHours: cfg.postsSpacingHours });
  const cfgShop = { baseUrl: shop.shopApiUrl, apiKey: shop.shopApiKey };

  let outcome = await callMarketingAutopilot(cfgShop, book.shopProductId, body(state.adsCopy ?? null));
  if (outcome.kind === "needs_copy") {
    // La boutique n'a pas de clé Claude : le studio rédige les textes (IA du studio, ou demande « à coller »)
    const ai = await getAiSettings();
    const provider = getTextProvider(ai, { bookId, jobId });
    const res = await generateStructured({
      provider,
      model: effectiveTextModel(ai),
      schema: AdsCopySchema,
      system: `Tu es rédacteur publicitaire pour ${adsBrand} (${adsWhat}). Tu écris en français, sans jamais inventer d'avis, de chiffres de vente, de résultats ni de garanties absents des données fournies.`,
      prompt: `${outcome.prompt}\n\n${contextBlock("ads_copy", { title: book.title })}`,
      purpose: "ads_copy",
      bookId,
      jobId,
      maxTokens: 8000,
    });
    await patchState(run.id, { adsCopy: res.data });
    outcome = await callMarketingAutopilot(cfgShop, book.shopProductId, body(res.data));
  }
  if (outcome.kind === "needs_copy") return { type: "failed", error: "La boutique a refusé les textes publicitaires fournis." };
  if (outcome.kind === "missing_endpoint") return { type: "failed", error: outcome.error };
  if (outcome.kind === "invalid") {
    await patchState(run.id, { adsCopy: null });
    return { type: "failed", error: `Textes publicitaires refusés par la boutique : ${outcome.error}${outcome.details ? ` — ${JSON.stringify(outcome.details).slice(0, 300)}` : ""}` };
  }
  const d = outcome.data;
  await patchState(run.id, { campaign: { campaignId: d.campaignId, campaignSlug: d.campaignSlug, landingUrl: d.landingUrl, adminUrl: d.adminUrl, posts: d.posts.length, generatedBy: d.generatedBy } });
  const scheduled = d.posts.filter((p) => p.status === "SCHEDULED").length;
  return { type: "done", detail: `Campagne « ${d.campaignSlug} » : ${d.posts.length} post(s)${scheduled ? `, dont ${scheduled} programmé(s)` : " en brouillon"} sur ${[...new Set(d.posts.map((p) => p.channel))].join(", ") || cfg.channels.join(", ")}` };
}
