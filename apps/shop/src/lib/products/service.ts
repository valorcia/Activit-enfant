import "server-only";
import type { Prisma, Product } from "@prisma/client";
import { prisma } from "@/lib/db";
import { revalidateCatalog } from "@/lib/catalog";
import { audit } from "@/lib/audit";
import { emitMarketingEvent } from "@/lib/marketing/events";
import { productInputSchema, type ProductInput } from "@/lib/schemas/product";
import { slugify } from "@/lib/utils";

export interface Actor { userId?: string | null; actor?: string | null; source?: string }

/** Slug unique : ajoute un suffixe numérique si nécessaire. */
export async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  const root = slugify(base) || "produit";
  let slug = root;
  for (let i = 2; i < 500; i++) {
    const existing = await prisma.product.findUnique({ where: { slug }, select: { id: true } });
    if (!existing || existing.id === excludeId) return slug;
    slug = `${root}-${i}`;
  }
  return `${root}-${Date.now()}`;
}

function toData(input: ProductInput): Omit<Prisma.ProductUncheckedCreateInput, "slug" | "name" | "priceCents"> & { name: string; priceCents: number } {
  const publishedAt = input.status === "PUBLISHED" ? new Date() : undefined;
  return {
    name: input.name,
    tagline: input.tagline ?? null,
    shortDescription: input.shortDescription ?? null,
    longDescription: input.longDescription ?? null,
    story: input.story ?? null,
    template: input.template,
    categoryId: input.categoryId || null,
    universe: input.universe ?? null,
    tags: input.tags,
    badges: input.badges,
    heroBadges: input.heroBadges,
    ageMin: input.ageMin ?? null,
    ageMax: input.ageMax ?? null,
    playersMin: input.playersMin ?? null,
    playersMax: input.playersMax ?? null,
    durationMinutes: input.durationMinutes ?? null,
    difficulty: input.difficulty ?? null,
    pageCount: input.pageCount ?? null,
    fileFormat: input.fileFormat,
    materials: input.materials,
    priceCents: input.priceCents,
    salePriceCents: input.salePriceCents ?? null,
    saleStartsAt: input.saleStartsAt ?? null,
    saleEndsAt: input.saleEndsAt ?? null,
    currency: input.currency.toUpperCase(),
    taxRateBp: input.taxRateBp,
    kitContents: input.kitContents as unknown as Prisma.InputJsonValue,
    faq: input.faq as unknown as Prisma.InputJsonValue,
    sellingPoints: input.sellingPoints as unknown as Prisma.InputJsonValue,
    seoTitle: input.seoTitle ?? null,
    seoDescription: input.seoDescription ?? null,
    keywords: input.keywords,
    ogImageUrl: input.ogImageUrl ?? null,
    promoText: input.promoText ?? null,
    status: input.status,
    scheduledAt: input.status === "SCHEDULED" ? input.scheduledAt ?? null : null,
    publishedAt,
    archivedAt: input.status === "ARCHIVED" ? new Date() : null,
    isFeatured: input.isFeatured,
  };
}

async function syncRelations(productId: string, input: ProductInput, tx: Prisma.TransactionClient) {
  await tx.productCollection.deleteMany({ where: { productId } });
  if (input.collectionIds.length) {
    await tx.productCollection.createMany({ data: input.collectionIds.map((collectionId, position) => ({ productId, collectionId, position })), skipDuplicates: true });
  }
  await tx.productRecommendation.deleteMany({ where: { productId } });
  const recos = input.recommendedProductIds.filter((id) => id !== productId);
  if (recos.length) {
    await tx.productRecommendation.createMany({ data: recos.map((recommendedId, position) => ({ productId, recommendedId, position })), skipDuplicates: true });
  }
}

export async function createProduct(raw: unknown, actor: Actor = {}): Promise<Product> {
  const input = productInputSchema.parse(raw);
  const slug = await uniqueSlug(input.slug || input.name);
  const data = toData(input);
  const product = await prisma.$transaction(async (tx) => {
    const p = await tx.product.create({ data: { ...data, slug, createdById: actor.userId ?? null, source: actor.source ?? "admin", needsReview: actor.source === "api" } });
    await syncRelations(p.id, input, tx);
    return p;
  });
  await audit({ userId: actor.userId, actor: actor.actor, action: "product.create", entity: "product", entityId: product.id, data: { slug } });
  if (product.status === "PUBLISHED") await onPublished(product);
  revalidateCatalog([slug]);
  return product;
}

export async function updateProduct(id: string, raw: unknown, actor: Actor = {}): Promise<Product> {
  const input = productInputSchema.parse(raw);
  const before = await prisma.product.findUniqueOrThrow({ where: { id } });
  const slug = input.slug && input.slug !== before.slug ? await uniqueSlug(input.slug, id) : before.slug;
  const data = toData(input);
  // Conserve la date de première publication
  if (input.status === "PUBLISHED" && before.publishedAt) data.publishedAt = before.publishedAt;
  const product = await prisma.$transaction(async (tx) => {
    const p = await tx.product.update({ where: { id }, data: { ...data, slug, needsReview: input.status === "PUBLISHED" ? false : before.needsReview } });
    await syncRelations(id, input, tx);
    return p;
  });
  await audit({ userId: actor.userId, actor: actor.actor, action: "product.update", entity: "product", entityId: id, data: { status: product.status } });
  if (before.status !== "PUBLISHED" && product.status === "PUBLISHED") await onPublished(product);
  revalidateCatalog([before.slug, slug]);
  return product;
}

export async function setProductStatus(id: string, status: Product["status"], actor: Actor = {}, scheduledAt?: Date | null): Promise<Product> {
  const before = await prisma.product.findUniqueOrThrow({ where: { id } });
  const product = await prisma.product.update({
    where: { id },
    data: {
      status,
      publishedAt: status === "PUBLISHED" ? before.publishedAt ?? new Date() : before.publishedAt,
      scheduledAt: status === "SCHEDULED" ? scheduledAt ?? before.scheduledAt : null,
      archivedAt: status === "ARCHIVED" ? new Date() : null,
      needsReview: status === "PUBLISHED" ? false : before.needsReview,
    },
  });
  await audit({ userId: actor.userId, actor: actor.actor, action: `product.${status.toLowerCase()}`, entity: "product", entityId: id });
  if (before.status !== "PUBLISHED" && status === "PUBLISHED") await onPublished(product);
  revalidateCatalog([product.slug]);
  return product;
}

/** Duplique un produit (textes, prix, médias, relations) en brouillon. Les fichiers payants sont référencés (même clé de stockage). */
export async function duplicateProduct(id: string, actor: Actor = {}, overrides: { name?: string } = {}): Promise<Product> {
  const src = await prisma.product.findUniqueOrThrow({ where: { id }, include: { images: true, files: true, collections: true, recommendations: true } });
  const name = overrides.name ?? `${src.name} (copie)`;
  const slug = await uniqueSlug(name);
  const { id: _id, createdAt: _c, updatedAt: _u, salesCount: _s, viewCount: _v, ratingAvg: _r, reviewCount: _rc, images, files, collections, recommendations, ...rest } = src;
  const copy = await prisma.$transaction(async (tx) => {
    const p = await tx.product.create({
      data: {
        ...rest,
        name, slug, status: "DRAFT", publishedAt: null, scheduledAt: null, archivedAt: null, isFeatured: false, needsReview: false,
        createdById: actor.userId ?? null, source: "duplicate",
        kitContents: rest.kitContents ?? undefined, faq: rest.faq ?? undefined, sellingPoints: rest.sellingPoints ?? undefined,
        images: { create: images.map(({ id: _i, productId: _p, createdAt: _ca, ...img }) => img) },
        files: { create: files.map(({ id: _i, productId: _p, createdAt: _ca, ...f }) => f) },
        collections: { create: collections.map((c) => ({ collectionId: c.collectionId, position: c.position })) },
        recommendations: { create: recommendations.map((r) => ({ recommendedId: r.recommendedId, position: r.position })) },
      },
    });
    return p;
  });
  await audit({ userId: actor.userId, actor: actor.actor, action: "product.duplicate", entity: "product", entityId: copy.id, data: { from: id } });
  return copy;
}

export async function deleteProduct(id: string, actor: Actor = {}): Promise<void> {
  const orders = await prisma.orderItem.count({ where: { productId: id } });
  const product = await prisma.product.findUniqueOrThrow({ where: { id } });
  if (orders > 0) {
    // Jamais de suppression d'un produit vendu : archivage (les commandes historiques sont conservées)
    await setProductStatus(id, "ARCHIVED", actor);
    return;
  }
  await prisma.product.delete({ where: { id } });
  await audit({ userId: actor.userId, actor: actor.actor, action: "product.delete", entity: "product", entityId: id, data: { slug: product.slug } });
  revalidateCatalog([product.slug]);
}

/** Publie les produits programmés dont la date est passée (appelé par le cron). */
export async function publishScheduledProducts(now = new Date()): Promise<string[]> {
  const due = await prisma.product.findMany({ where: { status: "SCHEDULED", scheduledAt: { lte: now } } });
  const slugs: string[] = [];
  for (const p of due) {
    const updated = await prisma.product.update({ where: { id: p.id }, data: { status: "PUBLISHED", publishedAt: p.publishedAt ?? now, scheduledAt: null } });
    await onPublished(updated);
    slugs.push(p.slug);
  }
  const posts = await prisma.blogPost.findMany({ where: { status: "SCHEDULED", scheduledAt: { lte: now } } });
  for (const post of posts) {
    await prisma.blogPost.update({ where: { id: post.id }, data: { status: "PUBLISHED", publishedAt: post.publishedAt ?? now, scheduledAt: null } });
  }
  if (slugs.length || posts.length) revalidateCatalog(slugs);
  return slugs;
}

async function onPublished(product: Product) {
  await emitMarketingEvent("product.published", null, { productId: product.id, slug: product.slug, name: product.name });
}

/** Recalcule la note moyenne après modération d'un avis. */
export async function refreshProductRating(productId: string) {
  const agg = await prisma.review.aggregate({ where: { productId, status: "APPROVED" }, _avg: { rating: true }, _count: true });
  const p = await prisma.product.update({ where: { id: productId }, data: { ratingAvg: agg._avg.rating ?? null, reviewCount: agg._count } });
  revalidateCatalog([p.slug]);
}
