import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/db";
import type { CreatorsSettings } from "@/lib/schemas/settings";
import { getCreatorSettings } from "./settings";

/**
 * Commissions des créatrices (redevance sur leurs tutoriels).
 *
 * Base de calcul d'une ligne : part encaissée TTC (remise de la commande répartie au
 * prorata des lignes) → hors taxes (taux de TVA de la ligne) → moins les frais Stripe
 * estimés de la commande, répartis au prorata des lignes. Un pack est réparti entre ses
 * produits au prorata de leur prix. Montant = base × taux du produit (sinon taux par
 * défaut de la créatrice, sinon taux « idée seule » des réglages).
 *
 * Aucune commission quand l'e-mail de la commande est celui de la créatrice.
 * Création idempotente (clé unique ligne de commande + produit + type).
 */

type Db = PrismaClient | Prisma.TransactionClient;

export const ROYALTY = "ROYALTY";
export const ADJUSTMENT = "ADJUSTMENT";

export interface CommissionProduct {
  id: string;
  priceCents: number;
  creatorId: string | null;
  creatorRateBp: number | null;
  creator: { id: string; email: string; defaultRateBp: number | null } | null;
}

export interface CommissionOrderItem {
  id: string;
  totalCents: number;
  taxRateBp: number;
  product: CommissionProduct | null;
  bundle: { items: Array<{ product: CommissionProduct }> } | null;
}

export interface CommissionLine {
  orderItemId: string;
  productId: string;
  creatorId: string;
  baseCents: number;
  rateBp: number;
  amountCents: number;
}

/** Frais Stripe estimés pour un montant encaissé (pourcentage + part fixe, en centimes). */
export function estimateStripeFee(paidCents: number, settings: Pick<CreatorsSettings, "stripeFeePercentBp" | "stripeFeeFixedCents">): number {
  if (paidCents <= 0) return 0;
  return Math.round((paidCents * settings.stripeFeePercentBp) / 10000 + settings.stripeFeeFixedCents);
}

export function rateForProduct(p: CommissionProduct, settings: Pick<CreatorsSettings, "ideaRateBp">): number {
  return p.creatorRateBp ?? p.creator?.defaultRateBp ?? settings.ideaRateBp;
}

/** Calcul pur (sans base) des lignes de commission d'une commande payée. */
export function computeOrderCommissions(
  order: { email: string; totalCents: number; items: CommissionOrderItem[] },
  settings: CreatorsSettings,
): CommissionLine[] {
  const itemsTotal = order.items.reduce((s, i) => s + Math.max(0, i.totalCents), 0);
  const paid = order.totalCents;
  if (itemsTotal <= 0 || paid <= 0) return [];
  const fee = estimateStripeFee(paid, settings);
  const buyer = order.email.trim().toLowerCase();
  const lines: CommissionLine[] = [];

  for (const item of order.items) {
    if (item.totalCents <= 0) continue;
    const lineTtc = (item.totalCents * paid) / itemsTotal; // remise répartie au prorata
    const lineHt = lineTtc / (1 + item.taxRateBp / 10000);
    const lineFee = (fee * lineTtc) / paid; // frais Stripe au prorata
    const lineBase = lineHt - lineFee;

    // Produits concernés et leur part de la ligne (pack : au prorata des prix)
    const shares: Array<{ product: CommissionProduct; base: number }> = [];
    if (item.product) shares.push({ product: item.product, base: lineBase });
    else if (item.bundle) {
      const prices = item.bundle.items.reduce((s, bi) => s + Math.max(0, bi.product.priceCents), 0);
      for (const bi of item.bundle.items) {
        const weight = prices > 0 ? Math.max(0, bi.product.priceCents) / prices : 1 / item.bundle.items.length;
        shares.push({ product: bi.product, base: lineBase * weight });
      }
    }

    for (const { product, base } of shares) {
      if (!product.creatorId || !product.creator) continue;
      if (product.creator.email.trim().toLowerCase() === buyer) continue; // pas de commission sur ses propres achats
      const rateBp = rateForProduct(product, settings);
      const positive = Math.max(0, base);
      lines.push({
        orderItemId: item.id,
        productId: product.id,
        creatorId: product.creatorId,
        baseCents: Math.round(positive),
        rateBp,
        amountCents: Math.round((positive * rateBp) / 10000),
      });
    }
  }
  return lines;
}

const commissionProductSelect = {
  id: true,
  priceCents: true,
  creatorId: true,
  creatorRateBp: true,
  creator: { select: { id: true, email: true, defaultRateBp: true } },
} satisfies Prisma.ProductSelect;

/**
 * Crée les commissions « en attente » d'une commande payée. Idempotent : un second appel
 * ne crée rien. Renvoie le nombre de lignes créées.
 */
export async function createCommissionsForOrder(orderId: string, db: Db = defaultPrisma, settings?: CreatorsSettings): Promise<number> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: {
      id: true, email: true, totalCents: true, currency: true, status: true,
      items: {
        select: {
          id: true, totalCents: true, taxRateBp: true,
          product: { select: commissionProductSelect },
          bundle: { select: { items: { select: { product: { select: commissionProductSelect } } } } },
        },
      },
    },
  });
  if (!order || (order.status !== "PAID" && order.status !== "PARTIALLY_REFUNDED")) return 0;
  const hasCreator = order.items.some((i) => i.product?.creatorId || i.bundle?.items.some((bi) => bi.product.creatorId));
  if (!hasCreator) return 0;
  const lines = computeOrderCommissions(order, settings ?? (await getCreatorSettings(db)));
  if (!lines.length) return 0;
  const res = await db.commissionEntry.createMany({
    data: lines.map((l) => ({
      kind: ROYALTY,
      orderId: order.id,
      orderItemId: l.orderItemId,
      productId: l.productId,
      creatorId: l.creatorId,
      baseCents: l.baseCents,
      originalBaseCents: l.baseCents,
      rateBp: l.rateBp,
      amountCents: l.amountCents,
      originalAmountCents: l.amountCents,
      currency: order.currency,
    })),
    skipDuplicates: true,
  });
  return res.count;
}

/** Recalcule le total des paiements en préparation touchés par une modification. */
async function refreshPendingPayouts(db: Db, payoutIds: Array<string | null>) {
  for (const id of new Set(payoutIds.filter((x): x is string => !!x))) {
    const payout = await db.creatorPayout.findUnique({ where: { id }, select: { status: true } });
    if (payout?.status !== "PENDING") continue;
    const agg = await db.commissionEntry.aggregate({ where: { payoutId: id, status: { not: "CANCELLED" } }, _sum: { amountCents: true } });
    await db.creatorPayout.update({ where: { id }, data: { totalCents: agg._sum.amountCents ?? 0 } });
  }
}

/**
 * Remboursement d'une commande :
 *  - total : commissions en attente ou confirmées annulées ;
 *  - partiel : montant et base réduits au prorata du montant remboursé (cumulé, donc idempotent).
 * Une commission déjà versée n'est pas modifiée : une régularisation négative est créée
 * (ou mise à jour), déduite du prochain paiement.
 */
export async function applyCommissionRefund(orderId: string, refund: { refundedCents: number; full: boolean }, db: Db = defaultPrisma, now = new Date()): Promise<void> {
  const order = await db.order.findUnique({ where: { id: orderId }, select: { totalCents: true } });
  if (!order) return;
  const entries = await db.commissionEntry.findMany({ where: { orderId, kind: ROYALTY } });
  if (!entries.length) return;
  const ratio = refund.full || order.totalCents <= 0 ? 0 : Math.max(0, Math.min(1, 1 - refund.refundedCents / order.totalCents));
  const touchedPayouts: Array<string | null> = [];

  for (const e of entries) {
    const amountCents = Math.round(e.originalAmountCents * ratio);
    const baseCents = Math.round(e.originalBaseCents * ratio);
    if (e.status === "CANCELLED") continue;
    if (e.status === "PAID") {
      const delta = amountCents - e.amountCents;
      const existing = await db.commissionEntry.findUnique({ where: { orderItemId_productId_kind: { orderItemId: e.orderItemId, productId: e.productId ?? "", kind: ADJUSTMENT } } });
      if (existing?.status === "PAID") continue; // régularisation déjà versée : traitement manuel
      if (delta === 0 && !existing) continue;
      if (existing) {
        await db.commissionEntry.update({ where: { id: existing.id }, data: { amountCents: delta, originalAmountCents: delta, baseCents: baseCents - e.baseCents, originalBaseCents: baseCents - e.baseCents } });
        touchedPayouts.push(existing.payoutId);
      } else {
        await db.commissionEntry.create({
          data: {
            kind: ADJUSTMENT, orderId, orderItemId: e.orderItemId, productId: e.productId, creatorId: e.creatorId, currency: e.currency, rateBp: e.rateBp,
            amountCents: delta, originalAmountCents: delta, baseCents: baseCents - e.baseCents, originalBaseCents: baseCents - e.baseCents,
            status: "CONFIRMED", confirmedAt: now,
          },
        });
      }
      continue;
    }
    if (refund.full) {
      await db.commissionEntry.update({ where: { id: e.id }, data: { status: "CANCELLED", cancelledAt: now, amountCents: 0, baseCents: 0, payoutId: null } });
      touchedPayouts.push(e.payoutId);
    } else {
      await db.commissionEntry.update({ where: { id: e.id }, data: { amountCents, baseCents } });
      touchedPayouts.push(e.payoutId);
    }
  }
  await refreshPendingPayouts(db, touchedPayouts);
}

/** Confirmation automatique (cron quotidien) des commissions dont le délai de remboursement est écoulé. */
export async function confirmDueCommissions(db: PrismaClient = defaultPrisma, now = new Date(), settings?: CreatorsSettings): Promise<number> {
  const s = settings ?? (await getCreatorSettings(db));
  const cutoff = new Date(now.getTime() - s.confirmationDelayDays * 86400_000);
  const res = await db.commissionEntry.updateMany({
    where: { status: "PENDING", order: { status: { in: ["PAID", "PARTIALLY_REFUNDED"] }, paidAt: { lte: cutoff } } },
    data: { status: "CONFIRMED", confirmedAt: now },
  });
  return res.count;
}

/**
 * Rattrapage : commandes payées récemment qui contiennent un produit de créatrice mais
 * aucune commission (erreur passagère lors du webhook). Idempotent.
 */
export async function backfillRecentCommissions(db: PrismaClient = defaultPrisma, now = new Date(), days = 30): Promise<number> {
  const since = new Date(now.getTime() - days * 86400_000);
  const orders = await db.order.findMany({
    where: {
      status: { in: ["PAID", "PARTIALLY_REFUNDED"] },
      paidAt: { gte: since },
      commissions: { none: {} },
      items: { some: { OR: [{ product: { creatorId: { not: null } } }, { bundle: { items: { some: { product: { creatorId: { not: null } } } } } }] } },
    },
    select: { id: true },
    take: 500,
  });
  if (!orders.length) return 0;
  const settings = await getCreatorSettings(db);
  let created = 0;
  for (const o of orders) created += await createCommissionsForOrder(o.id, db, settings);
  return created;
}

/** Tâche quotidienne : rattrapage puis confirmation après délai. */
export async function runDailyCreatorJobs(db: PrismaClient = defaultPrisma, now = new Date()) {
  const backfilled = await backfillRecentCommissions(db, now);
  const refundsReplayed = await reconcileRefundedCommissions(db, now);
  const confirmed = await confirmDueCommissions(db, now);
  return { backfilled, refundsReplayed, confirmed };
}

export const COMMISSION_STATUS_LABELS: Record<string, string> = {
  PENDING: "En attente",
  CONFIRMED: "Confirmée",
  CANCELLED: "Annulée",
  PAID: "Payée",
};

/** Rejoue (idempotent) les remboursements récents sur les commissions, au cas où le webhook aurait échoué. */
export async function reconcileRefundedCommissions(db: PrismaClient = defaultPrisma, now = new Date(), days = 90): Promise<number> {
  const since = new Date(now.getTime() - days * 86400_000);
  const orders = await db.order.findMany({
    where: { status: { in: ["REFUNDED", "PARTIALLY_REFUNDED"] }, updatedAt: { gte: since }, commissions: { some: { kind: ROYALTY } } },
    select: { id: true, status: true, refundedCents: true },
    take: 500,
  });
  for (const o of orders) await applyCommissionRefund(o.id, { refundedCents: o.refundedCents, full: o.status === "REFUNDED" }, db, now);
  return orders.length;
}
