"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { assertPermission } from "@/lib/auth/session";
import { getSetting, saveSetting } from "@/lib/settings";
import { settingsSchemas, type SettingsKey } from "@/lib/schemas/settings";

const APPEARANCE_KEYS: SettingsKey[] = ["brand", "theme", "homepage", "navigation", "conversion"];

export type SettingsResult = { ok: true } | { ok: false; error: string; fields?: Record<string, string> };

export async function saveSettingAction(key: SettingsKey, value: unknown): Promise<SettingsResult> {
  try {
    if (!(key in settingsSchemas)) return { ok: false, error: "Clé inconnue" };
    const user = await assertPermission(APPEARANCE_KEYS.includes(key) ? "appearance:write" : "settings:write");
    const parsed = settingsSchemas[key].safeParse(value);
    if (!parsed.success) {
      const fields: Record<string, string> = {};
      for (const i of (parsed.error as z.ZodError).issues) fields[i.path.join(".")] = i.message;
      return { ok: false, error: "Paramètres invalides : " + Object.entries(fields).map(([k, v]) => `${k} (${v})`).join(", "), fields };
    }
    let data: unknown = parsed.data;
    if (key === "analytics") {
      // Les jetons serveur ne transitent plus par le formulaire : on conserve ceux déjà enregistrés
      const current = await getSetting("analytics");
      const incoming = parsed.data as typeof current;
      data = { ...incoming, metaCapiToken: incoming.metaCapiToken ?? current.metaCapiToken, tiktokEventsToken: incoming.tiktokEventsToken ?? current.tiktokEventsToken };
    }
    await saveSetting(key, data);
    await audit({ userId: user.id, action: "settings.update", entity: "siteSetting", entityId: key });
    revalidatePath("/", "layout");
    revalidatePath("/admin/apparence");
    revalidatePath("/admin/parametres");
    return { ok: true };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : "Erreur" }; }
}
