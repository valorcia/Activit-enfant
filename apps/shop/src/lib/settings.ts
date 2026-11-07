import { unstable_cache, revalidateTag } from "next/cache";
import { prisma } from "@/lib/db";
import { settingsSchemas, type SettingsKey, type SettingsMap } from "@/lib/schemas/settings";

export const SETTINGS_TAG = "site-settings";

/** Valeurs par défaut (issues des schémas Zod). */
export function defaultSettings<K extends SettingsKey>(key: K): SettingsMap[K] {
  return settingsSchemas[key].parse({}) as SettingsMap[K];
}

async function loadAllSettings(): Promise<SettingsMap> {
  const rows = await prisma.siteSetting.findMany();
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  const result = {} as SettingsMap;
  for (const key of Object.keys(settingsSchemas) as SettingsKey[]) {
    const raw = byKey.get(key);
    const parsed = settingsSchemas[key].safeParse(raw ?? {});
    (result as Record<string, unknown>)[key] = parsed.success ? parsed.data : defaultSettings(key);
  }
  return result;
}

/** Paramètres du site, mis en cache et invalidés à chaque modification dans l'admin. */
export const getSettings = unstable_cache(loadAllSettings, ["site-settings"], { tags: [SETTINGS_TAG], revalidate: 300 });

export async function getSetting<K extends SettingsKey>(key: K): Promise<SettingsMap[K]> {
  const all = await getSettings();
  return all[key];
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
