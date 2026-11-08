import "server-only";
import { prisma } from "@/lib/db";

export type Period = "7j" | "30j" | "90j" | "12m";
export const PERIODS: Array<{ value: Period; label: string }> = [
  { value: "7j", label: "7 jours" }, { value: "30j", label: "30 jours" }, { value: "90j", label: "90 jours" }, { value: "12m", label: "12 mois" },
];

const PAID_STATUSES = ["PAID", "PARTIALLY_REFUNDED"] as const;

function periodStart(period: Period, now = new Date()): Date {
  const d = new Date(now);
  if (period === "12m") d.setMonth(d.getMonth() - 12);
  else d.setDate(d.getDate() - Number(period.replace("j", "")));
  d.setHours(0, 0, 0, 0);
  return d;
}

export interface DashboardStats {
  period: Period;
  revenueCents: number;
  orders: number;
  averageOrderCents: number;
  refundedCents: number;
  previous: { revenueCents: number; orders: number };
  series: Array<{ label: string; revenueCents: number; orders: number }>;
  topProducts: Array<{ id: string; name: string; slug: string; quantity: number; revenueCents: number }>;
  byCategory: Array<{ name: string; color: string | null; revenueCents: number; quantity: number }>;
  conversion: { rate: number | null; productViews: number; checkoutsStarted: number; ordersPaid: number };
  catalog: { byStatus: Record<string, number>; publishedPerMonth: Array<{ label: string; count: number }>; needsReview: number; withoutFiles: number };
  pendingReviews: number;
  recentOrders: Array<{ id: string; number: string; email: string; totalCents: number; status: string; createdAt: Date; itemCount: number }>;
}

/** `siteId` : univers sélectionné dans l'admin (absent = tous les univers). */
export async function getDashboardStats(period: Period = "30j", now = new Date(), siteId?: string): Promise<DashboardStats> {
  const start = periodStart(period, now);
  const prevStart = new Date(start.getTime() - (now.getTime() - start.getTime()));
  const sw = siteId ? { siteId } : {};
  const paidWhere = { ...sw, status: { in: [...PAID_STATUSES] }, paidAt: { gte: start, lte: now } };

  const [agg, prevAgg, orders, items, catalogByStatus, needsReview, withoutFiles, pendingReviews, recentOrders, dailyStats, publishedProducts] = await Promise.all([
    prisma.order.aggregate({ where: paidWhere, _sum: { totalCents: true, refundedCents: true }, _count: true }),
    prisma.order.aggregate({ where: { ...sw, status: { in: [...PAID_STATUSES] }, paidAt: { gte: prevStart, lt: start } }, _sum: { totalCents: true, refundedCents: true }, _count: true }),
    prisma.order.findMany({ where: paidWhere, select: { paidAt: true, totalCents: true, refundedCents: true } }),
    prisma.orderItem.findMany({ where: { order: paidWhere }, select: { productId: true, bundleId: true, name: true, quantity: true, totalCents: true, product: { select: { id: true, name: true, slug: true, category: { select: { name: true, color: true } } } }, bundle: { select: { name: true } } } }),
    prisma.product.groupBy({ by: ["status"], where: sw, _count: true }),
    prisma.product.count({ where: { ...sw, needsReview: true } }),
    prisma.product.count({ where: { ...sw, status: "PUBLISHED", files: { none: {} } } }),
    prisma.review.count({ where: { status: "PENDING", ...(siteId ? { product: { siteId } } : {}) } }),
    prisma.order.findMany({ where: { ...sw, status: { not: "PENDING" } }, orderBy: { createdAt: "desc" }, take: 8, select: { id: true, number: true, email: true, totalCents: true, status: true, createdAt: true, _count: { select: { items: true } } } }),
    prisma.dailyStat.aggregate({ where: { date: { gte: start } }, _sum: { productViews: true, checkoutsStarted: true, ordersPaid: true } }),
    prisma.product.findMany({ where: { ...sw, status: "PUBLISHED", publishedAt: { gte: new Date(now.getFullYear(), now.getMonth() - 11, 1) } }, select: { publishedAt: true } }),
  ]);

  const revenueCents = (agg._sum.totalCents ?? 0) - (agg._sum.refundedCents ?? 0);
  const count = agg._count;

  // Série temporelle (jour ou mois)
  const byMonth = period === "12m";
  const buckets = new Map<string, { label: string; revenueCents: number; orders: number }>();
  const cursor = new Date(start);
  while (cursor <= now) {
    const key = byMonth ? `${cursor.getFullYear()}-${cursor.getMonth()}` : cursor.toISOString().slice(0, 10);
    const label = byMonth ? cursor.toLocaleDateString("fr-FR", { month: "short" }) : cursor.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
    buckets.set(key, { label, revenueCents: 0, orders: 0 });
    if (byMonth) cursor.setMonth(cursor.getMonth() + 1); else cursor.setDate(cursor.getDate() + 1);
  }
  for (const o of orders) {
    if (!o.paidAt) continue;
    const key = byMonth ? `${o.paidAt.getFullYear()}-${o.paidAt.getMonth()}` : o.paidAt.toISOString().slice(0, 10);
    const b = buckets.get(key);
    if (b) { b.revenueCents += o.totalCents - o.refundedCents; b.orders += 1; }
  }

  // Top produits et ventes par catégorie
  const top = new Map<string, { id: string; name: string; slug: string; quantity: number; revenueCents: number }>();
  const cat = new Map<string, { name: string; color: string | null; revenueCents: number; quantity: number }>();
  for (const it of items) {
    const key = it.productId ?? (it.bundleId ? `bundle:${it.bundleId}` : it.name);
    const t = top.get(key) ?? { id: it.productId ?? it.bundleId ?? "", name: it.product?.name ?? it.bundle?.name ?? it.name, slug: it.product?.slug ?? "", quantity: 0, revenueCents: 0 };
    t.quantity += it.quantity; t.revenueCents += it.totalCents; top.set(key, t);
    const cname = it.product?.category?.name ?? (it.bundleId ? "Packs" : "Sans catégorie");
    const c = cat.get(cname) ?? { name: cname, color: it.product?.category?.color ?? null, revenueCents: 0, quantity: 0 };
    c.quantity += it.quantity; c.revenueCents += it.totalCents; cat.set(cname, c);
  }

  const productViews = dailyStats._sum.productViews ?? 0;
  const ordersPaid = dailyStats._sum.ordersPaid ?? 0;
  const months: Array<{ label: string; count: number }> = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ label: d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" }), count: publishedProducts.filter((p) => p.publishedAt && p.publishedAt.getFullYear() === d.getFullYear() && p.publishedAt.getMonth() === d.getMonth()).length });
  }

  return {
    period, revenueCents, orders: count, averageOrderCents: count ? Math.round(revenueCents / count) : 0, refundedCents: agg._sum.refundedCents ?? 0,
    previous: { revenueCents: (prevAgg._sum.totalCents ?? 0) - (prevAgg._sum.refundedCents ?? 0), orders: prevAgg._count },
    series: [...buckets.values()],
    topProducts: [...top.values()].sort((a, b) => b.revenueCents - a.revenueCents).slice(0, 10),
    byCategory: [...cat.values()].sort((a, b) => b.revenueCents - a.revenueCents),
    conversion: { rate: productViews > 0 ? ordersPaid / productViews : null, productViews, checkoutsStarted: dailyStats._sum.checkoutsStarted ?? 0, ordersPaid },
    catalog: { byStatus: Object.fromEntries(catalogByStatus.map((c) => [c.status, c._count])), publishedPerMonth: months, needsReview, withoutFiles },
    pendingReviews,
    recentOrders: recentOrders.map((o) => ({ id: o.id, number: o.number, email: o.email, totalCents: o.totalCents, status: o.status, createdAt: o.createdAt, itemCount: o._count.items })),
  };
}
