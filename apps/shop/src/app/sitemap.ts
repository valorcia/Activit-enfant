import type { MetadataRoute } from "next";
import { getRequestSite, siteUrl } from "@/lib/sites";
import { siteSitemap } from "@/lib/sites/sitemap";

// Dépend du nom d'hôte (un sitemap par univers / domaine)
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = await getRequestSite();
  return siteSitemap(site.id, siteUrl(site));
}
