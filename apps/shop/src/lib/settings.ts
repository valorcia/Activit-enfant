import { unstable_cache, revalidateTag } from "next/cache";
import { prisma } from "@/lib/db";
import { settingsSchemas, type SettingsKey, type SettingsMap } from "@/lib/schemas/settings";
import { SITES_TAG } from "@/lib/sites/constants";
import { deepMerge, getPreset } from "@/lib/sites/presets";

export const SETTINGS_TAG = "site-settings";

/**
 * Réglages par univers. Fusion, du plus général au plus précis :
 *  - clés d'identité (marque, thème, accueil, navigation, SEO, analytics, conversion) :
 *    valeurs par défaut des schémas ← préréglage de l'univers ← surcharges de l'univers ;
 *  - autres clés (commerce) : valeurs par défaut ← réglages globaux (SiteSetting) ← surcharges de l'univers.
 * Les réglages globaux ne fuient donc jamais l'identité d'un univers vers un autre.
 */
export const SITE_SCOPED_KEYS: SettingsKey[] = ["brand", "theme", "homepage", "navigation", "seo", "analytics", "conversion"];

export interface SettingsSite {
  id: string;
  name: string;
  preset: string;
  settings: unknown;
}

/** Valeurs par défaut (issues des schémas Zod). */
export function defaultSettings<K extends SettingsKey>(key: K): SettingsMap[K] {
  return settingsSchemas[key].parse({}) as SettingsMap[K];
}

/** Fusion pure (testable) des couches de réglages pour un univers. */
export function mergeSettings(site: SettingsSite | null, globals: Record<string, unknown>): SettingsMap {
  const preset = site ? getPreset(site.preset).settings(site.name) : {};
  const overrides = (site?.settings && typeof site.settings === "object" ? site.settings : {}) as Record<string, unknown>;
  const result = {} as SettingsMap;
  for (const key of Object.keys(settingsSchemas) as SettingsKey[]) {
    let value: unknown = defaultSettings(key);
    if (!SITE_SCOPED_KEYS.includes(key) || !site) value = deepMerge(value, globals[key]);
    if (site) {
      value = deepMerge(value, (preset as Record<string, unknown>)[key]);
      value = deepMerge(value, overrides[key]);
    }
    const parsed = settingsSchemas[key].safeParse(value);
    (result as Record<string, unknown>)[key] = parsed.success ? parsed.data : defaultSettings(key);
  }
  return result;
}

async function loadGlobals(): Promise<Record<string, unknown>> {
  // Base injoignable (réveil Neon, incident) : on sert les valeurs par défaut plutôt qu'une erreur 500
  const rows = await prisma.siteSetting.findMany().catch((e: unknown) => {
    console.error("[settings] base injoignable, valeurs par défaut utilisées", e instanceof Error ? e.message : e);
    return [] as Array<{ key: string; value: unknown }>;
  });
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

async function loadSettingsFor(siteId: string | null): Promise<SettingsMap> {
  const globals = await loadGlobals();
  if (!siteId) return mergeSettings(null, globals);
  const site = await prisma.site.findUnique({ where: { id: siteId }, select: { id: true, name: true, preset: true, settings: true } }).catch(() => null);
  if (!site) {
    // Univers introuvable (ou base injoignable) : univers par défaut
    const def = await prisma.site.findFirst({ where: { isDefault: true }, select: { id: true, name: true, preset: true, settings: true } }).catch(() => null);
    return mergeSettings(def, globals);
  }
  return mergeSettings(site, globals);
}

const getCachedSettings = unstable_cache(
  async (siteId: string | null) => loadSettingsFor(siteId),
  ["site-settings-v2"],
  { tags: [SETTINGS_TAG, SITES_TAG], revalidate: 300 },
);

type SiteArg = { id: string } | string | null | undefined;
const siteIdOf = (site: SiteArg) => (typeof site === "string" ? site : site?.id ?? null);

/**
 * Réglages d'un univers (par défaut : l'univers par défaut). `null` explicite
 * dans `globalOnly` renvoie les réglages communs (admin « Tous les univers »).
 */
export async function getSettings(site?: SiteArg, opts: { globalOnly?: boolean } = {}): Promise<SettingsMap> {
  const cached = await getCachedSettings(opts.globalOnly ? null : siteIdOf(site) ?? (await defaultSiteId()));
  const result = { ...cached } as SettingsMap;
  for (const key of Object.keys(settingsSchemas) as SettingsKey[]) {
    if (!(key in cached) || cached[key] == null) (result as Record<string, unknown>)[key] = defaultSettings(key);
  }
  return result;
}

export async function getSetting<K extends SettingsKey>(key: K, site?: SiteArg): Promise<SettingsMap[K]> {
  const all = await getSettings(site);
  return all[key] ?? defaultSettings(key);
}

async function defaultSiteId(): Promise<string | null> {
  const def = await prisma.site.findFirst({ where: { isDefault: true }, select: { id: true } }).catch(() => null);
  return def?.id ?? null;
}

/**
 * Enregistre un groupe de réglages : dans l'univers donné (surcharge complète de la clé)
 * ou, sans univers, dans les réglages globaux communs.
 */
export async function saveSetting<K extends SettingsKey>(key: K, value: unknown, siteId?: string | null): Promise<SettingsMap[K]> {
  const parsed = settingsSchemas[key].parse(value) as SettingsMap[K];
  if (siteId) {
    const site = await prisma.site.findUniqueOrThrow({ where: { id: siteId }, select: { settings: true } });
    const current = (site.settings && typeof site.settings === "object" ? site.settings : {}) as Record<string, unknown>;
    await prisma.site.update({ where: { id: siteId }, data: { settings: { ...current, [key]: parsed } as object } });
  } else {
    await prisma.siteSetting.upsert({
      where: { key },
      create: { key, value: parsed as object },
      update: { value: parsed as object },
    });
  }
  revalidateTag(SETTINGS_TAG, "max");
  revalidateTag(SITES_TAG, "max");
  return parsed;
}

/** Paramètres analytics sans les jetons serveur (à passer aux composants client). */
export function publicAnalytics(a: SettingsMap["analytics"]): SettingsMap["analytics"] {
  return { ...a, metaCapiToken: null, tiktokEventsToken: null };
}
