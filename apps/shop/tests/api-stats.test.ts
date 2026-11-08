import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { excludingTax, productSalesStats } from "@/lib/api/stats";
import { authenticateApiKey, resetRateLimits } from "@/lib/api/auth";
import { sha256 } from "@/lib/tokens";
import { createProductFixture, db, resetDb } from "./helpers/db";

beforeEach(async () => { await resetDb(); resetRateLimits(); });
afterAll(async () => { await db.$disconnect(); });

async function paidOrder(productId: string, opts: { totalCents: number; itemCents: number; refundedCents?: number; status?: "PAID" | "PENDING" | "PARTIALLY_REFUNDED"; paidAt?: Date }) {
  return db.order.create({
    data: {
      number: `T-${Math.random().toString(36).slice(2, 9)}`, email: "c@example.com", status: opts.status ?? "PAID",
      subtotalCents: opts.totalCents, totalCents: opts.totalCents, refundedCents: opts.refundedCents ?? 0, paidAt: opts.paidAt ?? new Date(),
      items: { create: [{ productId, name: "Kit", unitPriceCents: opts.itemCents, quantity: 1, totalCents: opts.itemCents, taxRateBp: 2000 }] },
    },
  });
}

describe("statistiques de ventes par produit", () => {
  it("HT depuis TTC", () => {
    expect(excludingTax(1200, 2000)).toBe(1000);
    expect(excludingTax(990, 0)).toBe(990);
  });

  it("agrège les commandes payées, ignore les non payées, déduit les remboursements au prorata, sépare les 30 derniers jours", async () => {
    const p = await createProductFixture({ slug: "kit-stats" });
    await paidOrder(p.id, { totalCents: 1200, itemCents: 1200 });
    await paidOrder(p.id, { totalCents: 2400, itemCents: 1200, refundedCents: 1200, status: "PARTIALLY_REFUNDED" }); // moitié remboursée
    await paidOrder(p.id, { totalCents: 1200, itemCents: 1200, status: "PENDING" });
    await paidOrder(p.id, { totalCents: 1200, itemCents: 1200, paidAt: new Date(Date.now() - 60 * 24 * 3600 * 1000) });
    const s = await productSalesStats(p.id, db);
    expect(s.total.orders).toBe(3);
    expect(s.total.revenueCents).toBe(1200 + 600 + 1200);
    expect(s.total.refundedCents).toBe(600);
    expect(s.total.revenueNetCents).toBe(1000 + 500 + 1000);
    expect(s.last30Days.orders).toBe(2);
    expect(s.last30Days.revenueCents).toBe(1800);
  });

  it("une clé products:write peut lire le catalogue", async () => {
    await db.apiKey.create({ data: { name: "Studio", prefix: "cc_studi", keyHash: sha256("cc_studio"), scopes: ["products:write", "products:publish"] } });
    const req = new Request("http://localhost/api/v1/products", { headers: { authorization: "Bearer cc_studio" } });
    expect(await authenticateApiKey(req, "products:read", db)).toMatchObject({ ok: true });
  });
});
