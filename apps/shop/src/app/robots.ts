import type { MetadataRoute } from "next";
import { getSetting } from "@/lib/settings";
import { getRequestSite, siteUrl } from "@/lib/sites";

export const dynamic = "force-dynamic";

/** robots.txt par univers : un univers en test ou non indexable n'est jamais exploré. */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const site = await getRequestSite();
  const seo = await getSetting("seo", site);
  if (!seo.robotsIndex || site.status !== "ACTIVE") return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api", "/commande", "/mes-achats", "/panier"] },
    sitemap: `${siteUrl(site)}/sitemap.xml`,
  };
}
