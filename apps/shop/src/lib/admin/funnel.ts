import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/db";

/**
 * Statistiques du parcours d'achat (Admin → Parcours d'achat), à partir de la mesure d'audience
 * interne (SiteEvent) et des commandes. Tous les chiffres sont des agrégats.
 *
 * Étapes de l'entonnoir (une visite = une session de navigation) :
 *  1. visites ;
 *  2. visites avec au moins une fiche produit vue ;
 *  3. visites avec un ajout au panier ou un clic « Acheter » ;
 *  4. pages de paiement Stripe ouvertes (commandes créées) ;
 *  5. paiements réussis.
 */

export interface FunnelStep { key: string; label: string; count: number }
export interface FunnelStats {
  from: Date;
  to: Date;
  visitors: number;
  visits: number;
  pageViews: number;
  buyClicks: number;
  revenueCents: number;
  steps: FunnelStep[];
  byProduct: Array<{ productId: string; name: string; views: number; carts: number; buyClicks: number; checkouts: number; paid: number }>;
  bySource: Array<{ source: string; visits: number; buyVisits: number }>;
  paidBySource: Array<{ source: string; orders: number; revenueCents: number }>;
  byDevice: Array<{ device: string; visits: number; buyVisits: number }>;
  exitPages: Array<{ path: string; visits: number }>;
  checkoutOutcomes: { created: number; paid: number; abandoned: number; failed: number; pending: number };
  paymentFailures: Array<{ code: string; label: string; count: number }>;
  daily: Array<{ day: string; visits: number; paid: number }>;
}

const n = (v: unknown) => Number(v ?? 0);

/** Motifs de refus Stripe les plus courants, en clair. */
export const DECLINE_LABELS: Record<string, string> = {
  insufficient_funds: "Fonds insuffisants",
  card_declined: "Carte refusée par la banque",
  generic_decline: "Carte refusée par la banque (sans motif)",
  do_not_honor: "Refus de la banque",
  expired_card: "Carte expirée",
  incorrect_cvc: "Cryptogramme (CVC) incorrect",
  incorrect_number: "Numéro de carte incorrect",
  processing_error: "Erreur technique de la banque",
  authentication_required: "Validation 3D Secure non faite",
  payment_intent_authentication_failure: "Validation 3D Secure échouée ou abandonnée",
  lost_card: "Carte déclarée perdue",
  stolen_card: "Carte déclarée volée",
  fraudulent: "Bloqué par la détection de fraude",
  card_velocity_exceeded: "Plafond de la carte atteint",
  card_error: "Erreur de carte",
  inconnu: "Motif non précisé",
};

export async function getFunnelStats(opts: { siteId?: string | null; from: Date; to: Date }, db: PrismaClient = defaultPrisma): Promise<FunnelStats> {
  const { from, to } = opts;
  const site = opts.siteId ? Prisma.sql`AND "siteId" = ${opts.siteId}` : Prisma.empty;
  const range = Prisma.sql`"createdAt" >= ${from} AND "createdAt" < ${to}`;
  const orderSite = opts.siteId ? { siteId: opts.siteId } : {};

  const [totals] = await db.$queryRaw<Array<Record<string, bigint | null>>>`
    SELECT
      COUNT(DISTINCT "visitorId") FILTER (WHERE type = 'page_view') AS visitors,
      COUNT(DISTINCT "sessionId") FILTER (WHERE type = 'page_view') AS visits,
      COUNT(*) FILTER (WHERE type = 'page_view') AS page_views,
      COUNT(DISTINCT "sessionId") FILTER (WHERE type = 'view_item') AS view_visits,
      COUNT(DISTINCT "sessionId") FILTER (WHERE type IN ('add_to_cart', 'begin_checkout')) AS intent_visits,
      COUNT(*) FILTER (WHERE type = 'begin_checkout') AS buy_clicks
    FROM "SiteEvent" WHERE ${range} ${site}`;

  const ordersCreated = await db.order.findMany({ where: { ...orderSite, createdAt: { gte: from, lt: to } }, select: { status: true, createdAt: true } });
  const paidOrders = await db.order.findMany({
    where: { ...orderSite, paidAt: { gte: from, lt: to }, status: { in: ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"] } },
    select: { totalCents: true, paidAt: true, utm: true, items: { select: { productId: true } } },
  });
  const stale = new Date(Date.now() - 2 * 3600_000);
  const outcomes = {
    created: ordersCreated.length,
    paid: ordersCreated.filter((o) => ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"].includes(o.status)).length,
    abandoned: ordersCreated.filter((o) => o.status === "CANCELLED" || (o.status === "PENDING" && o.createdAt < stale)).length,
    failed: ordersCreated.filter((o) => o.status === "FAILED").length,
    pending: ordersCreated.filter((o) => o.status === "PENDING" && o.createdAt >= stale).length,
  };

  const productRows = await db.$queryRaw<Array<{ productId: string; views: bigint; carts: bigint; buys: bigint }>>`
    SELECT "productId",
      COUNT(DISTINCT "sessionId") FILTER (WHERE type = 'view_item') AS views,
      COUNT(DISTINCT "sessionId") FILTER (WHERE type = 'add_to_cart') AS carts,
      COUNT(DISTINCT "sessionId") FILTER (WHERE type = 'begin_checkout') AS buys
    FROM "SiteEvent" WHERE ${range} ${site} AND "productId" IS NOT NULL AND type IN ('view_item', 'add_to_cart', 'begin_checkout')
    GROUP BY "productId"`;
  const checkoutItems = await db.orderItem.findMany({ where: { order: { ...orderSite, createdAt: { gte: from, lt: to } }, productId: { not: null } }, select: { productId: true } });
  const productIds = [...new Set([...productRows.map((r) => r.productId), ...checkoutItems.map((i) => i.productId!), ...paidOrders.flatMap((o) => o.items.map((i) => i.productId)).filter((x): x is string => !!x)])];
  const products = productIds.length ? await db.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true } }) : [];
  const nameOf = new Map(products.map((p) => [p.id, p.name]));
  const countBy = (ids: Array<string | null>) => ids.reduce((m, id) => (id ? m.set(id, (m.get(id) ?? 0) + 1) : m), new Map<string, number>());
  const checkoutsBy = countBy(checkoutItems.map((i) => i.productId));
  const paidBy = countBy(paidOrders.flatMap((o) => o.items.map((i) => i.productId)));
  const byProduct = productIds
    .filter((id) => nameOf.has(id))
    .map((id) => {
      const r = productRows.find((x) => x.productId === id);
      return { productId: id, name: nameOf.get(id)!, views: n(r?.views), carts: n(r?.carts), buyClicks: n(r?.buys), checkouts: checkoutsBy.get(id) ?? 0, paid: paidBy.get(id) ?? 0 };
    })
    .sort((a, b) => b.views - a.views || b.paid - a.paid)
    .slice(0, 30);

  // Source d'une visite : celle de sa première page vue
  const sourceRows = await db.$queryRaw<Array<{ source: string; visits: bigint; buy_visits: bigint }>>`
    WITH first AS (
      SELECT DISTINCT ON ("sessionId") "sessionId", COALESCE(source, 'direct') AS source, device
      FROM "SiteEvent" WHERE ${range} ${site} AND type = 'page_view' AND "sessionId" IS NOT NULL
      ORDER BY "sessionId", "createdAt" ASC
    ), buyers AS (
      SELECT DISTINCT "sessionId" FROM "SiteEvent" WHERE ${range} ${site} AND type = 'begin_checkout'
    )
    SELECT first.source, COUNT(*) AS visits, COUNT(buyers."sessionId") AS buy_visits
    FROM first LEFT JOIN buyers ON buyers."sessionId" = first."sessionId"
    GROUP BY first.source ORDER BY visits DESC LIMIT 15`;
  const deviceRows = await db.$queryRaw<Array<{ device: string; visits: bigint; buy_visits: bigint }>>`
    WITH first AS (
      SELECT DISTINCT ON ("sessionId") "sessionId", COALESCE(device, 'desktop') AS device
      FROM "SiteEvent" WHERE ${range} ${site} AND type = 'page_view' AND "sessionId" IS NOT NULL
      ORDER BY "sessionId", "createdAt" ASC
    ), buyers AS (
      SELECT DISTINCT "sessionId" FROM "SiteEvent" WHERE ${range} ${site} AND type = 'begin_checkout'
    )
    SELECT first.device, COUNT(*) AS visits, COUNT(buyers."sessionId") AS buy_visits
    FROM first LEFT JOIN buyers ON buyers."sessionId" = first."sessionId"
    GROUP BY first.device ORDER BY visits DESC`;
  // Page de sortie : dernière page vue des visites qui n'ont pas cliqué sur « Acheter »
  const exitRows = await db.$queryRaw<Array<{ path: string; visits: bigint }>>`
    WITH last AS (
      SELECT DISTINCT ON ("sessionId") "sessionId", path
      FROM "SiteEvent" WHERE ${range} ${site} AND type = 'page_view' AND "sessionId" IS NOT NULL
      ORDER BY "sessionId", "createdAt" DESC
    )
    SELECT COALESCE(path, '/') AS path, COUNT(*) AS visits FROM last
    WHERE "sessionId" NOT IN (SELECT DISTINCT "sessionId" FROM "SiteEvent" WHERE ${range} ${site} AND type = 'begin_checkout' AND "sessionId" IS NOT NULL)
    GROUP BY path ORDER BY visits DESC LIMIT 10`;
  const failureRows = await db.$queryRaw<Array<{ code: string; count: bigint }>>`
    SELECT COALESCE(detail, 'inconnu') AS code, COUNT(*) AS count FROM "SiteEvent"
    WHERE ${range} ${site} AND type = 'payment_failed' GROUP BY code ORDER BY count DESC`;
  const dailyRows = await db.$queryRaw<Array<{ day: string; visits: bigint }>>`
    SELECT to_char(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Paris', 'YYYY-MM-DD') AS day, COUNT(DISTINCT "sessionId") AS visits
    FROM "SiteEvent" WHERE ${range} ${site} AND type = 'page_view' GROUP BY day ORDER BY day`;

  const paidSource = new Map<string, { orders: number; revenueCents: number }>();
  for (const o of paidOrders) {
    const utm = (o.utm ?? {}) as Record<string, string>;
    const src = (utm.utm_source || (utm.fbclid ? "facebook" : utm.gclid ? "google" : "direct (sans lien de campagne)")).toLowerCase();
    const cur = paidSource.get(src) ?? { orders: 0, revenueCents: 0 };
    paidSource.set(src, { orders: cur.orders + 1, revenueCents: cur.revenueCents + o.totalCents });
  }

  // Série quotidienne complète (jours sans visite inclus)
  const dayKey = (d: Date) => new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  const paidPerDay = countBy(paidOrders.map((o) => (o.paidAt ? dayKey(o.paidAt) : null)));
  const visitsPerDay = new Map(dailyRows.map((r) => [r.day, n(r.visits)]));
  const daily: FunnelStats["daily"] = [];
  for (let t = from.getTime(); t < to.getTime(); t += 86400_000) {
    const day = dayKey(new Date(t));
    if (daily.length && daily[daily.length - 1].day === day) continue;
    daily.push({ day, visits: visitsPerDay.get(day) ?? 0, paid: paidPerDay.get(day) ?? 0 });
  }

  const visits = n(totals?.visits);
  return {
    from,
    to,
    visitors: n(totals?.visitors),
    visits,
    pageViews: n(totals?.page_views),
    buyClicks: n(totals?.buy_clicks),
    revenueCents: paidOrders.reduce((s, o) => s + o.totalCents, 0),
    steps: [
      { key: "visits", label: "Visites", count: visits },
      { key: "product", label: "Fiche produit vue", count: n(totals?.view_visits) },
      { key: "intent", label: "Panier ou clic « Acheter »", count: n(totals?.intent_visits) },
      { key: "checkout", label: "Page de paiement ouverte", count: outcomes.created },
      { key: "paid", label: "Paiement réussi", count: paidOrders.length },
    ],
    byProduct,
    bySource: sourceRows.map((r) => ({ source: r.source, visits: n(r.visits), buyVisits: n(r.buy_visits) })),
    paidBySource: [...paidSource.entries()].map(([source, v]) => ({ source, ...v })).sort((a, b) => b.revenueCents - a.revenueCents),
    byDevice: deviceRows.map((r) => ({ device: r.device, visits: n(r.visits), buyVisits: n(r.buy_visits) })),
    exitPages: exitRows.map((r) => ({ path: r.path, visits: n(r.visits) })),
    checkoutOutcomes: outcomes,
    paymentFailures: failureRows.map((r) => ({ code: r.code, label: DECLINE_LABELS[r.code] ?? r.code, count: n(r.count) })),
    daily,
  };
}
