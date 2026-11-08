/**
 * Machine à états d'une vidéo publicitaire (pure, testable) :
 *   création → [clip d'accroche : fournisseur | à téléverser] → montage → prête
 */
export type ClipProviderName = "runway" | "manual" | "mock" | "none";
export type AdVideoStatus = "QUEUED" | "RENDERING" | "WAITING_CLIP" | "READY" | "FAILED";
export type NextAction = "clip" | "poll" | "wait_upload" | "render" | "none";

export interface AdTransition {
  status: AdVideoStatus;
  step: string;
  action: NextAction;
  error?: string;
}

/** Délai maximal d'attente d'un clip chez le fournisseur. */
export const CLIP_TIMEOUT_MS = 10 * 60_000;
/** Intervalle entre deux interrogations du fournisseur. */
export const CLIP_POLL_SECONDS = 10;

export function afterCreate(clipProvider: ClipProviderName): AdTransition {
  if (clipProvider === "none") return { status: "QUEUED", step: "En file pour le montage", action: "render" };
  return { status: "QUEUED", step: "Préparation du clip d'accroche", action: "clip" };
}

/** Réponse du fournisseur après lancement ou interrogation. */
export function afterProviderState(state: { status: "pending" | "running" | "succeeded" | "failed"; error?: string; progress?: number }, elapsedMs: number): AdTransition {
  if (state.status === "succeeded") return { status: "QUEUED", step: "Clip reçu, en file pour le montage", action: "render" };
  if (state.status === "failed") return { status: "FAILED", step: "Échec du clip d'accroche", action: "none", error: state.error ?? "Le fournisseur n'a pas pu générer le clip" };
  if (elapsedMs > CLIP_TIMEOUT_MS) return { status: "FAILED", step: "Délai dépassé", action: "none", error: "Le clip n'a pas été livré dans les 10 minutes. Relancez la génération." };
  const pct = state.progress != null ? ` (${Math.round(state.progress * 100)} %)` : "";
  return { status: "WAITING_CLIP", step: `Animation en cours chez le fournisseur${pct}`, action: "poll" };
}

/** Mode copier-coller : le clip doit être produit à la main puis téléversé. */
export function afterManualRequest(): AdTransition {
  return { status: "WAITING_CLIP", step: "Clip à produire et à téléverser (page « À coller »)", action: "wait_upload" };
}

/** Le clip a été téléversé (ou téléchargé) : reprise du montage. */
export function afterClipAvailable(): AdTransition {
  return { status: "QUEUED", step: "Clip reçu, en file pour le montage", action: "render" };
}

export function afterRenderStart(): AdTransition {
  return { status: "RENDERING", step: "Montage de la vidéo", action: "none" };
}

export function afterRenderDone(sentToShop: boolean): AdTransition {
  return { status: "READY", step: sentToShop ? "Prête · envoyée à la boutique" : "Prête", action: "none" };
}

export function afterRenderFailed(error: string): AdTransition {
  return { status: "FAILED", step: "Échec du montage", action: "none", error };
}

/** Coût estimé du clip (affiché avant lancement). */
export function estimateClipCostUsd(provider: ClipProviderName, durationSeconds: number, usdPerSecond: number): number {
  if (provider !== "runway") return 0;
  return Math.round(durationSeconds * usdPerSecond * 100) / 100;
}

/** Fournisseur effectivement utilisable selon la configuration. */
export function resolveClipProvider(requested: ClipProviderName, opts: { runwayConfigured: boolean; allowMock?: boolean }): { provider: ClipProviderName } | { error: string } {
  if (requested === "runway" && !opts.runwayConfigured) return { error: "Clé Runway absente : renseignez-la dans Paramètres → Vidéo, ou choisissez le mode copier-coller." };
  if (requested === "mock" && !opts.allowMock) return { error: "Le fournisseur de démonstration n'est disponible qu'en développement." };
  return { provider: requested };
}
