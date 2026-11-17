import { pricesSchema } from "./catalog-content";

/**
 * Prix d'un produit personnalisé dans une devise : prix fixé pour cette devise
 * (`PersonalizedProduct.prices`), sinon `Product.priceCents` s'il est dans la même devise,
 * sinon null (produit non proposé dans cette devise). Jamais de conversion à la volée.
 */
export function personalizedPrice(
  product: { priceCents: number; currency: string },
  prices: unknown,
  currency: string,
): number | null {
  const parsed = pricesSchema.safeParse(prices ?? {});
  const map = parsed.success ? parsed.data : {};
  const cur = currency.toUpperCase();
  if (map[cur] != null) return map[cur];
  return product.currency.toUpperCase() === cur ? product.priceCents : null;
}
