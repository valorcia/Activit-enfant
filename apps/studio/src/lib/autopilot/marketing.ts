/**
 * Client du pilote marketing de la boutique :
 *   POST {shop}/api/v1/products/:id/marketing/autopilot
 *   GET  {shop}/api/v1/products/:id/marketing
 * Serveur uniquement (clé API de la boutique).
 */
export type AdsChannel = "instagram" | "facebook" | "tiktok";

export interface MarketingAutopilotBody {
  channels: AdsChannel[];
  variantsPerChannel: number;
  videoUrls?: string[];
  copy?: Record<string, unknown> | null;
  campaign?: { name?: string; dailyBudgetCents?: number; startsAt?: string; objective?: string };
  schedule?: { mode: "draft" | "auto"; startAt?: string | null; spacingHours?: number };
}

export interface MarketingAutopilotResult {
  campaignId: string;
  campaignSlug: string;
  landingUrl: string;
  adminUrl: string;
  posts: Array<{ id: string; channel: string; format: string; status: string; scheduledAt: string | null; accountName: string | null }>;
  generatedBy: string;
}

export type MarketingOutcome =
  | { kind: "ok"; data: MarketingAutopilotResult }
  | { kind: "needs_copy"; prompt: string; schema: unknown }
  | { kind: "invalid"; error: string; details?: unknown }
  | { kind: "missing_endpoint"; error: string };

export class MarketingApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export async function callMarketingAutopilot(
  cfg: { baseUrl: string; apiKey: string },
  productId: string,
  body: MarketingAutopilotBody,
  fetchImpl: FetchLike = fetch,
): Promise<MarketingOutcome> {
  if (!cfg.baseUrl || !cfg.apiKey) throw new MarketingApiError("Boutique non configurée (URL ou clé API manquante)", 0);
  const url = `${cfg.baseUrl.replace(/\/$/, "")}/api/v1/products/${encodeURIComponent(productId)}/marketing/autopilot`;
  const res = await fetchImpl(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.apiKey}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(180_000),
  });
  const text = await res.text();
  let json: Record<string, unknown> = {};
  let isJson = false;
  try { json = text ? (JSON.parse(text) as Record<string, unknown>) : {}; isJson = Boolean(text); } catch { json = { error: text.slice(0, 300) }; }
  const error = typeof json.error === "string" ? json.error : `Erreur ${res.status}`;
  if (res.status === 201 || res.status === 200) return { kind: "ok", data: json.data as MarketingAutopilotResult };
  if (res.status === 409 && json.error === "copywriter_unavailable") {
    const d = (json.details ?? {}) as { prompt?: string; schema?: unknown };
    if (!d.prompt) throw new MarketingApiError("La boutique demande les textes publicitaires mais n'a pas fourni de prompt", 409);
    return { kind: "needs_copy", prompt: d.prompt, schema: d.schema ?? null };
  }
  if (res.status === 422) return { kind: "invalid", error, details: json.details };
  // 404 sans réponse JSON de l'API (page Next.js) : la route n'existe pas encore dans cette version de la boutique
  if ((res.status === 404 || res.status === 405) && !isJson) return { kind: "missing_endpoint", error: "La boutique ne propose pas encore le pilote marketing : mettez-la à jour." };
  throw new MarketingApiError(error, res.status);
}

/** Construit la demande à partir des réglages du pilote automatique. */
export function buildMarketingBody(opts: {
  title: string;
  channels: AdsChannel[];
  variantsPerChannel: number;
  videoUrls: string[];
  copy: Record<string, unknown> | null;
  dailyBudgetCents: number;
  postsMode: "draft" | "auto";
  startOffsetHours: number;
  spacingHours: number;
  now?: Date;
}): MarketingAutopilotBody {
  const start = new Date((opts.now ?? new Date()).getTime() + opts.startOffsetHours * 3600_000).toISOString();
  return {
    channels: opts.channels,
    variantsPerChannel: Math.max(1, Math.min(3, opts.variantsPerChannel)),
    videoUrls: opts.videoUrls.length ? opts.videoUrls : undefined,
    copy: opts.copy,
    campaign: { name: `${opts.title} — lancement`.slice(0, 120), dailyBudgetCents: opts.dailyBudgetCents, startsAt: start },
    schedule: { mode: opts.postsMode, startAt: opts.postsMode === "auto" ? start : null, spacingHours: opts.spacingHours },
  };
}
