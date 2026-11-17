import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";
import { SUPPORTED_LOCALES } from "./constants";
import { href, hreflangAlternates, ROUTE_SEGMENTS } from "./i18n/routing";

/** Sitemap d'une marque UNWRITTEN : une entrée par langue ouverte, avec alternatives hreflang. */
export async function unwrittenSitemap(site: { id: string; locales: string[]; defaultLocale: string }, base: string): Promise<MetadataRoute.Sitemap> {
  const open = SUPPORTED_LOCALES.filter((l) => site.locales.includes(l));
  const [products, collections] = await Promise.all([
    prisma.product.findMany({ where: { siteId: site.id, status: "PUBLISHED", personalization: { isNot: null } }, select: { slug: true, updatedAt: true } }),
    prisma.collection.findMany({ where: { siteId: site.id, isVisible: true }, select: { slug: true, updatedAt: true } }),
  ]);
  const now = new Date();
  const entry = (parts: string[], lastModified: Date, priority: number): MetadataRoute.Sitemap =>
    open.map((l) => ({ url: `${base}${href(l, ...parts)}`, lastModified, priority, alternates: { languages: hreflangAlternates(base, open, site.defaultLocale, ...parts) } }));
  return [
    ...entry([], now, 1),
    ...collections.flatMap((c) => entry(["collections", c.slug], c.updatedAt, 0.8)),
    ...products.flatMap((p) => entry(["books", p.slug], p.updatedAt, 0.9)),
  ];
}

/** Chemins privés exclus des robots (questionnaire, suivi, cadeau, reprise), dans chaque langue. */
export function unwrittenPrivatePaths(): string[] {
  const keys = ["create", "order", "gift", "resume"] as const;
  return SUPPORTED_LOCALES.flatMap((l) => keys.map((k) => `/${l}/${ROUTE_SEGMENTS[k][l]}`));
}
