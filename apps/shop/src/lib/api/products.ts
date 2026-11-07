import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

/** Projection d'un produit pour l'API (jamais les clés de stockage privées). */
export const apiProductSelect = {
  id: true, slug: true, name: true, tagline: true, shortDescription: true, longDescription: true, story: true, template: true,
  category: { select: { id: true, slug: true, name: true } }, collections: { select: { collection: { select: { id: true, slug: true, name: true } } } },
  universe: true, tags: true, badges: true, heroBadges: true, ageMin: true, ageMax: true, playersMin: true, playersMax: true, durationMinutes: true, difficulty: true, pageCount: true, fileFormat: true, materials: true,
  priceCents: true, salePriceCents: true, saleStartsAt: true, saleEndsAt: true, currency: true, taxRateBp: true,
  kitContents: true, faq: true, sellingPoints: true, seoTitle: true, seoDescription: true, keywords: true, ogImageUrl: true, promoText: true,
  status: true, publishedAt: true, scheduledAt: true, isFeatured: true, needsReview: true, source: true, createdAt: true, updatedAt: true,
  images: { select: { id: true, url: true, role: true, alt: true, position: true }, orderBy: { position: "asc" } },
  files: { select: { id: true, name: true, kind: true, mime: true, sizeBytes: true, position: true }, orderBy: { position: "asc" } },
  recommendations: { select: { recommendedId: true } },
} satisfies Prisma.ProductSelect;

export type ApiProduct = Prisma.ProductGetPayload<{ select: typeof apiProductSelect }>;

export function serializeProduct(p: ApiProduct, appUrl: string) {
  return {
    ...p,
    collections: p.collections.map((c) => c.collection),
    recommendedProductIds: p.recommendations.map((r) => r.recommendedId),
    recommendations: undefined,
    publicUrl: p.status === "PUBLISHED" ? `${appUrl}/aventures/${p.slug}` : null,
    editUrl: `${appUrl}/admin/produits/${p.id}`,
  };
}

/** Transforme un produit existant en entrée de formulaire (pour les mises à jour partielles). */
export async function productToInput(id: string) {
  const p = await prisma.product.findUnique({ where: { id }, include: { collections: true, recommendations: true } });
  if (!p) return null;
  return {
    name: p.name, slug: p.slug, tagline: p.tagline, shortDescription: p.shortDescription, longDescription: p.longDescription, story: p.story, template: p.template,
    categoryId: p.categoryId, collectionIds: p.collections.map((c) => c.collectionId), universe: p.universe, tags: p.tags, badges: p.badges, heroBadges: p.heroBadges,
    ageMin: p.ageMin ?? undefined, ageMax: p.ageMax ?? undefined, playersMin: p.playersMin ?? undefined, playersMax: p.playersMax ?? undefined, durationMinutes: p.durationMinutes ?? undefined, difficulty: p.difficulty ?? undefined, pageCount: p.pageCount ?? undefined,
    fileFormat: p.fileFormat, materials: p.materials, priceCents: p.priceCents, salePriceCents: p.salePriceCents ?? undefined, saleStartsAt: p.saleStartsAt ?? undefined, saleEndsAt: p.saleEndsAt ?? undefined, currency: p.currency, taxRateBp: p.taxRateBp,
    kitContents: (p.kitContents as unknown[]) ?? [], faq: (p.faq as unknown[]) ?? [], sellingPoints: (p.sellingPoints as unknown[]) ?? [],
    seoTitle: p.seoTitle, seoDescription: p.seoDescription, keywords: p.keywords, ogImageUrl: p.ogImageUrl, promoText: p.promoText, recommendedProductIds: p.recommendations.map((r) => r.recommendedId),
    status: p.status, scheduledAt: p.scheduledAt ?? undefined, isFeatured: p.isFeatured,
  };
}

export async function resolveCategoryAndCollections(input: { categorySlug?: string; categoryId?: string | null; collectionSlugs?: string[]; collectionIds?: string[] }) {
  let categoryId = input.categoryId ?? null;
  if (input.categorySlug) {
    const c = await prisma.category.findUnique({ where: { slug: input.categorySlug }, select: { id: true } });
    if (!c) throw new Error(`Catégorie inconnue : ${input.categorySlug}`);
    categoryId = c.id;
  }
  const collectionIds = [...(input.collectionIds ?? [])];
  if (input.collectionSlugs?.length) {
    const cols = await prisma.collection.findMany({ where: { slug: { in: input.collectionSlugs } }, select: { id: true, slug: true } });
    const missing = input.collectionSlugs.filter((s) => !cols.some((c) => c.slug === s));
    if (missing.length) throw new Error(`Collections inconnues : ${missing.join(", ")}`);
    collectionIds.push(...cols.map((c) => c.id));
  }
  return { categoryId, collectionIds: [...new Set(collectionIds)] };
}
