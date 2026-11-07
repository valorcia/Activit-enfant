/** Types partagés panier (client + serveur). */
export interface CartItem {
  kind: "product" | "bundle";
  id: string;
  slug: string;
  name: string;
  imageUrl?: string | null;
  unitPriceCents: number;
  compareAtCents?: number | null;
  quantity: number;
  currency: string;
}
