import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";

/** Entrées du sitemap d'un univers (URLs absolues sur son domaine). */
export async function siteSitemap(siteId: string, base: string): Promise<MetadataRoute.Sitemap> {
  const [products, categories, collections, bundles, posts, pages] = await Promise.all([
    prisma.product.findMany({ where: { siteId, status: "PUBLISHED" }, select: { slug: true, updatedAt: true }, orderBy: { publishedAt: "desc" } }),
    prisma.category.findMany({ where: { siteId, isVisible: true }, select: { slug: true, updatedAt: true } }),
    prisma.collection.findMany({ where: { siteId, isVisible: true }, select: { slug: true, updatedAt: true } }),
    prisma.bundle.findMany({ where: { siteId, status: "PUBLISHED" }, select: { slug: true, updatedAt: true } }),
    prisma.blogPost.findMany({ where: { siteId, status: "PUBLISHED" }, select: { slug: true, updatedAt: true } }),
    prisma.staticPage.findMany({ where: { siteId, status: "PUBLISHED" }, select: { slug: true, updatedAt: true } }),
  ]);
  const now = new Date();
  return [
    { url: base, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${base}/boutique`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    ...(bundles.length ? [{ url: `${base}/packs`, lastModified: now, changeFrequency: "weekly" as const, priority: 0.7 }] : []),
    ...(posts.length ? [{ url: `${base}/blog`, lastModified: now, changeFrequency: "weekly" as const, priority: 0.6 }] : []),
    ...categories.map((c) => ({ url: `${base}/categories/${c.slug}`, lastModified: c.updatedAt, changeFrequency: "weekly" as const, priority: 0.8 })),
    ...collections.map((c) => ({ url: `${base}/collections/${c.slug}`, lastModified: c.updatedAt, changeFrequency: "weekly" as const, priority: 0.7 })),
    ...products.map((p) => ({ url: `${base}/aventures/${p.slug}`, lastModified: p.updatedAt, changeFrequency: "weekly" as const, priority: 0.8 })),
    ...bundles.map((b) => ({ url: `${base}/packs/${b.slug}`, lastModified: b.updatedAt, changeFrequency: "weekly" as const, priority: 0.7 })),
    ...posts.map((p) => ({ url: `${base}/blog/${p.slug}`, lastModified: p.updatedAt, changeFrequency: "monthly" as const, priority: 0.5 })),
    ...pages.map((p) => ({ url: `${base}/pages/${p.slug}`, lastModified: p.updatedAt, changeFrequency: "yearly" as const, priority: 0.3 })),
  ];
}
