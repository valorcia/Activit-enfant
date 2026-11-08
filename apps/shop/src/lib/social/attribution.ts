/** Construction des liens UTM et attribution des commandes aux canaux. */

export type UtmSource = "facebook" | "instagram" | "tiktok" | string;
export type UtmMedium = "social" | "paid" | string;

export interface UtmParams {
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content?: string;
  utm_term?: string;
}

export function slugifyUtm(input: string): string {
  return input
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "campagne";
}

/** Ajoute (ou remplace) les paramètres UTM sur une URL. */
export function withUtm(url: string, utm: UtmParams): string {
  const u = new URL(url);
  for (const [k, v] of Object.entries(utm)) {
    if (v) u.searchParams.set(k, v);
  }
  return u.toString();
}

export function sourceForProvider(provider: "META" | "TIKTOK" | "OTHER", kind?: "PAGE" | "INSTAGRAM" | "TIKTOK" | "AD_ACCOUNT" | null): UtmSource {
  if (provider === "TIKTOK") return "tiktok";
  if (provider === "META") return kind === "INSTAGRAM" ? "instagram" : "facebook";
  return "other";
}

/** Lit les UTM d'un objet `Order.utm` (JSON) de façon tolérante. */
export function readUtm(raw: unknown): Partial<UtmParams> {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const pick = (k: keyof UtmParams) => (typeof o[k] === "string" && (o[k] as string).length ? (o[k] as string) : undefined);
  return { utm_source: pick("utm_source"), utm_medium: pick("utm_medium"), utm_campaign: pick("utm_campaign"), utm_content: pick("utm_content"), utm_term: pick("utm_term") };
}

export const UTM_STORAGE_KEY = "cc-utm";
export const UTM_TTL_DAYS = 30;
