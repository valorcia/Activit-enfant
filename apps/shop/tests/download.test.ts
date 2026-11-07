import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { authorizeDownload, createAccessLink, verifyOrderAccessToken, orderAccessUrl } from "@/lib/orders/access";
import { fulfillOrderFromSession } from "@/lib/orders/fulfillment";
import { createPendingOrder, createProductFixture, db, paidSession, resetDb } from "./helpers/db";

beforeEach(async () => { await resetDb(); });
afterAll(async () => { await db.$disconnect(); });

async function paidOrderWithEntitlement(sessionId = "cs_dl") {
  const product = await createProductFixture({ slug: `p-${sessionId}` }, 2);
  const order = await createPendingOrder({ sessionId, productIds: [product.id] });
  await fulfillOrderFromSession(paidSession(sessionId), { maxDownloads: 2 }, db);
  const ent = await db.downloadEntitlement.findFirstOrThrow({ where: { orderId: order.id } });
  return { product, order, ent };
}

describe("authorizeDownload", () => {
  it("autorise un téléchargement valide, journalise et incrémente le compteur", async () => {
    const { product, ent } = await paidOrderWithEntitlement();
    const res = await authorizeDownload(ent.token, product.files[0].id, { ip: "1.2.3.4", userAgent: "test" }, db);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.storageKey).toBe(product.files[0].storageKey);
      expect(res.fileName).toBe("kit-1.pdf");
    }
    const updated = await db.downloadEntitlement.findUniqueOrThrow({ where: { id: ent.id }, include: { downloads: true } });
    expect(updated.downloadCount).toBe(1);
    expect(updated.lastDownloadedAt).not.toBeNull();
    expect(updated.downloads).toHaveLength(1);
    expect(updated.downloads[0].ip).toBe("1.2.3.4");
  });

  it("refuse un jeton inconnu (404) et un fichier d'un autre produit (404)", async () => {
    const { product, ent } = await paidOrderWithEntitlement();
    const other = await createProductFixture({ slug: "autre" });
    expect(await authorizeDownload("jeton-inconnu", product.files[0].id, {}, db)).toMatchObject({ ok: false, status: 404 });
    expect(await authorizeDownload(ent.token, other.files[0].id, {}, db)).toMatchObject({ ok: false, status: 404 });
    expect((await db.downloadEntitlement.findUniqueOrThrow({ where: { id: ent.id } })).downloadCount).toBe(0);
  });

  it("refuse un droit révoqué (403) et une commande non payée (403)", async () => {
    const { product, ent, order } = await paidOrderWithEntitlement();
    await db.downloadEntitlement.update({ where: { id: ent.id }, data: { revokedAt: new Date() } });
    expect(await authorizeDownload(ent.token, product.files[0].id, {}, db)).toMatchObject({ ok: false, status: 403 });
    await db.downloadEntitlement.update({ where: { id: ent.id }, data: { revokedAt: null } });
    await db.order.update({ where: { id: order.id }, data: { status: "REFUNDED" } });
    expect(await authorizeDownload(ent.token, product.files[0].id, {}, db)).toMatchObject({ ok: false, status: 403 });
  });

  it("refuse un droit expiré (410)", async () => {
    const { product, ent } = await paidOrderWithEntitlement();
    await db.downloadEntitlement.update({ where: { id: ent.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await authorizeDownload(ent.token, product.files[0].id, {}, db)).toMatchObject({ ok: false, status: 410 });
  });

  it("applique le quota de téléchargements (429)", async () => {
    const { product, ent } = await paidOrderWithEntitlement();
    expect((await authorizeDownload(ent.token, product.files[0].id, {}, db)).ok).toBe(true);
    expect((await authorizeDownload(ent.token, product.files[1].id, {}, db)).ok).toBe(true);
    expect(await authorizeDownload(ent.token, product.files[0].id, {}, db)).toMatchObject({ ok: false, status: 429 });
  });
});

describe("liens d'accès", () => {
  it("génère et vérifie un jeton de commande signé", () => {
    const url = orderAccessUrl("order_123");
    const token = url.split("/commande/")[1];
    expect(verifyOrderAccessToken(token)).toBe("order_123");
    expect(verifyOrderAccessToken(token.slice(0, -2) + "zz")).toBeNull();
  });
  it("crée un lien magique uniquement pour un client existant", async () => {
    expect(await createAccessLink("inconnu@example.com", 24, db)).toBeNull();
    await db.customer.create({ data: { email: "client@example.com" } });
    const link = await createAccessLink("Client@Example.com", 24, db);
    expect(link?.url).toMatch(/\/mes-achats\/[A-Za-z0-9_-]+$/);
    const row = await db.accessLink.findFirstOrThrow();
    expect(row.expiresAt.getTime()).toBeGreaterThan(Date.now() + 23 * 3600_000);
  });
});
