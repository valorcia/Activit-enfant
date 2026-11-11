"use server";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { cancelJob, enqueue } from "@/lib/queue/jobs";
import { QUEUES } from "@/lib/queue/boss";
import { getAiSettings, getAutopilotSettings, getVideoSettings, saveAutopilotSettings } from "@/lib/settings";
import { AUTOPILOT_STAGE_KEYS, type AutopilotStageKey } from "@/lib/schemas/settings";
import { extractJson } from "@/lib/ai/structured";
import { cleanPastedJson } from "@/lib/ai/manual-core";
import { detectKitContentFormat } from "@/lib/kits/schemas";
import { defaultTypeForPreset, kitType, typeAllowedForPreset } from "@/lib/kits/types";
import { activeSites } from "@/lib/universes";
import { SITE_STATUS_LABELS, siteBySlug } from "@/lib/universes/sites";
import { coloringApiImageEstimate, estimateRun, type CostEstimate } from "@/lib/autopilot/estimate";
import { MAX_ITEMS_PER_BOOK } from "@/lib/kits/limits";

/** « 120 dessins », « 40 recettes »… dans un brief libre. */
function countFromBrief(t: string, countLabel: string): number | null {
  const noun = countLabel.replace(/s$/, "");
  const m = new RegExp(`(\\d{1,3})\\s*(?:${noun}s?|coloriages?|pages? à colorier|planches?)`, "i").exec(t);
  const n = m ? Number(m[1]) : NaN;
  return Number.isFinite(n) && n >= 1 ? Math.min(MAX_ITEMS_PER_BOOK, n) : null;
}
import { approveCurrent, initStages, parseStages, resetStage, resumeStages } from "@/lib/autopilot/stages";
import { scheduleRun, startRun, type RunState } from "@/lib/autopilot/runner";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };
const fail = (e: unknown): { ok: false; error: string } => ({ ok: false, error: e instanceof Error ? e.message : String(e) });

export interface AutopilotPreview {
  kitLabel: string;
  /** Univers ciblé (choisi ou proposé), si connu avant l'analyse */
  siteName: string | null;
  count: number;
  countLabel: string;
  contentProvided: boolean;
  title: string | null;
  estimate: CostEstimate;
  summary: string[];
  maxCostUsd: number;
  /** Cahier de coloriage : coût des images par l'API (« ≈ N images × prix = X $ ») et mode courant */
  coloringApi: { label: string; totalUsd: number; manualImagesNow: boolean } | null;
}

/** Ce que le pilote automatique va faire, avec l'estimation de coût, avant de lancer. */
export async function previewAutopilotAction(text: string, siteSlug?: string | null): Promise<Result<AutopilotPreview>> {
  try {
    const t = text.trim();
    if (t.length < 10) return { ok: false, error: "Collez un brief ou un JSON de kit (au moins quelques mots)." };
    const [cfg, ai, video] = await Promise.all([getAutopilotSettings(), getAiSettings(), getVideoSettings()]);
    const json = t.includes("{") ? extractJson(cleanPastedJson(t)) : null;
    const format = json ? detectKitContentFormat(json) : null;
    const content = format ? (json as Record<string, unknown>) : null;
    const items = content ? ((content.enigmes ?? content.idees ?? content.chapitres ?? content.recettes ?? content.experiences ?? content.dessins) as unknown[]) : null;
    const sites = await activeSites();
    const site = siteBySlug(sites, siteSlug);
    const byFormat: Record<string, string> = { pranks: "lutins-farceurs", guide: "guide-pratique", recipes: "livre-recettes", science: "fiches-sciences", treasure_hunt: "chasse-au-tresor", coloring: "cahier-coloriage" };
    let guessKey = format ? byFormat[format] : /coloriage|colorier/i.test(t) ? "cahier-coloriage" : /piscine|guide pratique|eau verte/i.test(t) ? "guide-pratique" : /recette|cuisine/i.test(t) ? "livre-recettes" : /expérience|science/i.test(t) ? "fiches-sciences" : /lutin|farce|noël|noel/i.test(t) ? "lutins-farceurs" : "chasse-au-tresor";
    if (site && !typeAllowedForPreset(guessKey, site.preset)) guessKey = defaultTypeForPreset(site.preset);
    const def = kitType(guessKey);
    const count = items?.length ?? countFromBrief(t, def.countLabel) ?? def.defaultCount;
    const coloring = def.format === "coloring";
    const estimate = estimateRun({ format: def.format ?? "treasure_hunt", count, contentProvided: Boolean(content), ai, autopilot: cfg, runwayUsdPerSecond: video.usdPerSecond });
    const manualImagesNow = ai.mode === "manual" && ai.manualFor !== "text";
    const api = coloring ? coloringApiImageEstimate(ai, count) : null;
    const on = (k: keyof typeof cfg.stages) => cfg.stages[k] !== false;
    const summary = [
      content ? "Contenu complet reconnu : importé tel quel (aucune rédaction par l'IA)." : ai.mode === "manual" && ai.manualFor !== "images" ? "Textes en mode copier-coller : le run s'arrêtera sur les demandes « À coller »." : `Rédaction par l'IA (${ai.textProvider === "mock" ? "démonstration" : ai.textModel}).`,
      coloring && api ? `Cahier de coloriage : ${api.label} par l'API (${ai.coloring.imageModel}, ${ai.coloring.imageQuality}, sans esquisse ; couverture ${ai.coloring.coverModel} ${ai.coloring.coverQuality}).${manualImagesNow ? " Mode actuel : copier-coller (vous pouvez basculer les images sur l'API pour ce run)." : ""}` : "",
      ai.mode === "manual" && ai.manualFor !== "text" ? "Images en mode copier-coller : le run attendra vos images dans « À coller »." : `Illustrations : ${estimate.images} image(s) (${ai.imageProvider === "mock" ? "démonstration" : `${ai.imageModel}, qualité ${ai.imageQuality}`}).`,
      on("pdf") ? `PDF numérique${cfg.printPdf ? " + imprimable" : ""}, contrôlé (débordements, images manquantes).` : "PDF : désactivé.",
      on("publish") && on("pdf") ? `Boutique : ${cfg.publishDirect ? "publication directe" : "brouillon à valider"}, avec couverture, aperçus et PDF privé.` : "Boutique : désactivée.",
      cfg.stages.etsy === true && on("publish") && on("pdf") ? `Etsy : fiche ${cfg.etsyState === "active" ? "active" : "en brouillon"} créée par la boutique (0,20 $ de mise en vente ; étape ignorée sans boutique Etsy connectée).` : "Etsy : non.",
      on("video") ? `Vidéos : ${cfg.videoFormats.join(", ")} de ${cfg.videoDurationSeconds} s${cfg.clipProvider === "runway" ? `, clip Runway de ${cfg.clipDurationSeconds} s` : cfg.clipProvider === "manual" ? ", clip à téléverser" : ""}.` : "Vidéos : désactivées.",
      on("ads") && on("publish") ? `Publicités : ${cfg.channels.join(", ")} · ${cfg.variantsPerChannel} variante(s) par canal · ${cfg.postsMode === "auto" ? "programmation automatique" : "brouillons"}.` : "Publicités : désactivées.",
    ];
    const gates = [cfg.approvals.afterContent && "après la rédaction", cfg.approvals.afterIllustrations && "après les illustrations", cfg.approvals.beforePublish && "avant la boutique", (cfg.approvals.beforeAds ?? cfg.postsMode === "auto") && "avant les publicités"].filter(Boolean);
    summary.unshift(site ? `Univers : ${site.name} (${site.audience.name}${site.status !== "ACTIVE" ? `, ${SITE_STATUS_LABELS[site.status]}` : ""}).` : "Univers : proposé par l'analyse du brief.");
    summary.push(gates.length ? `Points de validation : ${gates.join(", ")}.` : "Aucun point de validation : tout s'enchaîne automatiquement.");
    const title = content && typeof content.titre === "string" ? content.titre : null;
    return { ok: true, data: { siteName: site?.name ?? null, kitLabel: content ? def.label : `${def.label} (type confirmé à l'analyse)`, count, countLabel: def.countLabel, contentProvided: Boolean(content), title, estimate, summary: summary.filter(Boolean), maxCostUsd: cfg.maxCostUsd, coloringApi: api ? { label: api.label, totalUsd: api.totalUsd, manualImagesNow } : null } };
  } catch (e) {
    return fail(e);
  }
}

/** Lance le pilote automatique sur un brief (ou un JSON complet). */
export async function startAutopilotAction(text: string, siteSlug?: string | null, opts: { imagesViaApi?: boolean } = {}): Promise<Result<{ runId: string }>> {
  try {
    const t = text.trim();
    if (t.length < 10) return { ok: false, error: "Collez un brief ou un JSON de kit." };
    const cfg = await getAutopilotSettings();
    const json = t.includes("{") ? extractJson(cleanPastedJson(t)) : null;
    const title = json && typeof (json as Record<string, unknown>).titre === "string" ? String((json as Record<string, unknown>).titre) : t.split("\n")[0].slice(0, 80);
    const site = siteBySlug(await activeSites(), siteSlug);
    const runId = await startRun({ brief: t, config: cfg, title, stages: initStages(cfg), siteSlug: site?.slug ?? null, imagesViaApi: opts.imagesViaApi });
    revalidatePath("/autopilot");
    return { ok: true, data: { runId } };
  } catch (e) {
    return fail(e);
  }
}

async function ensureJob(run: { id: string; jobId: string | null; bookId: string | null }) {
  if (run.jobId) return run.jobId;
  const job = await enqueue(QUEUES.autopilotRun, { runId: run.id });
  await prisma.autopilotRun.update({ where: { id: run.id }, data: { jobId: job.id } });
  return job.id;
}

/** « Valider et continuer » (point de validation ou plafond de coût). */
export async function approveAutopilotAction(runId: string): Promise<Result<null>> {
  try {
    const run = await prisma.autopilotRun.findUniqueOrThrow({ where: { id: runId } });
    if (run.status !== "WAITING_APPROVAL") return { ok: false, error: "Ce run n'attend pas de validation." };
    await prisma.autopilotRun.update({ where: { id: runId }, data: { status: "RUNNING", stages: approveCurrent(parseStages(run.stages)) as unknown as Prisma.InputJsonValue } });
    await scheduleRun(runId, await ensureJob(run), 0);
    revalidatePath(`/autopilot/${runId}`);
    return { ok: true, data: null };
  } catch (e) {
    return fail(e);
  }
}

/** « Reprendre » : après un échec, une annulation, ou pour revérifier une attente. */
export async function resumeAutopilotAction(runId: string): Promise<Result<null>> {
  try {
    const run = await prisma.autopilotRun.findUniqueOrThrow({ where: { id: runId } });
    if (run.status === "COMPLETED") return { ok: false, error: "Ce run est terminé : utilisez « Relancer l'étape » pour refaire une étape." };
    if (run.status === "WAITING_APPROVAL") return approveAutopilotAction(runId);
    await prisma.autopilotRun.update({ where: { id: runId }, data: { status: "RUNNING", error: null, stages: resumeStages(parseStages(run.stages)) as unknown as Prisma.InputJsonValue } });
    await scheduleRun(runId, await ensureJob(run), 0);
    revalidatePath(`/autopilot/${runId}`);
    return { ok: true, data: null };
  } catch (e) {
    return fail(e);
  }
}

/** État interne propre à chaque étape, effacé quand on relance l'étape. */
const STAGE_STATE_KEYS: Partial<Record<AutopilotStageKey, Array<keyof RunState>>> = {
  illustrations: ["illustrationsJobId", "sketchApprovalRequested", "finalizeJobId"],
  pdf: ["pdfExportIds", "pdfJobIds", "pdfAutofixAttempts", "pdfAutofixNotes"],
  publish: ["productId", "publicUrl", "editUrl", "publishStatus"],
  video: ["videoIds", "videoNotes"],
  ads: ["adsCopy", "campaign"],
};

/** « Relancer l'étape » : refait une étape (les étapes déjà terminées sont conservées). */
export async function retryAutopilotStageAction(runId: string, key: string): Promise<Result<null>> {
  try {
    if (!(AUTOPILOT_STAGE_KEYS as readonly string[]).includes(key)) return { ok: false, error: "Étape inconnue" };
    const k = key as AutopilotStageKey;
    const run = await prisma.autopilotRun.findUniqueOrThrow({ where: { id: runId } });
    if (run.status === "RUNNING") return { ok: false, error: "Le run est en cours : attendez la fin de l'étape ou annulez-le." };
    const state = { ...((run.state ?? {}) as RunState) };
    for (const field of STAGE_STATE_KEYS[k] ?? []) delete state[field];
    if (k === "plan" && run.bookId) return { ok: false, error: "Le kit est déjà créé : relancez plutôt la rédaction ou une étape suivante." };
    await prisma.autopilotRun.update({ where: { id: runId }, data: { status: "RUNNING", error: null, state: state as unknown as Prisma.InputJsonValue, stages: resetStage(parseStages(run.stages), k) as unknown as Prisma.InputJsonValue } });
    await scheduleRun(runId, await ensureJob(run), 0);
    revalidatePath(`/autopilot/${runId}`);
    return { ok: true, data: null };
  } catch (e) {
    return fail(e);
  }
}

export async function cancelAutopilotAction(runId: string): Promise<Result<null>> {
  try {
    const run = await prisma.autopilotRun.findUniqueOrThrow({ where: { id: runId } });
    const state = (run.state ?? {}) as RunState;
    await prisma.autopilotRun.update({ where: { id: runId }, data: { status: "CANCELLED", error: "Annulé" } });
    for (const id of [run.jobId, state.illustrationsJobId, state.finalizeJobId, ...(state.pdfJobIds ?? [])].filter(Boolean) as string[]) await cancelJob(id);
    revalidatePath(`/autopilot/${runId}`);
    return { ok: true, data: null };
  } catch (e) {
    return fail(e);
  }
}

export async function saveAutopilotSettingsAction(input: unknown): Promise<Result<null>> {
  try {
    await saveAutopilotSettings(input);
    revalidatePath("/settings");
    return { ok: true, data: null };
  } catch (e) {
    return fail(e);
  }
}
