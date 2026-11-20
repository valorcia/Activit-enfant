import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const sendNotification = vi.fn();
vi.mock("web-push", () => ({ default: { sendNotification: (...a: unknown[]) => sendNotification(...a), generateVAPIDKeys: () => ({ publicKey: "BPublicTestKey", privateKey: "privateTestKey" }) } }));
vi.mock("@/lib/integrations/secrets", () => ({
  getSecrets: async () => ({ "push.vapidPublicKey": "BPublicTestKey", "push.vapidPrivateKey": "privateTestKey" }),
  setSecret: async () => undefined,
}));

import { customerFromProof, signCustomerSession, verifyCustomerSession, CONFIRMATION_WINDOW_MS } from "@/lib/customers/session";
import { orderAccessUrl } from "@/lib/orders/access";
import { notifyNewOrder, notifyStaff, sendToSubscriptions } from "@/lib/push";
import { createProductFixture, db, DEFAULT_SITE_ID, ensureDefaultSite, resetDb } from "./helpers/db";

beforeEach(async () => {
  await resetDb();
  await ensureDefaultSite();
  sendNotification.mockReset();
});
afterAll(async () => { await db.$disconnect(); });

async function paidOrder(paidAt = new Date()) {
  const customer = await db.customer.create({ data: { email: "parent@example.com", name: "Camille" } });
  const product = await createProductFixture({ slug: "coquelicot", priceCents: 490 });
  const order = await db.order.create({
    data: { siteId: DEFAULT_SITE_ID, number: "CC-2026-000099", email: customer.email, customerId: customer.id, status: "PAID", paidAt, currency: "EUR", subtotalCents: 490, totalCents: 490, stripeCheckoutSessionId: "cs_live_test", items: { create: { productId: product.id, name: "Les bébés dinosaures", quantity: 1, unitPriceCents: 490, totalCents: 490 } } },
  });
  return { customer, order };
}

describe("compte client sans mot de passe", () => {
  it("signe et vérifie la session du client (un jeton de commande n'est pas une session)", async () => {
    expect(verifyCustomerSession(signCustomerSession("cus_1"))).toBe("cus_1");
    expect(verifyCustomerSession("n'importe.quoi.ici")).toBeNull();
    const orderToken = new URL(orderAccessUrl("ord_1")).pathname.split("/").pop()!;
    expect(verifyCustomerSession(orderToken)).toBeNull();
  });

  it("reconnaît le client par la session Stripe d'une commande payée récente, pas au-delà de 24 h", async () => {
    const { customer } = await paidOrder();
    expect(await customerFromProof({ kind: "session", sessionId: "cs_live_test" }, db)).toBe(customer.id);
    expect(await customerFromProof({ kind: "session", sessionId: "cs_live_test" }, db, new Date(Date.now() + CONFIRMATION_WINDOW_MS + 1000))).toBeNull();
    expect(await customerFromProof({ kind: "session", sessionId: "cs_inconnue" }, db)).toBeNull();
  });

  it("reconnaît le client par le lien de sa commande payée ou un lien d'accès valide", async () => {
    const { customer, order } = await paidOrder();
    const token = new URL(orderAccessUrl(order.id)).pathname.split("/").pop()!;
    expect(await customerFromProof({ kind: "order", token }, db)).toBe(customer.id);
    await db.order.update({ where: { id: order.id }, data: { status: "PENDING" } });
    expect(await customerFromProof({ kind: "order", token }, db)).toBeNull();
    await db.accessLink.create({ data: { customerId: customer.id, token: "tok_valide", expiresAt: new Date(Date.now() + 3600_000) } });
    await db.accessLink.create({ data: { customerId: customer.id, token: "tok_expire", expiresAt: new Date(Date.now() - 1000) } });
    expect(await customerFromProof({ kind: "access", token: "tok_valide" }, db)).toBe(customer.id);
    expect(await customerFromProof({ kind: "access", token: "tok_expire" }, db)).toBeNull();
  });
});

describe("notifications push de l'équipe", () => {
  async function user(email: string, role: "ADMIN" | "SUPPORT" | "MARKETING" | "EDITOR", isActive = true) {
    return db.user.create({ data: { email, passwordHash: "x", role, isActive } });
  }
  async function sub(userId: string, n: number) {
    return db.pushSubscription.create({ data: { userId, endpoint: `https://push.example/${n}`, p256dh: "p256dh-key-test", auth: "auth-key" } });
  }

  it("n'envoie qu'aux membres autorisés à voir les commandes, et sans l'e-mail du client", async () => {
    const admin = await user("admin@example.com", "ADMIN");
    const editor = await user("redac@example.com", "EDITOR");
    const off = await user("ancien@example.com", "SUPPORT", false);
    await sub(admin.id, 1);
    await sub(editor.id, 2);
    await sub(off.id, 3);
    sendNotification.mockResolvedValue({ statusCode: 201 });
    const { order } = await paidOrder();
    const r = await notifyNewOrder(order.id, db);
    expect(r.sent).toBe(1);
    expect(sendNotification).toHaveBeenCalledTimes(1);
    const [target, payload] = sendNotification.mock.calls[0] as [{ endpoint: string }, string];
    expect(target.endpoint).toBe("https://push.example/1");
    const data = JSON.parse(payload);
    expect(data.title).toBe("Nouvelle commande CC-2026-000099");
    expect(data.body).toContain("Les bébés dinosaures");
    expect(data.body).not.toContain("parent@example.com");
    expect(data.url).toBe(`/admin/commandes/${order.id}`);
    expect((await db.pushSubscription.findFirstOrThrow({ where: { userId: admin.id } })).lastSuccessAt).not.toBeNull();
  });

  it("supprime un abonnement expiré (410) et ne fait jamais échouer l'appelant", async () => {
    const admin = await user("admin@example.com", "ADMIN");
    const a = await sub(admin.id, 1);
    sendNotification.mockRejectedValue(Object.assign(new Error("Gone"), { statusCode: 410 }));
    expect(await sendToSubscriptions([a], { title: "t", body: "b", url: "/admin" }, db)).toEqual({ sent: 0, removed: 1 });
    expect(await db.pushSubscription.count()).toBe(0);
    expect(await notifyStaff({ title: "t", body: "b", url: "/admin" }, db)).toEqual({ sent: 0, removed: 0 });
  });
});
