import type { MetadataRoute } from "next";
import { getRequestSite, siteUrl } from "@/lib/sites";
import { siteSitemap } from "@/lib/sites/sitemap";
import { UNWRITTEN_STOREFRONT } from "@/lib/unwritten/constants";
import { unwrittenSitemap } from "@/lib/unwritten/sitemap";

// Dépend du nom d'hôte (un sitemap par univers / domaine)
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = await getRequestSite();
  // Vitrine UNWRITTEN : URLs localisées et hreflang (les autres univers sont inchangés)
  if (site.storefront === UNWRITTEN_STOREFRONT) return unwrittenSitemap(site, siteUrl(site));
  return siteSitemap(site.id, siteUrl(site));
}
