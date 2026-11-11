import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { fulfillOrderFromSession } from "@/lib/orders/fulfillment";
import { buyersAwaitingFiles } from "@/lib/orders/files-ready";
import { CheckoutError, priceCart } from "@/lib/orders/checkout";
import { createPendingOrder, createProductFixture, db, paidSession, resetDb } from "./helpers/db";

beforeEach(async () => { await resetDb(); });
afterAll(async () => { await db.$disconnect(); });

describe("produit sans fichier", () => {
  it("refuse l'achat d'un produit qui n'a aucun fichier à livrer", async () => {
    const p = await createProductFixture({ slug: "vide" }, 0);
    await expect(priceCart([{ kind: "product", id: p.id, quantity: 1 }])).rejects.toMatchObject({ code: "NOT_DOWNLOADABLE" });
    await expect(priceCart([{ kind: "product", id: p.id, quantity: 1 }])).rejects.toBeInstanceOf(CheckoutError);
  });

  it("refuse un pack dont un produit n'a aucun fichier", async () => {
    const ok = await createProductFixture({ slug: "ok" });
    const vide = await createProductFixture({ slug: "vide" }, 0);
    const b = await db.bundle.create({ data: { slug: "pack", name: "Pack", priceCents: 1500, status: "PUBLISHED", items: { create: [{ productId: ok.id }, { productId: vide.id }] } } });
    await expect(priceCart([{ kind: "bundle", id: b.id, quantity: 1 }])).rejects.toMatchObject({ code: "NOT_DOWNLOADABLE" });
  });

  it("accepte un produit avec fichier", async () => {
    const p = await createProductFixture({ slug: "plein" });
    const lines = await priceCart([{ kind: "product", id: p.id, quantity: 1 }]);
    expect(lines).toHaveLength(1);
  });

  it("liste une seule fois chaque commande payée à prévenir, jamais les remboursées", async () => {
    const p = await createProductFixture({ slug: "kit" });
    await createPendingOrder({ sessionId: "cs_a", productIds: [p.id] });
    await fulfillOrderFromSession(paidSession("cs_a"), {}, db);
    const refunded = await createPendingOrder({ sessionId: "cs_b", productIds: [p.id] });
    await fulfillOrderFromSession(paidSession("cs_b"), {}, db);
    await db.order.update({ where: { id: refunded.id }, data: { status: "REFUNDED" } });

    const buyers = await buyersAwaitingFiles(p.id, db);
    expect(buyers).toHaveLength(1);
    expect(buyers[0].email).toBe("client@example.com");
  });
});
