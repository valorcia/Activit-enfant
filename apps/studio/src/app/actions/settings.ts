"use server";
import { revalidatePath } from "next/cache";
import { getStudioSettings, saveAiSettings, saveStudioSettings } from "@/lib/settings";
import { UNIVERSE_PRESETS } from "@/lib/universes/presets";
import { clearSitesCache, loadSites } from "@/lib/universes";
import type { SitesResult } from "@/lib/universes/sites";

export async function saveSettingsAction(input: unknown) {
  await saveAiSettings(input);
  revalidatePath("/settings");
}

/** Enregistre les champs fournis des paramètres du studio (les autres sont conservés). */
export async function saveStudioSettingsAction(input: unknown) {
  const current = await getStudioSettings();
  await saveStudioSettings({ ...current, ...(input && typeof input === "object" ? input : {}) });
  revalidatePath("/", "layout");
}

/** Univers : univers par défaut et chartes d'illustration par préréglage. */
export async function saveUniverseSettingsAction(input: { defaultSiteSlug: string | null; illustrationCharters: Record<string, string> }) {
  const current = await getStudioSettings();
  const charters = Object.fromEntries(Object.entries(input.illustrationCharters ?? {}).filter(([k, v]) => (UNIVERSE_PRESETS as readonly string[]).includes(k) && typeof v === "string" && v.trim()));
  await saveStudioSettings({ ...current, defaultSiteSlug: input.defaultSiteSlug || null, illustrationCharters: charters, illustrationCharter: charters["kit-enfants"] ?? current.illustrationCharter });
  revalidatePath("/", "layout");
}

/** « Actualiser » : relit la liste des univers depuis la boutique (sans cache). */
export async function refreshSitesAction(): Promise<SitesResult> {
  clearSitesCache();
  const r = await loadSites({ fresh: true });
  revalidatePath("/", "layout");
  return r;
}
