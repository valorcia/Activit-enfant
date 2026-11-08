import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/db";
import { readUtm } from "./attribution";

/** Calculs de rentabilité par e-book et par campagne. Montants en centimes. */

export interface RoiInput {
  revenueTtcCents: number;
  revenueHtCents: number;
  orders: number;
  adSpendCents: number;
  creationCostCents: number;
}

export interface RoiResult extends RoiInput {
  marginCents: number;
  roas: number | null;          // revenus HT / dépenses pub
  costPerOrderCents: number | null;
  marginRate: number | null;    // marge / revenus HT
}

export function computeRoi(i: RoiInput): RoiResult {
  const marginCents = i.revenueHtCents - i.adSpendCents - i.creationCostCents;
  return {
    ...i,
    marginCents,
    roas: i.adSpendCents > 0 ? Math.round((i.revenueHtCents / i.adSpendCents) * 100) / 100 : null,
    costPerOrderCents: i.orders > 0 && i.adSpendCents > 0 ? Math.round(i.adSpendCents / i.orders) : null,
    marginRate: i.revenueHtCents > 0 ? Math.round((marginCents / i.revenueHtCents) * 1000) / 1000 : null,
  };
}

/** Revenu HT d'une ligne TTC au taux donné (points de base), remboursements déduits au prorata. */
export function netRevenueOfItem(item: { totalCents: number; taxRateBp: number }, order: { totalCents: number; refundedCents: number }): { ttc: number; ht: number } {
  const refundShare = order.totalCents > 0 ? item.totalCents / order.totalCents : 0;
  const ttc = Math.max(0, item.totalCents - Math.round(order.refundedCents * refundShare));
  const ht = Math.round(ttc / (1 + item.taxRateBp / 10000));
  return { ttc, ht };
}

export interface Period { from: Date; to: Date }

export function periodFromKey(key: string, now = new Date()): Period {
  const to = new Date(now);
  const from = new Date(now);
  switch (key) {
    case "7j": from.setDate(from.getDate() - 7); break;
    case "90j": from.setDate(from.getDate() - 90); break;
    case "12m": from.setMonth(from.getMonth() - 12); break;
    case "tout": from.setFullYear(2000); break;
    default: from.setDate(from.getDate() - 30);
  }
  return { from, to };
}

export interface ProductRoiRow extends RoiResult {
  productId: string;
  name: string;
  slug: string;
  bySource: Record<string, { orders: number; revenueHtCents: number }>;
}

/** Périmètre de rentabilité : un univers et/ou une audience (vide = toute la plateforme). */
export interface RoiScope { siteId?: string | null; audienceId?: string | null }

function siteScope(scope: RoiScope = {}): Prisma.SiteWhereInput | undefined {
  const where: Prisma.SiteWhereInput = {};
  if (scope.siteId) where.id = scope.siteId;
  if (scope.audienceId) where.audienceId = scope.audienceId;
  return Object.keys(where).length ? where : undefined;
}

export async function productRoi(period: Period, db: PrismaClient = defaultPrisma, scope: RoiScope = {}): Promise<ProductRoiRow[]> {
  const site = siteScope(scope);
  const [products, orders, spends] = await Promise.all([
    db.product.findMany({ where: site ? { site } : undefined, select: { id: true, name: true, slug: true, creationCostCents: true }, orderBy: { name: "asc" } }),
    db.order.findMany({
      where: { status: { in: ["PAID", "PARTIALLY_REFUNDED"] }, paidAt: { gte: period.from, lte: period.to }, ...(site ? { site } : {}) },
      select: { totalCents: true, refundedCents: true, utm: true, items: { select: { productId: true, totalCents: true, taxRateBp: true, bundle: { select: { items: { select: { productId: true } } } } } } },
    }),
    db.adSpend.findMany({ where: { date: { gte: period.from, lte: period.to }, ...(site ? { campaign: { site } } : {}) }, select: { spendCents: true, campaign: { select: { productId: true } } } }),
  ]);
  const acc = new Map<string, { ttc: number; ht: number; orders: Set<number>; bySource: Record<string, { orders: number; revenueHtCents: number }> }>();
  const get = (id: string) => acc.get(id) ?? acc.set(id, { ttc: 0, ht: 0, orders: new Set(), bySource: {} }).get(id)!;
  orders.forEach((o, oi) => {
    const source = readUtm(o.utm).utm_source ?? "direct";
    for (const it of o.items) {
      const { ttc, ht } = netRevenueOfItem(it, o);
      // Un pack répartit son revenu à parts égales entre ses produits
      const targets = it.productId ? [it.productId] : (it.bundle?.items.map((b) => b.productId) ?? []);
      for (const pid of targets) {
        const a = get(pid);
        a.ttc += Math.round(ttc / targets.length);
        a.ht += Math.round(ht / targets.length);
        a.orders.add(oi);
        a.bySource[source] ??= { orders: 0, revenueHtCents: 0 };
        a.bySource[source].revenueHtCents += Math.round(ht / targets.length);
        a.bySource[source].orders += 1;
      }
    }
  });
  const spendByProduct = new Map<string, number>();
  for (const s of spends) if (s.campaign.productId) spendByProduct.set(s.campaign.productId, (spendByProduct.get(s.campaign.productId) ?? 0) + s.spendCents);

  return products
    .map((p) => {
      const a = acc.get(p.id);
      const roi = computeRoi({ revenueTtcCents: a?.ttc ?? 0, revenueHtCents: a?.ht ?? 0, orders: a?.orders.size ?? 0, adSpendCents: spendByProduct.get(p.id) ?? 0, creationCostCents: p.creationCostCents ?? 0 });
      return { productId: p.id, name: p.name, slug: p.slug, bySource: a?.bySource ?? {}, ...roi };
    })
    .sort((x, y) => y.revenueHtCents - x.revenueHtCents);
}

export interface CampaignRoiRow extends RoiResult {
  campaignId: string;
  name: string;
  slug: string;
  channel: string;
  status: string;
  productName: string | null;
  clicks: number;
  impressions: number;
}

export async function campaignRoi(period: Period, db: PrismaClient = defaultPrisma, campaignId?: string, scope: RoiScope = {}): Promise<CampaignRoiRow[]> {
  const site = siteScope(scope);
  const campaigns = await db.campaign.findMany({ where: { ...(campaignId ? { id: campaignId } : {}), ...(site ? { site } : {}) }, include: { product: { select: { name: true } }, spends: { where: { date: { gte: period.from, lte: period.to } } } }, orderBy: { createdAt: "desc" } });
  if (!campaigns.length) return [];
  const orders = await db.order.findMany({
    where: { status: { in: ["PAID", "PARTIALLY_REFUNDED"] }, paidAt: { gte: period.from, lte: period.to }, utm: { path: ["utm_campaign"], string_contains: "" } },
    select: { totalCents: true, refundedCents: true, utm: true, items: { select: { totalCents: true, taxRateBp: true } } },
  });
  return campaigns.map((c) => {
    const mine = orders.filter((o) => readUtm(o.utm).utm_campaign === c.utmCampaign);
    let ttc = 0, ht = 0;
    for (const o of mine) for (const it of o.items) { const r = netRevenueOfItem(it, o); ttc += r.ttc; ht += r.ht; }
    const adSpendCents = c.spends.reduce((s, x) => s + x.spendCents, 0);
    const roi = computeRoi({ revenueTtcCents: ttc, revenueHtCents: ht, orders: mine.length, adSpendCents, creationCostCents: 0 });
    return { campaignId: c.id, name: c.name, slug: c.slug, channel: c.channel, status: c.status, productName: c.product?.name ?? null, clicks: c.spends.reduce((s, x) => s + (x.clicks ?? 0), 0), impressions: c.spends.reduce((s, x) => s + (x.impressions ?? 0), 0), ...roi };
  });
}

export function roiRowsToCsv(rows: ProductRoiRow[]): string {
  const head = ["ebook", "slug", "commandes", "revenu_ttc", "revenu_ht", "depenses_pub", "cout_creation", "marge", "roas", "cout_par_commande"];
  const lines = rows.map((r) => [r.name, r.slug, r.orders, r.revenueTtcCents / 100, r.revenueHtCents / 100, r.adSpendCents / 100, r.creationCostCents / 100, r.marginCents / 100, r.roas ?? "", r.costPerOrderCents != null ? r.costPerOrderCents / 100 : ""].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";"));
  return [head.join(";"), ...lines].join("\n");
}
