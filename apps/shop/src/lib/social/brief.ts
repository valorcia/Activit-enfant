import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/db";
import { env } from "@/lib/env";
import { getSetting } from "@/lib/settings";
import { effectivePrice } from "@/lib/pricing";
import { formatPrice } from "@/lib/utils";
import type { ProductBrief } from "./copywriter";

/**
 * Données factuelles d'un produit pour le copywriter (seule source autorisée)
 * et images utilisables dans les posts (hors vidéos).
 */
export async function buildProductBrief(productId: string, linkUrl: string, db: PrismaClient = defaultPrisma): Promise<{ brief: ProductBrief; images: string[] }> {
  const product = await db.product.findUniqueOrThrow({ where: { id: productId }, include: { images: { orderBy: { position: "asc" } } } });
  const brand = await getSetting("brand");
  const price = effectivePrice(product);
  const kit = Array.isArray(product.kitContents) ? (product.kitContents as Array<{ title: string; quantity?: number | null }>) : [];
  // Image principale en tête, vidéos exclues
  const images = product.images.filter((i) => i.role !== "VIDEO").sort((a, b) => Number(b.role === "MAIN") - Number(a.role === "MAIN"));
  return {
    brief: {
      name: product.name, tagline: product.tagline, shortDescription: product.shortDescription, longDescription: product.longDescription,
      ageMin: product.ageMin, ageMax: product.ageMax, playersMin: product.playersMin, playersMax: product.playersMax, durationMinutes: product.durationMinutes, pageCount: product.pageCount,
      priceLabel: `${formatPrice(price.priceCents, product.currency)} TTC${price.compareAtCents ? ` (au lieu de ${formatPrice(price.compareAtCents, product.currency)})` : ""}`,
      kitContents: kit.map((k) => ({ title: k.title, quantity: k.quantity ?? null })),
      images: images.map((i, index) => ({ index, alt: i.alt, role: i.role })),
      url: linkUrl, brandName: brand.name,
    },
    images: images.map((i) => i.url),
  };
}

export function productLandingBase(slug: string): string {
  return `${env.appUrl}/aventures/${slug}`;
}
