import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/db";

/** Montant HT à partir d'un TTC et d'un taux en points de base (2000 = 20 %). */
export function excludingTax(totalCents: number, taxRateBp: number): number {
  return Math.round(totalCents / (1 + taxRateBp / 10000));
}

export interface ProductSalesStats {
  productId: string;
  currency: string;
  total: PeriodStats;
  last30Days: PeriodStats;
  lastOrderAt: string | null;
}
export interface PeriodStats {
  orders: number;
  units: number;
  revenueCents: number;     // TTC, remboursements déduits au prorata
  revenueNetCents: number;  // HT
  refundedCents: number;
}

const PAID = ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"] as const;

/**
 * Ventes d'un produit (achats directs ; les packs ne sont pas ventilés).
 * Les remboursements d'une commande sont répartis au prorata de la part du produit dans la commande.
 */
export async function productSalesStats(productId: string, db: PrismaClient = defaultPrisma, now = new Date()): Promise<ProductSalesStats> {
  const items = await db.orderItem.findMany({
    where: { productId, order: { status: { in: [...PAID] } } },
    select: { totalCents: true, quantity: true, taxRateBp: true, order: { select: { id: true, paidAt: true, createdAt: true, totalCents: true, refundedCents: true, currency: true } } },
  });
  const since = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
  const empty = (): PeriodStats & { _orders: Set<string> } => ({ orders: 0, units: 0, revenueCents: 0, revenueNetCents: 0, refundedCents: 0, _orders: new Set() });
  const total = empty();
  const recent = empty();
  let lastOrderAt: Date | null = null;
  let currency = "EUR";
  for (const it of items) {
    const o = it.order;
    currency = o.currency;
    const share = o.totalCents > 0 ? it.totalCents / o.totalCents : 0;
    const refunded = Math.round(o.refundedCents * share);
    const net = Math.max(0, it.totalCents - refunded);
    const at = o.paidAt ?? o.createdAt;
    if (!lastOrderAt || at > lastOrderAt) lastOrderAt = at;
    for (const bucket of at >= since ? [total, recent] : [total]) {
      bucket._orders.add(o.id);
      bucket.units += it.quantity;
      bucket.revenueCents += net;
      bucket.revenueNetCents += excludingTax(net, it.taxRateBp);
      bucket.refundedCents += refunded;
    }
  }
  const out = (b: ReturnType<typeof empty>): PeriodStats => ({ orders: b._orders.size, units: b.units, revenueCents: b.revenueCents, revenueNetCents: b.revenueNetCents, refundedCents: b.refundedCents });
  return { productId, currency, total: out(total), last30Days: out(recent), lastOrderAt: lastOrderAt ? lastOrderAt.toISOString() : null };
}
