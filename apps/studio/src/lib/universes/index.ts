/**
 * Accès serveur aux univers de la boutique (avec cache court) et résolution du
 * préréglage d'un livre : univers ciblé → préréglage de l'univers, sinon préréglage
 * par défaut du type d'e-book.
 */
import { getShopSettings, getStudioSettings } from "../settings";
import { ShopApiError, ShopClient } from "../shop/client";
import { kitType } from "../kits/types";
import { charterFor, preset, type PresetDef, type UniversePreset } from "./presets";
import { DEFAULT_SITE_SLUG, FALLBACK_SITES, parseSites, siteBySlug, type Site, type SitesResult } from "./sites";

let cache: { at: number; value: SitesResult } | null = null;
const TTL_MS = 60_000;

export function clearSitesCache() {
  cache = null;
}

/** Univers de la boutique (cache 60 s). Repli sur « La Malle à Jeux » si la boutique est absente ou ne répond pas 2xx sur /sites. */
export async function loadSites(opts: { fresh?: boolean } = {}): Promise<SitesResult> {
  if (!opts.fresh && cache && Date.now() - cache.at < TTL_MS) return cache.value;
  const value = await fetchSites();
  cache = { at: Date.now(), value };
  return value;
}

async function fetchSites(): Promise<SitesResult> {
  const s = await getShopSettings();
  if (!s.shopApiUrl || !s.shopApiKey) return { sites: FALLBACK_SITES, source: "fallback", error: "Boutique non configurée" };
  try {
    const client = new ShopClient({ baseUrl: s.shopApiUrl, apiKey: s.shopApiKey });
    const sites = parseSites(await client.sites());
    if (!sites.length) return { sites: FALLBACK_SITES, source: "fallback", error: "Aucun univers déclaré dans la boutique" };
    return { sites, source: "live" };
  } catch (e) {
    const notReady = e instanceof ShopApiError && e.status === 404;
    return { sites: FALLBACK_SITES, source: "fallback", error: notReady ? "La boutique ne gère pas encore les univers (API /sites absente)" : e instanceof Error ? e.message : String(e) };
  }
}

/** Univers utilisables pour une nouvelle production (actifs ou en test). */
export async function activeSites(): Promise<Site[]> {
  const { sites } = await loadSites();
  const usable = sites.filter((s) => s.status !== "ARCHIVED");
  return usable.length ? usable : FALLBACK_SITES;
}

export async function defaultSiteSlug(): Promise<string> {
  const studio = await getStudioSettings();
  const sites = await activeSites();
  return siteBySlug(sites, studio.defaultSiteSlug)?.slug ?? sites[0]?.slug ?? DEFAULT_SITE_SLUG;
}

/** Préréglage effectif d'un livre (univers ciblé, sinon premier préréglage du type). */
export async function presetForBook(book: { siteSlug?: string | null; kitType: string }): Promise<PresetDef> {
  if (book.siteSlug) {
    const { sites } = await loadSites();
    const site = siteBySlug(sites, book.siteSlug);
    if (site) return preset(site.preset);
  }
  return preset(kitType(book.kitType).presets[0]);
}

/** Charte d'illustration d'un livre (préréglage + surcharges des paramètres). */
export async function charterForBook(book: { siteSlug?: string | null; kitType: string }): Promise<{ charter: string; preset: PresetDef }> {
  const [studio, p] = await Promise.all([getStudioSettings(), presetForBook(book)]);
  return { charter: charterFor(p.key as UniversePreset, studio.illustrationCharters, studio.illustrationCharter), preset: p };
}

export type { Site, SitesResult };
