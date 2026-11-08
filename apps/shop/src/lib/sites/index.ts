import "server-only";
import { unstable_cache, revalidateTag } from "next/cache";
import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import type { Site, Audience } from "@prisma/client";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { ADMIN_SITE_COOKIE, DEFAULT_SITE_ID, DEFAULT_SITE_SLUG, SITE_HEADER, SITES_TAG } from "./constants";
import { siteBaseUrl } from "./host";

export type SiteWithAudience = Site & { audience: Audience };

/** Repli si la base est injoignable : l'univers par défaut, minimal. */
function fallbackSite(): SiteWithAudience {
  const now = new Date(0);
  return {
    id: DEFAULT_SITE_ID, slug: DEFAULT_SITE_SLUG, name: "La Malle à Jeux", audienceId: "aud-familles-enfants", preset: "kit-enfants",
    status: "ACTIVE", domains: [], primaryDomain: null, isDefault: true, settings: {}, createdAt: now, updatedAt: now,
    audience: { id: "aud-familles-enfants", slug: "familles-enfants", name: "Familles & enfants", description: null, color: null, createdAt: now },
  };
}

async function loadSites(): Promise<SiteWithAudience[]> {
  try {
    return await prisma.site.findMany({ include: { audience: true }, orderBy: [{ isDefault: "desc" }, { name: "asc" }] });
  } catch (e) {
    console.error("[sites] base injoignable, univers par défaut utilisé", e instanceof Error ? e.message : e);
    return [fallbackSite()];
  }
}

/** Tous les univers (cache 60 s, invalidé par le tag « sites »). */
export const getSites = unstable_cache(loadSites, ["sites"], { tags: [SITES_TAG], revalidate: 60 });

export function revalidateSites() {
  revalidateTag(SITES_TAG, "max");
}

export async function getDefaultSite(): Promise<SiteWithAudience> {
  const sites = await getSites();
  return sites.find((s) => s.isDefault) ?? sites.find((s) => s.status === "ACTIVE") ?? sites[0] ?? fallbackSite();
}

export async function getSiteBySlug(slug: string | null | undefined): Promise<SiteWithAudience | null> {
  if (!slug) return null;
  const sites = await getSites();
  return sites.find((s) => s.slug === slug) ?? null;
}

export async function getSiteById(id: string | null | undefined): Promise<SiteWithAudience> {
  const sites = await getSites();
  return (id && sites.find((s) => s.id === id)) || (await getDefaultSite());
}

/** Univers d'une route publique (/s/[site]/…) : null si inconnu ou archivé. */
export async function getPublicSite(slug: string): Promise<SiteWithAudience | null> {
  const site = await getSiteBySlug(decodeURIComponent(slug));
  return site && site.status !== "ARCHIVED" ? site : null;
}

/** Univers de la requête courante (en-tête posé par le proxy), pour les actions et routes API. */
export async function getRequestSite(): Promise<SiteWithAudience> {
  let slug: string | null = null;
  try {
    slug = (await headers()).get(SITE_HEADER);
  } catch {
    slug = null;
  }
  return (await getSiteBySlug(slug)) ?? (await getDefaultSite());
}

/** URL publique (sans slash final) d'un univers. */
export function siteUrl(site: Pick<Site, "primaryDomain" | "domains">): string {
  return siteBaseUrl(site, env.appUrl);
}

export function siteAbsoluteUrl(site: Pick<Site, "primaryDomain" | "domains">, path: string): string {
  return path.startsWith("http") ? path : `${siteUrl(site)}${path.startsWith("/") ? "" : "/"}${path}`;
}

/** Univers sélectionné dans l'admin (cookie) : null = « Tous les univers ». */
export async function getAdminSite(): Promise<SiteWithAudience | null> {
  const value = (await cookies()).get(ADMIN_SITE_COOKIE)?.value;
  if (!value || value === "all") return null;
  return getSiteBySlug(value);
}

/** Filtre Prisma { siteId } pour l'univers sélectionné dans l'admin (vide = tous). */
export async function adminSiteWhere(): Promise<{ siteId?: string }> {
  const site = await getAdminSite();
  return site ? { siteId: site.id } : {};
}

/** Univers à présélectionner à la création dans l'admin. */
export async function adminDefaultSiteId(): Promise<string> {
  return (await getAdminSite())?.id ?? (await getDefaultSite()).id;
}

/** Univers d'une page publique à partir de ses paramètres de route (404 si inconnu). */
export async function siteFromParams(params: Promise<{ site: string }> | { site: string }): Promise<SiteWithAudience> {
  const site = await getPublicSite((await params).site);
  if (!site) notFound();
  return site;
}
