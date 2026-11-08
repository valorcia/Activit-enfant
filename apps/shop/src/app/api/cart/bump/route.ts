import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { cardPrice, getBestsellers, productCardSelect, type ProductCardData } from "@/lib/catalog";
import { getSetting } from "@/lib/settings";
import { getRequestSite } from "@/lib/sites";

export const runtime = "nodejs";

export interface BumpPayload {
  orderBump: { enabled: boolean; title: string; text: string };
  trustBadges: Array<{ icon: string; label: string }>;
  buyNowLabel: string;
  /** Produit proposé (order bump ou suggestion panier vide), absent du panier. */
  product: { id: string; slug: string; name: string; tagline: string | null; imageUrl: string | null; universe: string | null; priceCents: number; compareAtCents: number | null; currency: string } | null;
}

function toPayload(p: ProductCardData) {
  const price = cardPrice(p);
  return { id: p.id, slug: p.slug, name: p.name, tagline: p.tagline, imageUrl: p.images[0]?.url ?? null, universe: p.universe, priceCents: price.priceCents, compareAtCents: price.compareAtCents, currency: p.currency };
}

/**
 * Données du panier pilotées par les paramètres de conversion : produit
 * complémentaire (order bump) hors du panier courant, réassurance, libellés.
 * GET /api/cart/bump?exclude=id1,id2
 */
export async function GET(req: NextRequest) {
  const site = await getRequestSite();
  const conversion = await getSetting("conversion", site);
  const exclude = new Set((req.nextUrl.searchParams.get("exclude") ?? "").split(",").map((s) => s.trim()).filter(Boolean));

  let product: ProductCardData | null = null;
  if (conversion.orderBump.productId && !exclude.has(conversion.orderBump.productId)) {
    product = await prisma.product.findFirst({ where: { id: conversion.orderBump.productId, siteId: site.id, status: "PUBLISHED" }, select: productCardSelect });
  }
  if (!product) {
    const best = await getBestsellers(site.id, 12);
    product = best.find((p) => !exclude.has(p.id)) ?? null;
  }

  const payload: BumpPayload = {
    orderBump: { enabled: conversion.orderBump.enabled, title: conversion.orderBump.title, text: conversion.orderBump.text },
    trustBadges: conversion.trustBadges,
    buyNowLabel: conversion.buyNowLabel,
    product: product ? toPayload(product) : null,
  };
  return NextResponse.json(payload, { headers: { "cache-control": "public, s-maxage=300, stale-while-revalidate=600", vary: "Host, Cookie" } });
}
