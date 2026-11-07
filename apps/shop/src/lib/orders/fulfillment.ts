import type Stripe from "stripe";
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/db";
import { randomToken } from "@/lib/tokens";
import { nextInvoiceNumber } from "./numbers";

/**
 * Traitement des événements Stripe. Toutes les opérations sont idempotentes :
 *  - chaque événement n'est traité qu'une fois (table StripeEvent, clé = id Stripe) ;
 *  - une commande déjà PAID n'est jamais re-livrée (droits uniques par commande+produit).
 *
 * La livraison est déclenchée ici (confirmation serveur), jamais par la page de succès.
 */

export interface FulfillmentResult {
  orderId: string | null;
  status: "fulfilled" | "already_fulfilled" | "ignored" | "not_found" | "duplicate_event";
  entitlementIds: string[];
  email?: string;
}

type Db = PrismaClient | Prisma.TransactionClient;

export async function recordStripeEvent(db: PrismaClient, event: Pick<Stripe.Event, "id" | "type">): Promise<boolean> {
  try {
    await db.stripeEvent.create({ data: { id: event.id, type: event.type } });
    return true;
  } catch (e: unknown) {
    // Violation d'unicité → événement déjà traité
    if (typeof e === "object" && e && "code" in e && (e as { code: string }).code === "P2002") return false;
    throw e;
  }
}

export interface FulfillOptions {
  invoicePrefix?: string;
  maxDownloads?: number;
}

/**
 * Marque une commande comme payée et crée les droits de téléchargement.
 * Appelé depuis le webhook `checkout.session.completed` (payment_status = paid)
 * ou `checkout.session.async_payment_succeeded`.
 */
export async function fulfillOrderFromSession(
  session: Pick<Stripe.Checkout.Session, "id" | "payment_status" | "payment_intent" | "customer" | "customer_details" | "amount_total" | "currency"> & { total_details?: Stripe.Checkout.Session.TotalDetails | null },
  opts: FulfillOptions = {},
  db: PrismaClient = defaultPrisma,
): Promise<FulfillmentResult> {
  if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") {
    return { orderId: null, status: "ignored", entitlementIds: [] };
  }

  const order = await db.order.findUnique({
    where: { stripeCheckoutSessionId: session.id },
    include: { items: { include: { bundle: { include: { items: true } } } } },
  });
  if (!order) return { orderId: null, status: "not_found", entitlementIds: [] };
  if (order.status === "PAID" || order.status === "REFUNDED" || order.status === "PARTIALLY_REFUNDED") {
    const existing = await db.downloadEntitlement.findMany({ where: { orderId: order.id }, select: { id: true } });
    return { orderId: order.id, status: "already_fulfilled", entitlementIds: existing.map((e) => e.id), email: order.email };
  }

  const email = (session.customer_details?.email ?? order.email ?? "").toLowerCase();
  const name = session.customer_details?.name ?? null;
  const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null;
  const stripeCustomerId = typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;
  const now = new Date();

  // Produits à livrer : articles + contenu des packs (dédupliqués)
  const productIds = new Set<string>();
  for (const item of order.items) {
    if (item.productId) productIds.add(item.productId);
    if (item.bundle) for (const bi of item.bundle.items) productIds.add(bi.productId);
  }

  const result = await db.$transaction(async (tx) => {
    const customer = email
      ? await tx.customer.upsert({
          where: { email },
          create: { email, name, stripeCustomerId: stripeCustomerId ?? undefined },
          update: { name: name ?? undefined, stripeCustomerId: stripeCustomerId ?? undefined },
        })
      : null;

    const invoiceNumber = await nextInvoiceNumber(tx, opts.invoicePrefix ?? "FAC", now);

    await tx.order.update({
      where: { id: order.id },
      data: {
        status: "PAID",
        paidAt: now,
        email: email || order.email,
        customerId: customer?.id,
        stripePaymentIntentId: paymentIntentId ?? undefined,
        stripeCustomerId: stripeCustomerId ?? undefined,
        invoiceNumber,
        billingName: name,
        billingAddress: session.customer_details?.address ? (session.customer_details.address as unknown as Prisma.InputJsonValue) : undefined,
        discountCents: session.total_details?.amount_discount ?? order.discountCents,
        totalCents: session.amount_total ?? order.totalCents,
      },
    });

    if (paymentIntentId) {
      await tx.payment.upsert({
        where: { providerId: paymentIntentId },
        create: { orderId: order.id, provider: "stripe", providerId: paymentIntentId, status: "SUCCEEDED", amountCents: session.amount_total ?? order.totalCents, currency: (session.currency ?? order.currency).toUpperCase() },
        update: { status: "SUCCEEDED" },
      });
    }

    const entitlementIds: string[] = [];
    for (const productId of productIds) {
      const ent = await tx.downloadEntitlement.upsert({
        where: { orderId_productId: { orderId: order.id, productId } },
        create: { orderId: order.id, productId, customerId: customer?.id, token: randomToken(24), maxDownloads: opts.maxDownloads ?? 50 },
        update: {},
      });
      entitlementIds.push(ent.id);
      await tx.product.update({ where: { id: productId }, data: { salesCount: { increment: 1 } } });
    }
    for (const item of order.items) {
      if (item.bundleId) await tx.bundle.update({ where: { id: item.bundleId }, data: { salesCount: { increment: item.quantity } } });
    }
    if (order.couponId) {
      await tx.coupon.update({ where: { id: order.couponId }, data: { usedCount: { increment: 1 } } });
    }

    const day = new Date(now.toISOString().slice(0, 10));
    await tx.dailyStat.upsert({
      where: { date: day },
      create: { date: day, ordersPaid: 1, revenueCents: session.amount_total ?? order.totalCents },
      update: { ordersPaid: { increment: 1 }, revenueCents: { increment: session.amount_total ?? order.totalCents } },
    });

    await tx.marketingEvent.create({
      data: { type: "order.paid", email: email || null, payload: { orderId: order.id, orderNumber: order.number, totalCents: session.amount_total ?? order.totalCents, productIds: [...productIds] } },
    });

    return entitlementIds;
  });

  return { orderId: order.id, status: "fulfilled", entitlementIds: result, email: email || order.email };
}

export async function markOrderFailed(sessionOrIntentId: string, db: Db = defaultPrisma): Promise<void> {
  await db.order.updateMany({
    where: { OR: [{ stripeCheckoutSessionId: sessionOrIntentId }, { stripePaymentIntentId: sessionOrIntentId }], status: "PENDING" },
    data: { status: "FAILED" },
  });
}

export async function markOrderExpired(sessionId: string, db: Db = defaultPrisma): Promise<void> {
  await db.order.updateMany({ where: { stripeCheckoutSessionId: sessionId, status: "PENDING" }, data: { status: "CANCELLED", cancelledAt: new Date() } });
}

/** Applique un remboursement (partiel ou total) reçu de Stripe. */
export async function applyRefund(
  charge: { payment_intent: string | null; amount_refunded: number; amount: number; refunds?: { data: Array<{ id: string; amount: number; reason: string | null }> } | null },
  db: PrismaClient = defaultPrisma,
): Promise<string | null> {
  if (!charge.payment_intent) return null;
  const order = await db.order.findUnique({ where: { stripePaymentIntentId: charge.payment_intent } });
  if (!order) return null;
  const refundedCents = charge.amount_refunded;
  const full = refundedCents >= charge.amount;
  await db.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: order.id },
      data: { refundedCents, status: full ? "REFUNDED" : "PARTIALLY_REFUNDED" },
    });
    for (const r of charge.refunds?.data ?? []) {
      await tx.refund.upsert({
        where: { stripeRefundId: r.id },
        create: { orderId: order.id, stripeRefundId: r.id, amountCents: r.amount, reason: r.reason ?? undefined },
        update: {},
      });
    }
    if (full) {
      await tx.downloadEntitlement.updateMany({ where: { orderId: order.id, revokedAt: null }, data: { revokedAt: new Date() } });
      await tx.payment.updateMany({ where: { orderId: order.id }, data: { status: "REFUNDED" } });
    }
  });
  return order.id;
}
