import "server-only";
import { unstable_cache } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { CATALOG_TAG, productCardSelect } from "@/lib/catalog";

/** Produit phare du tunnel de vente : carte + contenu du kit + infos pratiques. */
export const flagshipSelect = {
  ...productCardSelect,
  kitContents: true,
  sellingPoints: true,
  heroBadges: true,
  pageCount: true,
  difficulty: true,
  materials: true,
  fileFormat: true,
} satisfies Prisma.ProductSelect;

export type FlagshipProduct = Prisma.ProductGetPayload<{ select: typeof flagshipSelect }>;

/**
 * Ordre de résolution : produit choisi dans Conversion → premier produit mis en
 * avant (Apparence) → meilleure vente publiée. Null si rien n'est publié.
 */
export const getFlagshipProduct = unstable_cache(
  async (siteId: string, flagshipId: string | null | undefined, featuredIds: string[]): Promise<FlagshipProduct | null> => {
    const published = { status: "PUBLISHED" as const, siteId };
    if (flagshipId) {
      const p = await prisma.product.findFirst({ where: { id: flagshipId, ...published }, select: flagshipSelect });
      if (p) return p;
    }
    for (const id of featuredIds) {
      const p = await prisma.product.findFirst({ where: { id, ...published }, select: flagshipSelect });
      if (p) return p;
    }
    return prisma.product.findFirst({ where: published, orderBy: [{ isFeatured: "desc" }, { salesCount: "desc" }, { publishedAt: "desc" }], select: flagshipSelect });
  },
  ["flagship-product"],
  { tags: [CATALOG_TAG], revalidate: 300 },
);
