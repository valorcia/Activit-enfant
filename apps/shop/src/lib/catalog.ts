import "server-only";
import { unstable_cache, revalidateTag } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { effectivePrice } from "@/lib/pricing";
import type { FaqItem, KitItem, SellingPoint } from "@/lib/schemas/product";

export const CATALOG_TAG = "catalog";
export const productTag = (slug: string) => `product:${slug}`;

export function revalidateCatalog(slugs: string[] = []) {
  revalidateTag(CATALOG_TAG, "max");
  for (const s of slugs) revalidateTag(productTag(s), "max");
}

/** Sélection « carte produit » (listes, grilles, recommandations). */
export const productCardSelect = {
  id: true, slug: true, name: true, tagline: true, shortDescription: true, template: true,
  ageMin: true, ageMax: true, durationMinutes: true, playersMin: true, playersMax: true,
  priceCents: true, salePriceCents: true, saleStartsAt: true, saleEndsAt: true, currency: true,
  badges: true, universe: true, salesCount: true, ratingAvg: true, reviewCount: true, publishedAt: true,
  category: { select: { slug: true, name: true, color: true } },
  images: { where: { role: "MAIN" }, take: 1, select: { url: true, alt: true, width: true, height: true } },
} satisfies Prisma.ProductSelect;

export type ProductCardData = Prisma.ProductGetPayload<{ select: typeof productCardSelect }>;

export function cardPrice(p: ProductCardData) {
  return effectivePrice(p);
}

const publishedWhere: Prisma.ProductWhereInput = { status: "PUBLISHED" };

export const getCategories = unstable_cache(
  async (siteId: string) =>
    prisma.category.findMany({
      where: { siteId, isVisible: true },
      orderBy: { position: "asc" },
      include: { _count: { select: { products: { where: publishedWhere } } } },
    }),
  ["categories"],
  { tags: [CATALOG_TAG], revalidate: 600 },
);

export const getCollections = unstable_cache(
  async (siteId: string) => prisma.collection.findMany({ where: { siteId, isVisible: true }, orderBy: { position: "asc" } }),
  ["collections"],
  { tags: [CATALOG_TAG], revalidate: 600 },
);

export const getBestsellers = unstable_cache(
  async (siteId: string, limit = 8) =>
    prisma.product.findMany({ where: { ...publishedWhere, siteId }, orderBy: [{ salesCount: "desc" }, { publishedAt: "desc" }], take: limit, select: productCardSelect }),
  ["bestsellers"],
  { tags: [CATALOG_TAG], revalidate: 300 },
);

export const getNewProducts = unstable_cache(
  async (siteId: string, limit = 8) =>
    prisma.product.findMany({ where: { ...publishedWhere, siteId }, orderBy: { publishedAt: "desc" }, take: limit, select: productCardSelect }),
  ["new-products"],
  { tags: [CATALOG_TAG], revalidate: 300 },
);

export const getFeaturedProducts = unstable_cache(
  async (siteId: string, ids: string[], limit = 8) => {
    if (ids.length) {
      const rows = await prisma.product.findMany({ where: { ...publishedWhere, siteId, id: { in: ids } }, select: productCardSelect });
      return ids.map((id) => rows.find((r) => r.id === id)).filter(Boolean) as ProductCardData[];
    }
    return prisma.product.findMany({ where: { ...publishedWhere, siteId, isFeatured: true }, orderBy: { salesCount: "desc" }, take: limit, select: productCardSelect });
  },
  ["featured-products"],
  { tags: [CATALOG_TAG], revalidate: 300 },
);

export const getPublishedBundles = unstable_cache(
  async (siteId: string, limit = 6) =>
    prisma.bundle.findMany({
      where: { siteId, status: "PUBLISHED" },
      orderBy: [{ isFeatured: "desc" }, { salesCount: "desc" }],
      take: limit,
      include: { items: { orderBy: { position: "asc" }, include: { product: { select: productCardSelect } } } },
    }),
  ["bundles"],
  { tags: [CATALOG_TAG], revalidate: 300 },
);

export type BundleWithItems = Awaited<ReturnType<typeof getPublishedBundles>>[number];

export function bundleSavings(b: BundleWithItems) {
  const full = b.items.reduce((s, it) => s + effectivePrice(it.product).priceCents, 0);
  return { fullCents: full, savingsCents: Math.max(0, full - b.priceCents), percent: full > 0 ? Math.round((1 - b.priceCents / full) * 100) : 0 };
}

export const getBundleBySlug = unstable_cache(
  async (siteId: string, slug: string) =>
    prisma.bundle.findFirst({
      where: { siteId, slug, status: "PUBLISHED" },
      include: { items: { orderBy: { position: "asc" }, include: { product: { select: productCardSelect } } } },
    }),
  ["bundle-by-slug"],
  { tags: [CATALOG_TAG], revalidate: 300 },
);

export interface CatalogQuery {
  siteId: string;
  q?: string;
  category?: string;      // slug
  collection?: string;    // slug
  age?: string;           // "3-5" | "5-8" | "8-10"
  theme?: string;         // universe
  priceMax?: number;      // euros
  duration?: string;      // "court" (<30) | "moyen" (30-60) | "long" (>60)
  sort?: "nouveautes" | "popularite" | "prix-asc" | "prix-desc";
  page?: number;
  perPage?: number;
}

export const AGE_BUCKETS: Record<string, { min: number; max: number; label: string }> = {
  "3-5": { min: 3, max: 5, label: "3–5 ans" },
  "5-8": { min: 5, max: 8, label: "5–8 ans" },
  "8-10": { min: 8, max: 10, label: "8–10 ans" },
};

export const DURATION_BUCKETS: Record<string, { min?: number; max?: number; label: string }> = {
  court: { max: 30, label: "Moins de 30 min" },
  moyen: { min: 30, max: 60, label: "30 min à 1 h" },
  long: { min: 60, label: "Plus d'1 h" },
};

export function buildCatalogWhere(q: CatalogQuery): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = { ...publishedWhere, siteId: q.siteId };
  if (q.q) {
    where.OR = [
      { name: { contains: q.q, mode: "insensitive" } },
      { tagline: { contains: q.q, mode: "insensitive" } },
      { shortDescription: { contains: q.q, mode: "insensitive" } },
      { universe: { contains: q.q, mode: "insensitive" } },
      { tags: { has: q.q.toLowerCase() } },
    ];
  }
  if (q.category) where.category = { slug: q.category };
  if (q.collection) where.collections = { some: { collection: { slug: q.collection } } };
  if (q.age && AGE_BUCKETS[q.age]) {
    const b = AGE_BUCKETS[q.age];
    where.AND = [
      { OR: [{ ageMin: null }, { ageMin: { lte: b.max } }] },
      { OR: [{ ageMax: null }, { ageMax: { gte: b.min } }] },
    ];
  }
  if (q.theme) where.universe = { equals: q.theme, mode: "insensitive" };
  if (q.priceMax) where.priceCents = { lte: Math.round(q.priceMax * 100) };
  if (q.duration && DURATION_BUCKETS[q.duration]) {
    const d = DURATION_BUCKETS[q.duration];
    where.durationMinutes = { ...(d.min != null ? { gte: d.min } : {}), ...(d.max != null ? { lt: d.max } : {}) };
  }
  return where;
}

export function buildCatalogOrder(sort?: CatalogQuery["sort"]): Prisma.ProductOrderByWithRelationInput[] {
  switch (sort) {
    case "prix-asc": return [{ priceCents: "asc" }];
    case "prix-desc": return [{ priceCents: "desc" }];
    case "popularite": return [{ salesCount: "desc" }, { publishedAt: "desc" }];
    default: return [{ publishedAt: "desc" }];
  }
}

export async function searchCatalog(q: CatalogQuery) {
  const perPage = Math.min(48, Math.max(6, q.perPage ?? 24));
  const page = Math.max(1, q.page ?? 1);
  const where = buildCatalogWhere(q);
  const [items, total] = await Promise.all([
    prisma.product.findMany({ where, orderBy: buildCatalogOrder(q.sort), skip: (page - 1) * perPage, take: perPage, select: productCardSelect }),
    prisma.product.count({ where }),
  ]);
  return { items, total, page, perPage, pages: Math.max(1, Math.ceil(total / perPage)) };
}

export const getUniverses = unstable_cache(
  async (siteId: string) => {
    const rows = await prisma.product.findMany({ where: { ...publishedWhere, siteId, universe: { not: null } }, select: { universe: true }, distinct: ["universe"] });
    return rows.map((r) => r.universe as string).filter(Boolean).sort((a, b) => a.localeCompare(b, "fr"));
  },
  ["universes"],
  { tags: [CATALOG_TAG], revalidate: 600 },
);

/** Fiche produit complète (landing page). Les fichiers payants ne sont jamais inclus. */
export const productPageInclude = {
  category: true,
  site: { select: { id: true, slug: true, name: true, primaryDomain: true, domains: true } },
  images: { orderBy: { position: "asc" } },
  files: { select: { id: true, name: true, kind: true, sizeBytes: true, position: true, description: true }, orderBy: { position: "asc" } },
  collections: { include: { collection: true } },
  recommendations: { orderBy: { position: "asc" }, include: { recommended: { select: productCardSelect } } },
  reviews: { where: { status: "APPROVED" }, orderBy: { createdAt: "desc" }, take: 12, select: { id: true, authorName: true, rating: true, title: true, body: true, createdAt: true, isVerifiedPurchase: true } },
} satisfies Prisma.ProductInclude;

export type ProductPageData = Prisma.ProductGetPayload<{ include: typeof productPageInclude }>;

export const getProductBySlug = (siteId: string, slug: string) =>
  unstable_cache(
    async () => prisma.product.findFirst({ where: { slug, siteId, status: "PUBLISHED" }, include: productPageInclude }),
    ["product", siteId, slug],
    { tags: [CATALOG_TAG, productTag(slug)], revalidate: 300 },
  )();

/** Produits similaires : recommandations manuelles, puis même catégorie / univers. */
export async function getRelatedProducts(product: ProductPageData, limit = 4): Promise<ProductCardData[]> {
  const manual = product.recommendations.map((r) => r.recommended);
  if (manual.length >= limit) return manual.slice(0, limit);
  const exclude = [product.id, ...manual.map((m) => m.id)];
  const auto = await prisma.product.findMany({
    where: {
      ...publishedWhere,
      siteId: product.siteId,
      id: { notIn: exclude },
      OR: [{ categoryId: product.categoryId ?? undefined }, { universe: product.universe ?? undefined }],
    },
    orderBy: { salesCount: "desc" },
    take: limit - manual.length,
    select: productCardSelect,
  });
  return [...manual, ...auto];
}

export function parseKitContents(v: unknown): KitItem[] { return Array.isArray(v) ? (v as KitItem[]) : []; }
export function parseFaq(v: unknown): FaqItem[] { return Array.isArray(v) ? (v as FaqItem[]) : []; }
export function parseSellingPoints(v: unknown): SellingPoint[] { return Array.isArray(v) ? (v as SellingPoint[]) : []; }

export const getCategoryBySlug = (siteId: string, slug: string) =>
  unstable_cache(async () => prisma.category.findFirst({ where: { siteId, slug, isVisible: true } }), ["category", siteId, slug], { tags: [CATALOG_TAG], revalidate: 600 })();

export const getCollectionBySlug = (siteId: string, slug: string) =>
  unstable_cache(async () => prisma.collection.findFirst({ where: { siteId, slug, isVisible: true } }), ["collection", siteId, slug], { tags: [CATALOG_TAG], revalidate: 600 })();

export const getApprovedReviews = unstable_cache(
  async (siteId: string, limit = 6) =>
    prisma.review.findMany({
      where: { status: "APPROVED", product: { siteId } },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { id: true, authorName: true, rating: true, title: true, body: true, createdAt: true, isVerifiedPurchase: true, product: { select: { name: true, slug: true } } },
    }),
  ["approved-reviews"],
  { tags: [CATALOG_TAG, "reviews"], revalidate: 300 },
);

export async function recordProductView(productId: string) {
  const day = new Date(new Date().toISOString().slice(0, 10));
  await Promise.all([
    prisma.product.update({ where: { id: productId }, data: { viewCount: { increment: 1 } } }),
    prisma.dailyStat.upsert({ where: { date: day }, create: { date: day, productViews: 1, pageViews: 1 }, update: { productViews: { increment: 1 }, pageViews: { increment: 1 } } }),
  ]).catch(() => undefined);
}
