/**
 * Univers de la boutique (sites), lus via l'API v1 `GET /api/v1/sites`.
 * Repli : si la boutique n'est pas configurée ou ne connaît pas encore les univers (404),
 * un seul univers « La Malle à Jeux » (préréglage kit-enfants) avec les catégories actuelles.
 */
import { z } from "zod";
import { isPreset, type UniversePreset } from "./presets";

export const SiteSchema = z.object({
  id: z.string().default(""),
  slug: z.string().min(1),
  name: z.string().min(1),
  preset: z.string().transform((p) => (isPreset(p) ? p : "kit-enfants") as UniversePreset),
  status: z.enum(["ACTIVE", "TEST", "ARCHIVED"]).catch("ACTIVE"),
  audience: z.object({ slug: z.string().default(""), name: z.string().default("") }).nullable().default(null).transform((a) => a ?? { slug: "", name: "Sans audience" }),
  primaryDomain: z.string().nullable().optional(),
  url: z.string().nullable().optional(),
  categories: z.array(z.object({ slug: z.string(), name: z.string() })).default([]),
});
export type Site = z.infer<typeof SiteSchema>;

export const DEFAULT_SITE_SLUG = "la-malle-a-jeux";

export const FALLBACK_CATEGORIES = [
  { slug: "chasses-au-tresor", name: "Chasses au trésor" },
  { slug: "activites-educatives", name: "Activités éducatives" },
  { slug: "evenements", name: "Événements" },
  { slug: "histoires-et-aventures", name: "Histoires et aventures" },
];

export const FALLBACK_SITES: Site[] = [
  {
    id: "fallback",
    slug: DEFAULT_SITE_SLUG,
    name: "La Malle à Jeux",
    preset: "kit-enfants",
    status: "ACTIVE",
    audience: { slug: "familles-enfants", name: "Familles & enfants" },
    primaryDomain: null,
    url: null,
    categories: FALLBACK_CATEGORIES,
  },
];

export interface SitesResult {
  sites: Site[];
  /** live : liste de la boutique ; fallback : boutique non configurée ou sans univers (404) */
  source: "live" | "fallback";
  error?: string;
}

/** Interprète la réponse de `GET /api/v1/sites` (tolérante : entrées invalides ignorées). */
export function parseSites(data: unknown): Site[] {
  if (!Array.isArray(data)) return [];
  return data.map((d) => SiteSchema.safeParse(d)).filter((r) => r.success).map((r) => r.data);
}

/** Univers groupés par audience (ordre d'apparition conservé). */
export function groupByAudience(sites: Site[]): Array<{ audience: string; sites: Site[] }> {
  const groups = new Map<string, Site[]>();
  for (const s of sites) {
    const key = s.audience.name || "Sans audience";
    groups.set(key, [...(groups.get(key) ?? []), s]);
  }
  return [...groups.entries()].map(([audience, list]) => ({ audience, sites: list }));
}

export const SITE_STATUS_LABELS: Record<Site["status"], string> = { ACTIVE: "actif", TEST: "en test", ARCHIVED: "archivé" };

export function siteBySlug(sites: Site[], slug: string | null | undefined): Site | undefined {
  return slug ? sites.find((s) => s.slug === slug) : undefined;
}
