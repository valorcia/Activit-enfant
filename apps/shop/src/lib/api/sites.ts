import type { PrismaClient } from "@prisma/client";
import { siteBaseUrl } from "@/lib/sites/host";

/** Univers exposés à l'API v1 (hors archivés), avec leurs catégories visibles. */
export async function listApiSites(db: PrismaClient, appUrl: string) {
  const sites = await db.site.findMany({
    where: { status: { not: "ARCHIVED" } },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    select: {
      id: true, slug: true, name: true, preset: true, status: true, primaryDomain: true, domains: true, isDefault: true,
      audience: { select: { slug: true, name: true } },
      categories: { where: { isVisible: true }, orderBy: { position: "asc" }, select: { slug: true, name: true } },
    },
  });
  return sites.map((s) => ({
    id: s.id,
    slug: s.slug,
    name: s.name,
    preset: s.preset,
    status: s.status,
    isDefault: s.isDefault,
    audience: s.audience,
    primaryDomain: s.primaryDomain ?? s.domains[0] ?? null,
    url: siteBaseUrl(s, appUrl),
    categories: s.categories,
  }));
}
