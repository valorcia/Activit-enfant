import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/db";
import { productContentSchema, type LocalizedProductContent } from "./catalog-content";
import type { Locale } from "./constants";
import { personalizedPrice } from "./pricing";

/** Produits personnalisés publiés d'une marque, dans la langue et la devise demandées. */
export interface UwProduct {
  id: string;
  slug: string;
  collectionKey: string;
  collectionSlug: string | null;
  name: string;
  priceCents: number | null;
  currency: string;
  pagesMin: number | null;
  pagesMax: number | null;
  deliveryDaysMin: number;
  deliveryDaysMax: number;
  formats: string[];
  content: LocalizedProductContent;
}

const include = { personalization: true, collections: { include: { collection: { select: { slug: true, position: true } } }, take: 1 } } as const;

type Row = NonNullable<Awaited<ReturnType<typeof loadRows>>>[number];

async function loadRows(siteId: string) {
  return prisma.product.findMany({ where: { siteId, status: "PUBLISHED", personalization: { isNot: null } }, include, orderBy: { createdAt: "asc" } });
}

function toUw(row: Row, locale: Locale, currency: string): UwProduct {
  const p = row.personalization!;
  const parsed = productContentSchema.safeParse(p.content);
  const content: LocalizedProductContent = parsed.success
    ? parsed.data[locale]
    : { name: row.name, tagline: row.tagline ?? "", description: row.shortDescription ?? "", collectionLead: row.shortDescription ?? "", story: [], editions: [], inside: [], faq: [] };
  return {
    id: row.id,
    slug: row.slug,
    collectionKey: p.collectionKey,
    collectionSlug: row.collections[0]?.collection.slug ?? null,
    name: content.name || row.name,
    priceCents: personalizedPrice(row, p.prices, currency),
    currency,
    pagesMin: p.pagesMin,
    pagesMax: p.pagesMax,
    deliveryDaysMin: p.deliveryDaysMin,
    deliveryDaysMax: p.deliveryDaysMax,
    formats: p.formats,
    content,
  };
}

const position = (r: Row) => r.collections[0]?.collection.position ?? 99;

export const getUwProducts = cache(async (siteId: string, locale: Locale, currency: string): Promise<UwProduct[]> => {
  const rows = await loadRows(siteId);
  return rows.sort((a, b) => position(a) - position(b)).map((r) => toUw(r, locale, currency));
});

export async function getUwProduct(siteId: string, slug: string, locale: Locale, currency: string): Promise<UwProduct | null> {
  return (await getUwProducts(siteId, locale, currency)).find((p) => p.slug === slug) ?? null;
}

export async function getUwCollection(siteId: string, slug: string, locale: Locale, currency: string) {
  const collection = await prisma.collection.findFirst({ where: { siteId, slug, isVisible: true } });
  if (!collection) return null;
  const products = (await getUwProducts(siteId, locale, currency)).filter((p) => p.collectionSlug === slug);
  return products.length ? { collection, products } : null;
}

/** Prix d'appel (le plus bas) pour l'accueil. */
export function lowestPrice(products: UwProduct[]): number | null {
  const prices = products.map((p) => p.priceCents).filter((x): x is number => x != null);
  return prices.length ? Math.min(...prices) : null;
}
