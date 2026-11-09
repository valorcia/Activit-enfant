"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { assertPermission } from "@/lib/auth/session";
import { getSetting, saveSetting, SITE_SCOPED_KEYS } from "@/lib/settings";
import { adminDefaultSiteId, getAdminSite } from "@/lib/sites";
import { settingsSchemas, type SettingsKey } from "@/lib/schemas/settings";

const APPEARANCE_KEYS: SettingsKey[] = ["brand", "theme", "homepage", "navigation", "conversion"];

export type SettingsResult = { ok: true } | { ok: false; error: string; fields?: Record<string, string> };

export async function saveSettingAction(key: SettingsKey, value: unknown): Promise<SettingsResult> {
  try {
    if (!(key in settingsSchemas)) return { ok: false, error: "Clé inconnue" };
    const user = await assertPermission(APPEARANCE_KEYS.includes(key) ? "appearance:write" : key === "etsy" ? "marketing:write" : "settings:write");
    const parsed = settingsSchemas[key].safeParse(value);
    if (!parsed.success) {
      const fields: Record<string, string> = {};
      for (const i of (parsed.error as z.ZodError).issues) fields[i.path.join(".")] = i.message;
      return { ok: false, error: "Paramètres invalides : " + Object.entries(fields).map(([k, v]) => `${k} (${v})`).join(", "), fields };
    }
    // Cible : univers sélectionné dans l'admin ; « Tous » = univers par défaut pour l'identité, réglages communs pour le commerce
    const site = await getAdminSite();
    const siteId = site?.id ?? (SITE_SCOPED_KEYS.includes(key) ? await adminDefaultSiteId() : null);
    let data: unknown = parsed.data;
    if (key === "analytics") {
      // Les jetons serveur ne transitent plus par le formulaire : on conserve ceux déjà enregistrés
      const current = await getSetting("analytics", siteId);
      const incoming = parsed.data as typeof current;
      data = { ...incoming, metaCapiToken: incoming.metaCapiToken ?? current.metaCapiToken, tiktokEventsToken: incoming.tiktokEventsToken ?? current.tiktokEventsToken };
    }
    await saveSetting(key, data, siteId);
    await audit({ userId: user.id, action: "settings.update", entity: "siteSetting", entityId: key, data: { siteId } });
    revalidatePath("/", "layout");
    revalidatePath("/admin/apparence");
    revalidatePath("/admin/parametres");
    if (key === "etsy") revalidatePath("/admin/marketing/etsy");
    return { ok: true };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : "Erreur" }; }
}
