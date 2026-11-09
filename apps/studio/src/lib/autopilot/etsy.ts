/**
 * Client de publication Etsy de la boutique :
 *   POST {shop}/api/v1/products/:id/etsy  { state?: "draft" | "active" }
 * Serveur uniquement (clé API de la boutique). La boutique gère la fiche Etsy
 * (idempotente : création puis mises à jour), le studio ne parle jamais à Etsy.
 */
import type { StageOutcome } from "./stages";

export interface EtsyPublishResult { listingId: string | null; url: string | null; state: string; warnings: string[]; created?: boolean }

export type EtsyOutcome =
  | { kind: "ok"; data: EtsyPublishResult }
  /** 409 : boutique Etsy non connectée, désactivée pour l'univers ou à reconnecter */
  | { kind: "unavailable"; reason: string; code: string }
  /** 422 : produit incomplet pour Etsy (PDF > 20 Mo, catégorie Etsy manquante…) */
  | { kind: "invalid"; error: string; code: string | null }
  | { kind: "missing_endpoint"; error: string };

export class EtsyApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

const UNAVAILABLE_LABEL: Record<string, string> = {
  etsy_not_connected: "aucune boutique Etsy connectée pour cet univers (boutique → Marketing social → Connecteurs)",
  etsy_disabled: "publication Etsy désactivée pour cet univers (boutique → Marketing social → Etsy)",
  etsy_reconnect: "la boutique Etsy doit être reconnectée (autorisation expirée)",
};

export async function callEtsyPublish(
  cfg: { baseUrl: string; apiKey: string },
  productId: string,
  body: { state: "draft" | "active" },
  fetchImpl: FetchLike = fetch,
): Promise<EtsyOutcome> {
  if (!cfg.baseUrl || !cfg.apiKey) throw new EtsyApiError("Boutique non configurée (URL ou clé API manquante)", 0);
  const url = `${cfg.baseUrl.replace(/\/$/, "")}/api/v1/products/${encodeURIComponent(productId)}/etsy`;
  const res = await fetchImpl(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.apiKey}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(240_000),
  });
  const text = await res.text();
  let json: Record<string, unknown> = {};
  let isJson = false;
  try { json = text ? (JSON.parse(text) as Record<string, unknown>) : {}; isJson = Boolean(text); } catch { json = { error: text.slice(0, 300) }; }
  const error = typeof json.error === "string" ? json.error : `Erreur ${res.status}`;
  const code = typeof json.code === "string" ? json.code : null;
  if (res.ok) return { kind: "ok", data: json.data as EtsyPublishResult };
  if (res.status === 409) {
    const c = code === "etsy_reconnect" ? code : error;
    return { kind: "unavailable", code: c, reason: UNAVAILABLE_LABEL[c] ?? (typeof json.message === "string" ? json.message : error) };
  }
  if (res.status === 422) return { kind: "invalid", error, code };
  if ((res.status === 404 || res.status === 405) && !isJson) return { kind: "missing_endpoint", error: "La boutique ne propose pas encore la publication Etsy : mettez-la à jour." };
  throw new EtsyApiError(error, res.status);
}

/** Traduit la réponse de la boutique en résultat d'étape (pure, testée). */
export function etsyStageOutcome(o: EtsyOutcome): StageOutcome {
  switch (o.kind) {
    case "ok": {
      const d = o.data;
      const state = d.state === "active" ? "active" : d.state === "draft" ? "brouillon" : d.state;
      const verb = d.created === false ? "Fiche Etsy mise à jour" : "Fiche Etsy créée";
      return { type: "done", detail: `${verb} (${state})${d.url ? ` : ${d.url}` : ""}${d.warnings?.length ? ` — ${d.warnings.join(" ")}` : ""}` };
    }
    case "unavailable":
      return { type: "skipped", detail: `Ignorée : ${o.reason}.` };
    case "invalid":
      // Le kit est en ligne sur la boutique : on ne bloque pas les vidéos et publicités
      return { type: "skipped", detail: `Ignorée : ${o.error} Corrigez puis publiez depuis la fiche produit de la boutique (section Etsy).` };
    case "missing_endpoint":
      return { type: "skipped", detail: `Ignorée : ${o.error}` };
  }
}
