/**
 * Catalogue de la boutique vu depuis le studio : liste des produits, liens avec les
 * livres du studio, statistiques de ventes et import d'un produit existant en livre lié.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { getShopSettings } from "../settings";
import { storeAsset } from "../storage";
import { ShopListingSchema, type ShopListing } from "../schemas/settings";
import { CoverDataSchema } from "../schemas/activity";
import { kitType, kitTypeFromShop } from "../kits/types";
import { ShopClient, type ShopProduct, type ShopProductStats } from "./client";

export async function shopClient(): Promise<ShopClient | null> {
  const s = await getShopSettings();
  if (!s.shopApiUrl || !s.shopApiKey) return null;
  return new ShopClient({ baseUrl: s.shopApiUrl, apiKey: s.shopApiKey });
}

export interface CatalogEntry {
  id: string;
  slug: string;
  name: string;
  status: string;
  needsReview: boolean;
  priceCents: number;
  salePriceCents: number | null;
  currency: string;
  category: { slug: string; name: string } | null;
  imageUrl: string | null;
  salesCount: number;
  publicUrl: string | null;
  editUrl: string;
  linkedBook: { id: string; title: string } | null;
  suggestedKitType: string;
}

function absolute(base: string, url: string | null | undefined) {
  if (!url) return null;
  return url.startsWith("http") ? url : `${base.replace(/\/$/, "")}${url.startsWith("/") ? "" : "/"}${url}`;
}

export function toCatalogEntry(p: ShopProduct, base: string, linked: Map<string, { id: string; title: string }>): CatalogEntry {
  const r = p as ShopProduct & { priceCents?: number; salePriceCents?: number | null; currency?: string; category?: { slug: string; name: string } | null; salesCount?: number; template?: string; universe?: string | null };
  const main = p.images.find((i) => i.role === "MAIN") ?? p.images[0];
  return {
    id: p.id, slug: p.slug, name: p.name, status: p.status, needsReview: p.needsReview,
    priceCents: r.priceCents ?? 0, salePriceCents: r.salePriceCents ?? null, currency: r.currency ?? "EUR",
    category: r.category ? { slug: r.category.slug, name: r.category.name } : null,
    imageUrl: absolute(base, main?.url), salesCount: r.salesCount ?? 0,
    publicUrl: p.publicUrl, editUrl: p.editUrl,
    linkedBook: linked.get(p.id) ?? linked.get(p.slug) ?? null,
    suggestedKitType: kitTypeFromShop({ categorySlug: r.category?.slug, template: r.template, name: p.name, universe: r.universe }),
  };
}

/** Catalogue complet + livres liés. `error` renseigné si la boutique n'est pas joignable ou configurée. */
export async function loadCatalog(): Promise<{ configured: boolean; entries: CatalogEntry[]; error?: string; baseUrl: string }> {
  const s = await getShopSettings();
  const client = await shopClient();
  if (!client) return { configured: false, entries: [], baseUrl: s.shopApiUrl };
  try {
    const products = await client.allProducts();
    const books = await prisma.book.findMany({ where: { OR: [{ shopProductId: { not: null } }, { shopProductSlug: { not: null } }] }, select: { id: true, title: true, shopProductId: true, shopProductSlug: true } });
    const linked = new Map<string, { id: string; title: string }>();
    for (const b of books) {
      if (b.shopProductId) linked.set(b.shopProductId, { id: b.id, title: b.title });
      if (b.shopProductSlug) linked.set(b.shopProductSlug, { id: b.id, title: b.title });
    }
    return { configured: true, entries: products.map((p) => toCatalogEntry(p, s.shopApiUrl, linked)), baseUrl: s.shopApiUrl };
  } catch (e) {
    return { configured: true, entries: [], error: e instanceof Error ? e.message : String(e), baseUrl: s.shopApiUrl };
  }
}

/** Statistiques de ventes des produits liés (meilleures ventes d'abord). */
export async function topSellers(entries: CatalogEntry[], limit = 5): Promise<Array<{ entry: CatalogEntry; stats: ShopProductStats | null }>> {
  const client = await shopClient();
  if (!client) return [];
  const top = [...entries].filter((e) => e.salesCount > 0).sort((a, b) => b.salesCount - a.salesCount).slice(0, limit);
  return Promise.all(top.map(async (entry) => ({ entry, stats: await client.productStats(entry.id).catch(() => null) })));
}

/** Fiche commerciale du studio pré-remplie à partir d'un produit de la boutique. */
export function listingFromProduct(p: ShopProduct): ShopListing {
  const r = p as Record<string, unknown>;
  const str = (k: string) => (typeof r[k] === "string" && (r[k] as string).length ? (r[k] as string) : undefined);
  const num = (k: string) => (typeof r[k] === "number" ? (r[k] as number) : undefined);
  const arr = <T,>(k: string) => (Array.isArray(r[k]) && (r[k] as T[]).length ? (r[k] as T[]) : undefined);
  const parsed = ShopListingSchema.safeParse({
    name: p.name, slug: p.slug,
    tagline: str("tagline")?.slice(0, 200), shortDescription: str("shortDescription")?.slice(0, 400), longDescription: str("longDescription"), story: str("story"),
    priceCents: num("priceCents"), salePriceCents: num("salePriceCents") ?? null,
    categorySlug: (r.category as { slug?: string } | null)?.slug, collectionSlugs: (r.collections as Array<{ slug: string }> | undefined)?.map((c) => c.slug),
    template: str("template"), universe: str("universe")?.slice(0, 80), tags: arr<string>("tags"),
    ageMin: num("ageMin"), ageMax: num("ageMax"), durationMinutes: num("durationMinutes") ?? null,
    kitContents: arr("kitContents"), faq: arr("faq"), sellingPoints: arr("sellingPoints"),
    seoTitle: str("seoTitle")?.slice(0, 70), seoDescription: str("seoDescription")?.slice(0, 170), keywords: arr<string>("keywords"),
  });
  return parsed.success ? parsed.data : { name: p.name, slug: p.slug };
}

/** Âge du livre à partir de la fiche (« 5-8 »…), repli sur l'âge du type de kit. */
export function ageRangeFromProduct(p: ShopProduct, fallback: string): string {
  const r = p as { ageMin?: number | null; ageMax?: number | null };
  return r.ageMin != null && r.ageMax != null ? `${r.ageMin}-${r.ageMax}` : fallback;
}

/**
 * Importe un produit existant de la boutique comme livre lié du studio
 * (idempotent : un produit déjà lié renvoie le livre existant).
 */
export async function importShopProduct(idOrSlug: string): Promise<{ bookId: string; created: boolean; coverImported: boolean }> {
  const client = await shopClient();
  if (!client) throw new Error("Boutique non configurée : renseignez l'URL et la clé API dans Paramètres → Boutique.");
  const p = await client.getProduct(idOrSlug);
  if (!p) throw new Error("Produit introuvable dans la boutique");
  const existing = await prisma.book.findFirst({ where: { OR: [{ shopProductId: p.id }, { shopProductSlug: p.slug }] } });
  if (existing) return { bookId: existing.id, created: false, coverImported: false };

  const r = p as ShopProduct & { category?: { slug: string } | null; template?: string; universe?: string | null; tagline?: string | null; shortDescription?: string | null; story?: string | null };
  const kt = kitTypeFromShop({ categorySlug: r.category?.slug, template: r.template, name: p.name, universe: r.universe });
  const def = kitType(kt);
  const listing = listingFromProduct(p);
  const cover = CoverDataSchema.parse({ title: p.name, subtitle: r.tagline ?? "", collection: "La Malle à Jeux", tagline: r.tagline ?? "", backText: (r.shortDescription ?? "").slice(0, 1200) });
  const book = await prisma.book.create({
    data: {
      title: p.name,
      subtitle: r.tagline ?? null,
      collection: "La Malle à Jeux",
      bookType: kt,
      kitType: kt,
      ageRange: ageRangeFromProduct(p, def.defaultAge),
      targetCount: def.defaultCount,
      artStyle: "aquarelle",
      status: p.status === "PUBLISHED" ? "EXPORTED" : "REVIEW",
      brief: r.shortDescription ?? null,
      cover: { ...cover, introduction: r.story ?? "" } as Prisma.InputJsonValue,
      customization: { universe: r.universe ?? def.defaultUniverse ?? "", priceCents: listing.priceCents, shopCategorySlug: listing.categorySlug, shopTemplate: listing.template } as Prisma.InputJsonValue,
      shopListing: listing as Prisma.InputJsonValue,
      shopProductId: p.id,
      shopProductSlug: p.slug,
      shopPublishedAt: p.status === "PUBLISHED" ? new Date() : null,
      shopLastSyncAt: new Date(),
    },
  });

  // Couverture : image principale de la fiche → illustration de couverture acceptée
  let coverImported = false;
  const main = p.images.find((i) => i.role === "MAIN");
  if (main) {
    try {
      const img = await client.downloadImage(main.url);
      if (img) {
        const ext = img.mime.split("/")[1]?.replace("jpeg", "jpg") ?? "png";
        const asset = await storeAsset({ key: `illustrations/${book.id}/import-cover.${ext}`, data: img.data, mime: img.mime });
        const ill = await prisma.illustration.create({ data: { bookId: book.id, kind: "COVER", status: "ACCEPTED", isCurrent: true, assetId: asset.id, provider: "import", model: "boutique", prompt: `Image principale importée de la boutique (${p.slug})`, isDemo: false } });
        await prisma.book.update({ where: { id: book.id }, data: { cover: { ...cover, introduction: r.story ?? "", illustrationId: ill.id } as Prisma.InputJsonValue } });
        coverImported = true;
      }
    } catch {
      /* l'import reste valide sans couverture */
    }
  }
  return { bookId: book.id, created: true, coverImported };
}
