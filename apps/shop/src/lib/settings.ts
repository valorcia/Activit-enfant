import { unstable_cache, revalidateTag } from "next/cache";
import { prisma } from "@/lib/db";
import { settingsSchemas, type SettingsKey, type SettingsMap } from "@/lib/schemas/settings";

export const SETTINGS_TAG = "site-settings";

/** Valeurs par défaut (issues des schémas Zod). */
export function defaultSettings<K extends SettingsKey>(key: K): SettingsMap[K] {
  return settingsSchemas[key].parse({}) as SettingsMap[K];
}

async function loadAllSettings(): Promise<SettingsMap> {
  // Base injoignable (réveil Neon, incident) : on sert les valeurs par défaut plutôt qu'une erreur 500
  const rows = await prisma.siteSetting.findMany().catch((e: unknown) => {
    console.error("[settings] base injoignable, valeurs par défaut utilisées", e instanceof Error ? e.message : e);
    return [] as Array<{ key: string; value: unknown }>;
  });
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  const result = {} as SettingsMap;
  for (const key of Object.keys(settingsSchemas) as SettingsKey[]) {
    const raw = byKey.get(key);
    const parsed = settingsSchemas[key].safeParse(raw ?? {});
    (result as Record<string, unknown>)[key] = parsed.success ? parsed.data : defaultSettings(key);
  }
  return result;
}

const getCachedSettings = unstable_cache(loadAllSettings, ["site-settings"], { tags: [SETTINGS_TAG], revalidate: 300 });

/**
 * Paramètres du site, mis en cache et invalidés à chaque modification dans l'admin.
 * Les clés absentes d'une entrée de cache antérieure (nouveau groupe de réglages
 * ajouté par une mise à jour) sont complétées par leurs valeurs par défaut.
 */
export async function getSettings(): Promise<SettingsMap> {
  const cached = await getCachedSettings();
  const result = { ...cached } as SettingsMap;
  for (const key of Object.keys(settingsSchemas) as SettingsKey[]) {
    if (!(key in cached) || cached[key] == null) (result as Record<string, unknown>)[key] = defaultSettings(key);
  }
  return result;
}

export async function getSetting<K extends SettingsKey>(key: K): Promise<SettingsMap[K]> {
  const all = await getSettings();
  // Une clé ajoutée après la mise en cache peut manquer : repli sur les valeurs par défaut
  return all[key] ?? defaultSettings(key);
}

export async function saveSetting<K extends SettingsKey>(key: K, value: unknown): Promise<SettingsMap[K]> {
  const parsed = settingsSchemas[key].parse(value) as SettingsMap[K];
  await prisma.siteSetting.upsert({
    where: { key },
    create: { key, value: parsed as object },
    update: { value: parsed as object },
  });
  revalidateTag(SETTINGS_TAG, "max");
  return parsed;
}

/** Paramètres analytics sans les jetons serveur (à passer aux composants client). */
export function publicAnalytics(a: SettingsMap["analytics"]): SettingsMap["analytics"] {
  return { ...a, metaCapiToken: null, tiktokEventsToken: null };
}
