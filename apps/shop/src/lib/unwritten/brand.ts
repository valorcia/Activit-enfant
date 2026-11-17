import "server-only";
import { notFound } from "next/navigation";
import type { Site } from "@prisma/client";
import { getRequestSite, getSiteById, siteUrl, type SiteWithAudience } from "@/lib/sites";
import { signPayload } from "@/lib/tokens";
import { isLocale, SUPPORTED_LOCALES, UNWRITTEN_STOREFRONT, type Locale } from "./constants";
import { readUnwrittenConfig } from "./config";
import { toUrlToken } from "./tokens";
import { href, type RouteKey } from "./i18n/routing";

/** Marque de la requête courante (en-tête posé par le proxy) si sa vitrine est UNWRITTEN. */
export async function getRequestBrand(): Promise<SiteWithAudience | null> {
  const site = await getRequestSite();
  return site.storefront === UNWRITTEN_STOREFRONT && site.status !== "ARCHIVED" ? site : null;
}

/** Marque et langue d'une page `/u/[locale]/…` (404 si la langue est fermée ou inconnue). */
export async function brandFromParams(params: Promise<{ locale: string }>): Promise<{ site: SiteWithAudience; locale: Locale }> {
  const { locale } = await params;
  const site = await getRequestBrand();
  if (!site || !isLocale(locale) || !openLocales(site).includes(locale)) notFound();
  return { site, locale };
}

export function openLocales(site: Pick<Site, "locales">): Locale[] {
  return SUPPORTED_LOCALES.filter((l) => site.locales.includes(l));
}

export function brandCurrency(site: Pick<Site, "currencies">): string {
  return (site.currencies[0] ?? "EUR").toUpperCase();
}

export function brandConfig(site: Pick<Site, "settings">) {
  return readUnwrittenConfig(site.settings);
}

/**
 * URL absolue d'une page de la marque. Une marque sans domaine (TEST) est servie par
 * l'aperçu : `?site=<slug>` est ajouté pour que le lien d'un e-mail ouvre bien la vitrine.
 */
export function brandUrl(site: Pick<Site, "slug" | "primaryDomain" | "domains">, path: string): string {
  const base = siteUrl(site);
  const preview = !site.primaryDomain && !site.domains.length;
  return `${base}${path}${preview ? `${path.includes("?") ? "&" : "?"}site=${encodeURIComponent(site.slug)}` : ""}`;
}

export function brandHref(site: Pick<Site, "slug" | "primaryDomain" | "domains">, locale: Locale, ...parts: Array<RouteKey | string>): string {
  return brandUrl(site, href(locale, ...parts));
}

/** Lien privé de suivi d'une commande (même signature que « Mes commandes » de la boutique). */
export function orderTrackToken(orderId: string, validitySeconds = 60 * 60 * 24 * 365): string {
  return toUrlToken(signPayload(`order:${orderId}`, Math.floor(Date.now() / 1000) + validitySeconds));
}

export async function brandForEmail(siteId: string) {
  const site = await getSiteById(siteId);
  const config = readUnwrittenConfig(site.settings);
  return { site, config, brand: { name: site.name, url: brandUrl(site, "/"), contactEmail: config.contactEmail } };
}
