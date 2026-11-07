import type { FaqItem, KitItem, SellingPoint } from "@/lib/schemas/product";
import { centsToEuros, toLocalInput } from "@/lib/admin/form-utils";

export interface ProductFormImage { id: string; url: string; alt: string | null; role: string; position: number }
export interface ProductFormFile { id: string; name: string; description: string | null; kind: string; sizeBytes: number; mime: string }

export interface ProductFormData {
  id?: string;
  name: string; slug: string; tagline: string; shortDescription: string; longDescription: string; story: string;
  template: string; categoryId: string; collectionIds: string[]; universe: string; tags: string; badges: string; heroBadges: string;
  ageMin: string; ageMax: string; playersMin: string; playersMax: string; durationMinutes: string; difficulty: string; pageCount: string; fileFormat: string; materials: string;
  price: string; salePrice: string; saleStartsAt: string; saleEndsAt: string; currency: string; taxRate: string;
  kitContents: KitItem[]; faq: FaqItem[]; sellingPoints: SellingPoint[];
  seoTitle: string; seoDescription: string; keywords: string; ogImageUrl: string; promoText: string; recommendedProductIds: string[];
  status: string; scheduledAt: string; isFeatured: boolean;
  publishedAt?: string | null; needsReview?: boolean; source?: string;
}

export function emptyProductForm(): ProductFormData {
  return {
    name: "", slug: "", tagline: "", shortDescription: "", longDescription: "", story: "", template: "CLASSIC", categoryId: "", collectionIds: [], universe: "", tags: "", badges: "", heroBadges: "",
    ageMin: "", ageMax: "", playersMin: "", playersMax: "", durationMinutes: "", difficulty: "", pageCount: "", fileFormat: "PDF", materials: "",
    price: "", salePrice: "", saleStartsAt: "", saleEndsAt: "", currency: "EUR", taxRate: "20",
    kitContents: [], faq: [], sellingPoints: [],
    seoTitle: "", seoDescription: "", keywords: "", ogImageUrl: "", promoText: "", recommendedProductIds: [],
    status: "DRAFT", scheduledAt: "", isFeatured: false,
  };
}

/** Convertit un produit Prisma en données de formulaire. */
export function productToForm(p: {
  id: string; name: string; slug: string; tagline: string | null; shortDescription: string | null; longDescription: string | null; story: string | null; template: string; categoryId: string | null;
  universe: string | null; tags: string[]; badges: string[]; heroBadges: string[]; ageMin: number | null; ageMax: number | null; playersMin: number | null; playersMax: number | null; durationMinutes: number | null;
  difficulty: number | null; pageCount: number | null; fileFormat: string; materials: string[]; priceCents: number; salePriceCents: number | null; saleStartsAt: Date | null; saleEndsAt: Date | null; currency: string; taxRateBp: number;
  kitContents: unknown; faq: unknown; sellingPoints: unknown; seoTitle: string | null; seoDescription: string | null; keywords: string[]; ogImageUrl: string | null; promoText: string | null;
  status: string; scheduledAt: Date | null; isFeatured: boolean; publishedAt: Date | null; needsReview: boolean; source: string;
  collections: Array<{ collectionId: string }>; recommendations: Array<{ recommendedId: string }>;
}): ProductFormData {
  const s = (v: string | null | undefined) => v ?? "";
  const n = (v: number | null | undefined) => (v == null ? "" : String(v));
  return {
    id: p.id, name: p.name, slug: p.slug, tagline: s(p.tagline), shortDescription: s(p.shortDescription), longDescription: s(p.longDescription), story: s(p.story), template: p.template, categoryId: s(p.categoryId),
    collectionIds: p.collections.map((c) => c.collectionId), universe: s(p.universe), tags: p.tags.join(", "), badges: p.badges.join(", "), heroBadges: p.heroBadges.join(", "),
    ageMin: n(p.ageMin), ageMax: n(p.ageMax), playersMin: n(p.playersMin), playersMax: n(p.playersMax), durationMinutes: n(p.durationMinutes), difficulty: n(p.difficulty), pageCount: n(p.pageCount), fileFormat: p.fileFormat, materials: p.materials.join(", "),
    price: centsToEuros(p.priceCents), salePrice: centsToEuros(p.salePriceCents), saleStartsAt: toLocalInput(p.saleStartsAt), saleEndsAt: toLocalInput(p.saleEndsAt), currency: p.currency, taxRate: String(p.taxRateBp / 100),
    kitContents: Array.isArray(p.kitContents) ? (p.kitContents as KitItem[]) : [], faq: Array.isArray(p.faq) ? (p.faq as FaqItem[]) : [], sellingPoints: Array.isArray(p.sellingPoints) ? (p.sellingPoints as SellingPoint[]) : [],
    seoTitle: s(p.seoTitle), seoDescription: s(p.seoDescription), keywords: p.keywords.join(", "), ogImageUrl: s(p.ogImageUrl), promoText: s(p.promoText), recommendedProductIds: p.recommendations.map((r) => r.recommendedId),
    status: p.status, scheduledAt: toLocalInput(p.scheduledAt), isFeatured: p.isFeatured, publishedAt: p.publishedAt?.toISOString() ?? null, needsReview: p.needsReview, source: p.source,
  };
}
