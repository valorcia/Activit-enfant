/**
 * Pilote automatique — machine à états pure (sans base de données), testable.
 *
 * Un run enchaîne 10 étapes. Chaque étape renvoie un « résultat » (terminé, à
 * interroger plus tard, en attente de réponses à coller, échec…) que `applyOutcome`
 * traduit en nouvel état du run et en éventuelle relance différée.
 */
import { AUTOPILOT_STAGE_KEYS, type AutopilotSettings, type AutopilotStageKey } from "../schemas/settings";

export type StageStatus = "pending" | "running" | "waiting" | "done" | "skipped" | "failed";
export type RunStatus = "RUNNING" | "WAITING_INPUT" | "WAITING_APPROVAL" | "COMPLETED" | "FAILED" | "CANCELLED";

export interface Stage {
  key: AutopilotStageKey;
  label: string;
  status: StageStatus;
  startedAt: string | null;
  finishedAt: string | null;
  detail: string | null;
  error: string | null;
  costUsd: number;
  /** Coût cumulé du run au démarrage de l'étape (le coût de l'étape = total à la fin − ce total) */
  costAtStart: number | null;
  /** Validation humaine accordée (point de validation ou dépassement du plafond) */
  approved: boolean;
}

export const STAGE_LABELS: Record<AutopilotStageKey, string> = {
  plan: "Plan du kit",
  content: "Rédaction",
  quality: "Contrôles qualité",
  character: "Planche de personnages",
  illustrations: "Illustrations",
  layout: "Mise en page",
  pdf: "PDF",
  publish: "Boutique",
  video: "Vidéos pub",
  ads: "Publicités",
};

export const STAGE_DESCRIPTIONS: Record<AutopilotStageKey, string> = {
  plan: "Brief → type de kit, personnages, univers, prix (ou import direct du JSON complet)",
  content: "Énigmes, défis, lettres, guide, fiche boutique…",
  quality: "Nombre d'éléments, champs obligatoires, longueurs, mentions interdites",
  character: "Planche de référence des personnages, utilisée pour toutes les illustrations",
  illustrations: "Esquisses (qualité basse) puis versions finales des images validées : illustrations du kit, couverture, visuels boutique et publicité",
  layout: "Assemblage des pages, cadrage automatique et contrôle des images (résolution, format)",
  pdf: "Export PDF et contrôles (débordements, images manquantes)",
  publish: "Fiche produit, couverture, aperçus, PDF privé, publication",
  video: "Vidéos publicitaires (Story, carré…) envoyées à la boutique",
  ads: "Campagne et posts Instagram / Facebook / TikTok",
};

/** Étapes facultatives (désactivables dans les réglages). */
const OPTIONAL: Partial<Record<AutopilotStageKey, keyof AutopilotSettings["stages"]>> = {
  quality: "quality",
  character: "character",
  pdf: "pdf",
  publish: "publish",
  video: "video",
  ads: "ads",
};

export function initStages(cfg: AutopilotSettings): Stage[] {
  return AUTOPILOT_STAGE_KEYS.map((key) => {
    const opt = OPTIONAL[key];
    const enabled = opt ? cfg.stages[opt] !== false : true;
    // Sans boutique, pas de publicité possible
    const disabledByDependency = (key === "ads" && cfg.stages.publish === false) || (key === "publish" && cfg.stages.pdf === false);
    const skipped = !enabled || disabledByDependency;
    return {
      key,
      label: STAGE_LABELS[key],
      status: skipped ? "skipped" : "pending",
      startedAt: null,
      finishedAt: null,
      detail: skipped ? (disabledByDependency ? "Désactivée (dépend d'une étape désactivée)" : "Désactivée dans les réglages") : null,
      error: null,
      costUsd: 0,
      costAtStart: null,
      approved: false,
    } satisfies Stage;
  });
}

export function parseStages(raw: unknown): Stage[] {
  return Array.isArray(raw) ? (raw as Stage[]) : [];
}

/** Étape à exécuter : la première qui n'est ni terminée ni ignorée. */
export function currentStage(stages: Stage[]): Stage | null {
  return stages.find((s) => s.status !== "done" && s.status !== "skipped") ?? null;
}

/** Point de validation avant une étape (null = pas de validation). */
export function approvalGateFor(key: AutopilotStageKey, cfg: AutopilotSettings): string | null {
  const a = cfg.approvals;
  if (key === "quality" && a.afterContent) return "Validation demandée après la rédaction : relisez le contenu du kit, puis continuez.";
  if (key === "layout" && a.afterIllustrations) return "Validation demandée après les illustrations : vérifiez les images (onglet Kit), puis continuez.";
  if (key === "publish" && a.beforePublish) return "Validation demandée avant la publication dans la boutique.";
  const beforeAds = a.beforeAds ?? cfg.postsMode === "auto";
  if (key === "ads" && beforeAds) return cfg.postsMode === "auto" ? "Les posts seront programmés automatiquement : validez avant de lancer la campagne." : "Validation demandée avant la création des publicités.";
  return null;
}

export type GateDecision = { type: "run" } | { type: "approval"; reason: string };

/**
 * Avant d'exécuter une étape : point de validation, puis plafond de coût.
 * Une étape déjà validée (approved) passe sans redemander.
 */
export function beforeStage(stage: Stage, cfg: AutopilotSettings, costSoFarUsd: number, estimatedStageUsd: number): GateDecision {
  if (stage.approved) return { type: "run" };
  if (stage.status === "running") return { type: "run" }; // reprise d'une étape déjà commencée
  const gate = approvalGateFor(stage.key, cfg);
  if (gate) return { type: "approval", reason: gate };
  const cap = cfg.maxCostUsd;
  if (cap > 0 && estimatedStageUsd > 0 && costSoFarUsd + estimatedStageUsd > cap + 1e-9) {
    return {
      type: "approval",
      reason: `Plafond de coût : l'étape « ${stage.label} » est estimée à ${fmt(estimatedStageUsd)} alors que ${fmt(costSoFarUsd)} ont déjà été dépensés (plafond ${fmt(cap)}). Validez pour continuer malgré tout, ou augmentez le plafond dans les réglages.`,
    };
  }
  return { type: "run" };
}

export type StageOutcome =
  | { type: "done"; detail?: string }
  | { type: "skipped"; detail: string }
  | { type: "poll"; detail?: string; delaySeconds?: number }
  | { type: "waiting_input"; detail: string; poll: boolean; delaySeconds?: number }
  | { type: "failed"; error: string }
  | { type: "approval"; reason: string };

export interface RunView {
  status: RunStatus;
  stages: Stage[];
}

export interface Transition {
  status: RunStatus;
  stages: Stage[];
  error: string | null;
  /** Relance du traitement : 0 = immédiatement (étape suivante), n = dans n secondes, null = pas de relance */
  requeueSeconds: number | null;
}

export const POLL_SECONDS = 15;
export const POLL_WAITING_SECONDS = 30;

function patchStage(stages: Stage[], key: AutopilotStageKey, patch: Partial<Stage>): Stage[] {
  return stages.map((s) => (s.key === key ? { ...s, ...patch } : s));
}

/** Démarre une étape (horodatage et coût de départ conservés en cas de reprise). */
export function markStarted(stages: Stage[], key: AutopilotStageKey, costSoFarUsd: number, now = new Date()): Stage[] {
  const s = stages.find((x) => x.key === key);
  return patchStage(stages, key, { status: "running", startedAt: s?.startedAt ?? now.toISOString(), costAtStart: s?.costAtStart ?? costSoFarUsd, error: null });
}

/** Applique le résultat d'une étape au run. */
export function applyOutcome(run: RunView, key: AutopilotStageKey, outcome: StageOutcome, costSoFarUsd: number, now = new Date()): Transition {
  const stage = run.stages.find((s) => s.key === key);
  const stageCost = stage?.costAtStart != null ? Math.max(0, round(costSoFarUsd - stage.costAtStart)) : stage?.costUsd ?? 0;
  switch (outcome.type) {
    case "done":
    case "skipped": {
      const stages = patchStage(run.stages, key, { status: outcome.type === "done" ? "done" : "skipped", finishedAt: now.toISOString(), detail: outcome.detail ?? stage?.detail ?? null, error: null, costUsd: stageCost });
      const next = currentStage(stages);
      return { status: next ? "RUNNING" : "COMPLETED", stages, error: null, requeueSeconds: next ? 0 : null };
    }
    case "poll":
      return { status: "RUNNING", stages: patchStage(run.stages, key, { status: "running", detail: outcome.detail ?? stage?.detail ?? null, costUsd: stageCost }), error: null, requeueSeconds: outcome.delaySeconds ?? POLL_SECONDS };
    case "waiting_input":
      return {
        status: "WAITING_INPUT",
        stages: patchStage(run.stages, key, { status: "waiting", detail: outcome.detail, costUsd: stageCost }),
        error: null,
        requeueSeconds: outcome.poll ? outcome.delaySeconds ?? POLL_WAITING_SECONDS : null,
      };
    case "approval":
      // Une étape qui redemande une validation (ex. esquisses) attend un nouvel accord
      return { status: "WAITING_APPROVAL", stages: patchStage(run.stages, key, { status: "waiting", detail: outcome.reason, approved: false }), error: null, requeueSeconds: null };
    case "failed":
      return { status: "FAILED", stages: patchStage(run.stages, key, { status: "failed", finishedAt: now.toISOString(), error: outcome.error, costUsd: stageCost }), error: `${stage?.label ?? key} : ${outcome.error}`, requeueSeconds: null };
  }
}

/** « Valider et continuer » : l'étape en attente de validation est autorisée. */
export function approveCurrent(stages: Stage[]): Stage[] {
  const cur = currentStage(stages);
  if (!cur) return stages;
  return patchStage(stages, cur.key, { approved: true, status: cur.status === "waiting" ? "pending" : cur.status, detail: cur.status === "waiting" ? null : cur.detail });
}

/** « Relancer l'étape » : remise à zéro de l'étape (et de son état interne, géré par l'appelant). */
export function resetStage(stages: Stage[], key: AutopilotStageKey): Stage[] {
  return patchStage(stages, key, { status: "pending", startedAt: null, finishedAt: null, detail: null, error: null, costAtStart: null, approved: false });
}

/** « Reprendre » après un échec : l'étape échouée est remise en attente, les autres sont conservées. */
export function resumeStages(stages: Stage[]): Stage[] {
  const cur = currentStage(stages);
  if (!cur || cur.status !== "failed") return stages;
  return patchStage(stages, cur.key, { status: "pending", error: null, finishedAt: null });
}

export function isActive(status: RunStatus | string) {
  return status === "RUNNING" || status === "WAITING_INPUT" || status === "WAITING_APPROVAL";
}

function round(n: number) {
  return Math.round(n * 10000) / 10000;
}
function fmt(usd: number) {
  return `${usd.toFixed(2).replace(".", ",")} $`;
}
