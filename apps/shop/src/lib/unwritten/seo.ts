import "server-only";
import type { Metadata } from "next";
import type { Site } from "@prisma/client";
import { siteUrl } from "@/lib/sites";
import type { Locale } from "./constants";
import { href, hreflangAlternates, type RouteKey } from "./i18n/routing";
import { openLocales } from "./brand";

/** URL canonique et alternatives hreflang (langues ouvertes de la marque + x-default). */
export function localizedAlternates(site: Pick<Site, "locales" | "defaultLocale" | "primaryDomain" | "domains">, locale: Locale, ...parts: Array<RouteKey | string>): Metadata["alternates"] {
  const base = siteUrl(site);
  return { canonical: `${base}${href(locale, ...parts)}`, languages: hreflangAlternates(base, openLocales(site), site.defaultLocale, ...parts) };
}

/** Pages privées (suivi, cadeau, reprise, questionnaire) : jamais indexées. */
export const PRIVATE_ROBOTS: Metadata["robots"] = { index: false, follow: false, nocache: true };
