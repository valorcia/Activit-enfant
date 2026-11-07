/**
 * Fonctions pures de calcul de prix. Tous les montants sont en centimes.
 * Les prix affichés sont TTC ; la TVA est extraite pour la facturation.
 */

export interface Priceable {
  priceCents: number;
  salePriceCents?: number | null;
  saleStartsAt?: Date | string | null;
  saleEndsAt?: Date | string | null;
}

export interface EffectivePrice {
  priceCents: number;         // prix à payer
  compareAtCents: number | null; // prix barré si promotion active
  isOnSale: boolean;
  discountPercent: number | null;
}

export function isSaleActive(p: Priceable, now: Date = new Date()): boolean {
  if (p.salePriceCents == null || p.salePriceCents >= p.priceCents) return false;
  const starts = p.saleStartsAt ? new Date(p.saleStartsAt) : null;
  const ends = p.saleEndsAt ? new Date(p.saleEndsAt) : null;
  if (starts && now < starts) return false;
  if (ends && now > ends) return false;
  return true;
}

export function effectivePrice(p: Priceable, now: Date = new Date()): EffectivePrice {
  if (isSaleActive(p, now)) {
    const sale = p.salePriceCents as number;
    return {
      priceCents: sale,
      compareAtCents: p.priceCents,
      isOnSale: true,
      discountPercent: Math.round((1 - sale / p.priceCents) * 100),
    };
  }
  return { priceCents: p.priceCents, compareAtCents: null, isOnSale: false, discountPercent: null };
}

export interface CouponLike {
  code: string;
  type: "PERCENT" | "FIXED";
  percentOff?: number | null;
  amountOffCents?: number | null;
  minSubtotalCents?: number | null;
  maxUses?: number | null;
  usedCount?: number;
  startsAt?: Date | string | null;
  endsAt?: Date | string | null;
  isActive?: boolean;
}

export type CouponCheck =
  | { ok: true; discountCents: number }
  | { ok: false; reason: string };

export function applyCoupon(coupon: CouponLike | null | undefined, subtotalCents: number, now: Date = new Date()): CouponCheck {
  if (!coupon) return { ok: false, reason: "Code inconnu" };
  if (coupon.isActive === false) return { ok: false, reason: "Ce code n'est plus actif" };
  if (coupon.startsAt && now < new Date(coupon.startsAt)) return { ok: false, reason: "Ce code n'est pas encore valable" };
  if (coupon.endsAt && now > new Date(coupon.endsAt)) return { ok: false, reason: "Ce code a expiré" };
  if (coupon.maxUses != null && (coupon.usedCount ?? 0) >= coupon.maxUses) return { ok: false, reason: "Ce code a atteint son nombre maximal d'utilisations" };
  if (coupon.minSubtotalCents != null && subtotalCents < coupon.minSubtotalCents) {
    return { ok: false, reason: `Montant minimum de commande non atteint (${(coupon.minSubtotalCents / 100).toFixed(2)} €)` };
  }
  let discount = 0;
  if (coupon.type === "PERCENT") {
    const pct = Math.min(100, Math.max(0, coupon.percentOff ?? 0));
    discount = Math.round((subtotalCents * pct) / 100);
  } else {
    discount = Math.max(0, coupon.amountOffCents ?? 0);
  }
  discount = Math.min(discount, subtotalCents);
  return { ok: true, discountCents: discount };
}

export interface CartLineInput {
  kind: "product" | "bundle";
  id: string;
  quantity: number;
}

export interface PricedLine {
  kind: "product" | "bundle";
  id: string;
  name: string;
  quantity: number;
  unitPriceCents: number;
  compareAtCents: number | null;
  totalCents: number;
  taxRateBp: number;
}

export interface CartTotals {
  lines: PricedLine[];
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  taxCents: number; // TVA incluse dans le total (prix TTC)
}

/** TVA incluse dans un montant TTC au taux donné (points de base). */
export function includedTax(totalCents: number, taxRateBp: number): number {
  if (taxRateBp <= 0) return 0;
  return Math.round(totalCents - totalCents / (1 + taxRateBp / 10000));
}

export function computeTotals(lines: PricedLine[], discountCents = 0): CartTotals {
  const subtotalCents = lines.reduce((s, l) => s + l.totalCents, 0);
  const discount = Math.min(Math.max(0, discountCents), subtotalCents);
  const totalCents = subtotalCents - discount;
  // Répartition de la remise au prorata pour calculer la TVA incluse par ligne
  let taxCents = 0;
  for (const l of lines) {
    const share = subtotalCents > 0 ? (l.totalCents / subtotalCents) * discount : 0;
    taxCents += includedTax(Math.round(l.totalCents - share), l.taxRateBp);
  }
  return { lines, subtotalCents, discountCents: discount, totalCents, taxCents };
}
