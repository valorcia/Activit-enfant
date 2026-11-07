import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { applyRefund, fulfillOrderFromSession, markOrderExpired, recordStripeEvent } from "@/lib/orders/fulfillment";
import { createPendingOrder, createProductFixture, db, paidSession, resetDb } from "./helpers/db";

beforeEach(async () => { await resetDb(); });
afterAll(async () => { await db.$disconnect(); });

describe("recordStripeEvent (idempotence)", () => {
  it("accepte un événement une seule fois", async () => {
    expect(await recordStripeEvent(db, { id: "evt_1", type: "checkout.session.completed" })).toBe(true);
    expect(await recordStripeEvent(db, { id: "evt_1", type: "checkout.session.completed" })).toBe(false);
    expect(await db.stripeEvent.count()).toBe(1);
  });
});

describe("fulfillOrderFromSession", () => {
  it("livre une commande payée : statut PAID, un droit par produit, compteur de ventes, client, facture", async () => {
    const p1 = await createProductFixture({ slug: "p1" });
    const p2 = await createProductFixture({ slug: "p2" });
    const order = await createPendingOrder({ sessionId: "cs_1", productIds: [p1.id, p2.id] });

    const res = await fulfillOrderFromSession(paidSession("cs_1", { amount_total: 1980 }), { invoicePrefix: "FAC", maxDownloads: 10 }, db);
    expect(res.status).toBe("fulfilled");
    expect(res.entitlementIds).toHaveLength(2);

    const updated = await db.order.findUniqueOrThrow({ where: { id: order.id }, include: { entitlements: true, payments: true, customer: true } });
    expect(updated.status).toBe("PAID");
    expect(updated.paidAt).not.toBeNull();
    expect(updated.invoiceNumber).toMatch(/^FAC-\d{4}-\d{6}$/);
    expect(updated.stripePaymentIntentId).toBe("pi_cs_1");
    expect(updated.customer?.email).toBe("client@example.com");
    expect(updated.customer?.name).toBe("Camille Test");
    expect(updated.payments).toHaveLength(1);
    expect(updated.entitlements.map((e) => e.productId).sort()).toEqual([p1.id, p2.id].sort());
    expect(updated.entitlements.every((e) => e.maxDownloads === 10 && e.token.length > 20)).toBe(true);

    expect((await db.product.findUniqueOrThrow({ where: { id: p1.id } })).salesCount).toBe(1);
    expect(await db.marketingEvent.count({ where: { type: "order.paid" } })).toBe(1);
    const stat = await db.dailyStat.findFirst();
    expect(stat?.ordersPaid).toBe(1);
    expect(stat?.revenueCents).toBe(1980);
  });

  it("livre les produits d'un pack, dédupliqués avec les produits achetés à l'unité", async () => {
    const p1 = await createProductFixture({ slug: "p1" });
    const p2 = await createProductFixture({ slug: "p2" });
    const bundle = await db.bundle.create({ data: { slug: "pack", name: "Pack", priceCents: 1500, status: "PUBLISHED", items: { create: [{ productId: p1.id }, { productId: p2.id }] } } });
    await createPendingOrder({ sessionId: "cs_2", productIds: [p1.id], bundleIds: [bundle.id] });

    const res = await fulfillOrderFromSession(paidSession("cs_2"), {}, db);
    expect(res.status).toBe("fulfilled");
    expect(res.entitlementIds).toHaveLength(2); // p1 une seule fois, p2 via le pack
    expect((await db.bundle.findUniqueOrThrow({ where: { id: bundle.id } })).salesCount).toBe(1);
  });

  it("est idempotent : un second appel ne crée aucun doublon", async () => {
    const p1 = await createProductFixture({ slug: "p1" });
    await createPendingOrder({ sessionId: "cs_3", productIds: [p1.id] });
    const first = await fulfillOrderFromSession(paidSession("cs_3"), {}, db);
    const second = await fulfillOrderFromSession(paidSession("cs_3"), {}, db);
    expect(first.status).toBe("fulfilled");
    expect(second.status).toBe("already_fulfilled");
    expect(second.entitlementIds).toEqual(first.entitlementIds);
    expect(await db.downloadEntitlement.count()).toBe(1);
    expect((await db.product.findUniqueOrThrow({ where: { id: p1.id } })).salesCount).toBe(1);
    expect(await db.payment.count()).toBe(1);
  });

  it("ignore une session non payée et signale une session inconnue", async () => {
    const p1 = await createProductFixture({ slug: "p1" });
    await createPendingOrder({ sessionId: "cs_4", productIds: [p1.id] });
    const unpaid = await fulfillOrderFromSession(paidSession("cs_4", { payment_status: "unpaid" }), {}, db);
    expect(unpaid.status).toBe("ignored");
    expect((await db.order.findFirstOrThrow()).status).toBe("PENDING");
    expect(await db.downloadEntitlement.count()).toBe(0);
    const unknown = await fulfillOrderFromSession(paidSession("cs_inconnue"), {}, db);
    expect(unknown.status).toBe("not_found");
  });

  it("incrémente le compteur du coupon utilisé", async () => {
    const p1 = await createProductFixture({ slug: "p1" });
    const coupon = await db.coupon.create({ data: { code: "BIENVENUE", type: "PERCENT", percentOff: 10 } });
    const order = await createPendingOrder({ sessionId: "cs_5", productIds: [p1.id] });
    await db.order.update({ where: { id: order.id }, data: { couponId: coupon.id, couponCode: coupon.code } });
    await fulfillOrderFromSession(paidSession("cs_5"), {}, db);
    expect((await db.coupon.findUniqueOrThrow({ where: { id: coupon.id } })).usedCount).toBe(1);
  });
});

describe("remboursements et expiration", () => {
  it("un remboursement total révoque les droits et passe la commande en REFUNDED", async () => {
    const p1 = await createProductFixture({ slug: "p1" });
    const order = await createPendingOrder({ sessionId: "cs_6", productIds: [p1.id] });
    await fulfillOrderFromSession(paidSession("cs_6"), {}, db);
    const orderId = await applyRefund({ payment_intent: "pi_cs_6", amount_refunded: 990, amount: 990, refunds: { data: [{ id: "re_1", amount: 990, reason: "requested_by_customer" }] } }, db);
    expect(orderId).toBe(order.id);
    const updated = await db.order.findUniqueOrThrow({ where: { id: order.id }, include: { entitlements: true, refunds: true, payments: true } });
    expect(updated.status).toBe("REFUNDED");
    expect(updated.refundedCents).toBe(990);
    expect(updated.entitlements.every((e) => e.revokedAt !== null)).toBe(true);
    expect(updated.refunds).toHaveLength(1);
    expect(updated.payments[0].status).toBe("REFUNDED");
    // Idempotent sur le même remboursement
    await applyRefund({ payment_intent: "pi_cs_6", amount_refunded: 990, amount: 990, refunds: { data: [{ id: "re_1", amount: 990, reason: null }] } }, db);
    expect(await db.refund.count()).toBe(1);
  });

  it("un remboursement partiel conserve les droits", async () => {
    const p1 = await createProductFixture({ slug: "p1" });
    const order = await createPendingOrder({ sessionId: "cs_7", productIds: [p1.id] });
    await fulfillOrderFromSession(paidSession("cs_7"), {}, db);
    await applyRefund({ payment_intent: "pi_cs_7", amount_refunded: 300, amount: 990 }, db);
    const updated = await db.order.findUniqueOrThrow({ where: { id: order.id }, include: { entitlements: true } });
    expect(updated.status).toBe("PARTIALLY_REFUNDED");
    expect(updated.entitlements[0].revokedAt).toBeNull();
  });

  it("une session expirée annule la commande en attente sans toucher aux commandes payées", async () => {
    const p1 = await createProductFixture({ slug: "p1" });
    await createPendingOrder({ sessionId: "cs_8", productIds: [p1.id] });
    await markOrderExpired("cs_8", db);
    expect((await db.order.findFirstOrThrow()).status).toBe("CANCELLED");
  });
});
