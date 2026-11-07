import type { MetadataRoute } from "next";
import { env } from "@/lib/env";
import { getSetting } from "@/lib/settings";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const seo = await getSetting("seo");
  if (!seo.robotsIndex) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api", "/commande", "/mes-achats", "/panier"] },
    sitemap: `${env.appUrl}/sitemap.xml`,
  };
}
