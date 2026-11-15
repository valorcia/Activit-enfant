import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn(), unstable_cache: (fn: unknown) => fn }));
const sent: Array<{ to: string; subject: string; text?: string }> = [];
let cookieValue: string | undefined;
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (n: string) => (n === "creator_session" && cookieValue ? { value: cookieValue } : undefined) }), headers: async () => new Headers() }));
vi.mock("@/lib/email", () => ({ sendEmail: vi.fn(async (msg: { to: string; subject: string; text?: string }) => { sent.push(msg); return { ok: true, id: "test" }; }) }));

import { NextRequest } from "next/server";
import { creatorsSettingsSchema } from "@/lib/schemas/settings";
import { applyRefund, fulfillOrderFromSession } from "@/lib/orders/fulfillment";
import { computeOrderCommissions, confirmDueCommissions, createCommissionsForOrder, estimateStripeFee, runDailyCreatorJobs, type CommissionOrderItem } from "@/lib/creators/commissions";
import { markPayoutPaid, payoutsCsv, preparePayouts } from "@/lib/creators/payouts";
import { decryptIban, encryptIban, isValidIban, maskIban, normalizeIban } from "@/lib/creators/iban";
import { consumeLoginToken, creatorFromSession } from "@/lib/creators/auth";
import { CREATOR_SESSION_COOKIE, createLoginToken, createSessionToken, verifyLoginToken, verifySessionToken } from "@/lib/creators/tokens";
import { inviteCreator, linkSubmissionToProduct, markPreviewReady, moderateSubmission, startProduction, approvePreview } from "@/lib/creators/service";
import { submissionInputSchema, submitProblems } from "@/lib/creators/submissions";
import { sha256, signPayload } from "@/lib/tokens";
import { resetRateLimits } from "@/lib/api/auth";
import { createPendingOrder, createProductFixture, db, paidSession, resetDb } from "./helpers/db";

const settings = creatorsSettingsSchema.parse({});

beforeEach(async () => { await resetDb(); sent.length = 0; resetRateLimits(); cookieValue = undefined; });
afterAll(async () => { await db.$disconnect(); });

async function creatorFixture(overrides: Partial<{ email: string; status: "INVITED" | "ACTIVE" | "SUSPENDED"; defaultRateBp: number | null; publicName: string; slug: string }> = {}) {
  return db.creator.create({
    data: { name: "Marie Dupont", email: overrides.email ?? "marie@example.com", status: overrides.status ?? "ACTIVE", defaultRateBp: overrides.defaultRateBp ?? null, publicName: overrides.publicName ?? "Marie", slug: overrides.slug ?? "marie", contractVersion: "2026-11-v1", contractAcceptedAt: new Date() },
  });
}

async function creatorProduct(creatorId: string, opts: { slug?: string; priceCents?: number; rateBp?: number | null } = {}) {
  const p = await createProductFixture({ slug: opts.slug ?? `tuto-${Math.random().toString(36).slice(2, 7)}`, priceCents: opts.priceCents ?? 390 });
  return db.product.update({ where: { id: p.id }, data: { creatorId, creatorRateBp: opts.rateBp === undefined ? 2500 : opts.rateBp } });
}

/** Commande en attente avec des lignes au prix réel des produits (TVA 20 %). */
async function orderFor(sessionId: string, lines: Array<{ productId?: string; bundleId?: string; totalCents: number }>, email = "client@example.com", discountCents = 0) {
  const subtotal = lines.reduce((s, l) => s + l.totalCents, 0);
  return db.order.create({
    data: {
      number: `CC-T-${Math.random().toString(36).slice(2, 8)}`, email, status: "PENDING", subtotalCents: subtotal, discountCents, totalCents: subtotal - discountCents, stripeCheckoutSessionId: sessionId,
      items: { create: lines.map((l) => ({ productId: l.productId, bundleId: l.bundleId, name: "Ligne", unitPriceCents: l.totalCents, quantity: 1, totalCents: l.totalCents, taxRateBp: 2000 })) },
    },
  });
}

const item = (id: string, totalCents: number, product: CommissionOrderItem["product"], bundle: CommissionOrderItem["bundle"] = null): CommissionOrderItem => ({ id, totalCents, taxRateBp: 2000, product, bundle });
const prod = (id: string, priceCents: number, creator: { id: string; email: string; defaultRateBp?: number | null } | null, rateBp: number | null = null) => ({ id, priceCents, creatorId: creator?.id ?? null, creatorRateBp: rateBp, creator: creator ? { id: creator.id, email: creator.email, defaultRateBp: creator.defaultRateBp ?? null } : null });

describe("calcul des commissions (pur)", () => {
  const marie = { id: "c1", email: "marie@example.com" };

  it("tutoriel à 3,90 € TTC à 25 % : base HT moins frais Stripe estimés (1,5 % + 0,25 €)", () => {
    expect(estimateStripeFee(390, settings)).toBe(31); // 5,85 + 25 = 30,85 → 31
    const lines = computeOrderCommissions({ email: "client@example.com", totalCents: 390, items: [item("i1", 390, prod("p1", 390, marie, 2500))] }, settings);
    expect(lines).toEqual([{ orderItemId: "i1", productId: "p1", creatorId: "c1", baseCents: 294, rateBp: 2500, amountCents: 74 }]); // 325 − 31 = 294 ; 25 % ≈ 0,74 €
  });

  it("répartit la remise et les frais Stripe au prorata des lignes", () => {
    // Deux lignes (390 + 1 210 = 1 600), remise de 400 → payé 1 200 ; frais = 18 + 25 = 43
    const lines = computeOrderCommissions({ email: "x@example.com", totalCents: 1200, items: [item("i1", 390, prod("p1", 390, marie, 4000)), item("i2", 1210, prod("p2", 1210, null))] }, settings);
    expect(lines).toHaveLength(1);
    const lineTtc = (390 * 1200) / 1600; // 292,5
    const expectedBase = lineTtc / 1.2 - (43 * lineTtc) / 1200; // 243,75 − 10,48 = 233,27
    expect(lines[0].baseCents).toBe(Math.round(expectedBase));
    expect(lines[0].amountCents).toBe(Math.round((expectedBase * 4000) / 10000)); // 93
  });

  it("pack : part au prorata du prix des produits du pack", () => {
    const bundle = { items: [{ product: prod("p1", 390, marie, 2500) }, { product: prod("p2", 1170, null) }] };
    const lines = computeOrderCommissions({ email: "x@example.com", totalCents: 1000, items: [item("i1", 1000, null, bundle)] }, settings);
    const base = (1000 / 1.2 - estimateStripeFee(1000, settings)) * (390 / 1560); // 25 % du pack
    expect(lines).toEqual([{ orderItemId: "i1", productId: "p1", creatorId: "c1", baseCents: Math.round(base), rateBp: 2500, amountCents: Math.round(base * 0.25) }]);
  });

  it("taux : produit, sinon taux par défaut de la créatrice, sinon « idée seule »", () => {
    const a = computeOrderCommissions({ email: "x@example.com", totalCents: 390, items: [item("i1", 390, prod("p1", 390, { ...marie, defaultRateBp: 3000 }))] }, settings);
    expect(a[0].rateBp).toBe(3000);
    const b = computeOrderCommissions({ email: "x@example.com", totalCents: 390, items: [item("i1", 390, prod("p1", 390, marie))] }, settings);
    expect(b[0].rateBp).toBe(settings.ideaRateBp);
  });

  it("aucune commission sur ses propres achats (même e-mail, casse ignorée)", () => {
    expect(computeOrderCommissions({ email: " Marie@Example.com ", totalCents: 390, items: [item("i1", 390, prod("p1", 390, marie, 2500))] }, settings)).toEqual([]);
  });
});

describe("commissions et commandes", () => {
  it("crée une commission en attente au paiement, de façon idempotente", async () => {
    const c = await creatorFixture();
    const p = await creatorProduct(c.id);
    const order = await orderFor("cs_c1", [{ productId: p.id, totalCents: 390 }]);
    await fulfillOrderFromSession(paidSession("cs_c1", { amount_total: 390 }), {}, db);
    await fulfillOrderFromSession(paidSession("cs_c1", { amount_total: 390 }), {}, db);
    expect(await createCommissionsForOrder(order.id, db)).toBe(0);
    const entries = await db.commissionEntry.findMany();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ status: "PENDING", creatorId: c.id, productId: p.id, baseCents: 294, amountCents: 74, rateBp: 2500, kind: "ROYALTY" });
  });

  it("pack et remise : commission au prorata", async () => {
    const c = await creatorFixture();
    const p1 = await creatorProduct(c.id, { priceCents: 390 });
    const p2 = await createProductFixture({ slug: "autre", priceCents: 1170 });
    const bundle = await db.bundle.create({ data: { slug: "pack", name: "Pack", priceCents: 1200, status: "PUBLISHED", items: { create: [{ productId: p1.id }, { productId: p2.id }] } } });
    await orderFor("cs_pack", [{ bundleId: bundle.id, totalCents: 1200 }], "client@example.com", 200);
    await fulfillOrderFromSession(paidSession("cs_pack", { amount_total: 1000, total_details: { amount_discount: 200, amount_shipping: 0, amount_tax: 0 } }), {}, db);
    const [e] = await db.commissionEntry.findMany();
    const base = (1000 / 1.2 - estimateStripeFee(1000, settings)) * 0.25;
    expect(e.baseCents).toBe(Math.round(base));
    expect(e.amountCents).toBe(Math.round(base * 0.25));
  });

  it("pas de commission quand la créatrice achète son propre tutoriel", async () => {
    const c = await creatorFixture();
    const p = await creatorProduct(c.id);
    await orderFor("cs_self", [{ productId: p.id, totalCents: 390 }], "marie@example.com");
    await fulfillOrderFromSession(paidSession("cs_self", { amount_total: 390, customer_details: { email: "MARIE@example.com", name: "Marie", address: null, phone: null, tax_exempt: null, tax_ids: null } }), {}, db);
    expect(await db.commissionEntry.count()).toBe(0);
  });

  it("remboursement total : commission annulée ; partiel : réduite au prorata (idempotent)", async () => {
    const c = await creatorFixture();
    const p1 = await creatorProduct(c.id, { slug: "t1" });
    const p2 = await creatorProduct(c.id, { slug: "t2" });
    await orderFor("cs_r1", [{ productId: p1.id, totalCents: 390 }]);
    await orderFor("cs_r2", [{ productId: p2.id, totalCents: 390 }]);
    await fulfillOrderFromSession(paidSession("cs_r1", { amount_total: 390, payment_intent: "pi_r1" }), {}, db);
    await fulfillOrderFromSession(paidSession("cs_r2", { amount_total: 390, payment_intent: "pi_r2" }), {}, db);

    await applyRefund({ payment_intent: "pi_r1", amount_refunded: 390, amount: 390 }, db);
    const full = await db.commissionEntry.findFirstOrThrow({ where: { productId: p1.id } });
    expect(full).toMatchObject({ status: "CANCELLED", amountCents: 0, originalAmountCents: 74 });

    await applyRefund({ payment_intent: "pi_r2", amount_refunded: 195, amount: 390 }, db);
    await applyRefund({ payment_intent: "pi_r2", amount_refunded: 195, amount: 390 }, db); // rejoué
    const partial = await db.commissionEntry.findFirstOrThrow({ where: { productId: p2.id } });
    expect(partial).toMatchObject({ status: "PENDING", amountCents: 37, baseCents: 147 });
  });

  it("remboursement après paiement : régularisation négative déduite du paiement suivant", async () => {
    const c = await creatorFixture();
    const p = await creatorProduct(c.id, { rateBp: 4000 });
    await orderFor("cs_paid", [{ productId: p.id, totalCents: 390 }]);
    await fulfillOrderFromSession(paidSession("cs_paid", { amount_total: 390, payment_intent: "pi_paid" }), {}, db);
    await db.commissionEntry.updateMany({ data: { status: "PAID", paidAt: new Date() } });
    await applyRefund({ payment_intent: "pi_paid", amount_refunded: 390, amount: 390 }, db);
    await applyRefund({ payment_intent: "pi_paid", amount_refunded: 390, amount: 390 }, db);
    const adj = await db.commissionEntry.findMany({ where: { kind: "ADJUSTMENT" } });
    expect(adj).toHaveLength(1);
    expect(adj[0]).toMatchObject({ status: "CONFIRMED", amountCents: -118 }); // 294 × 40 % = 117,6 → 118
    expect((await db.commissionEntry.findFirstOrThrow({ where: { kind: "ROYALTY" } })).status).toBe("PAID");
  });

  it("confirme automatiquement après le délai de remboursement, pas avant", async () => {
    const c = await creatorFixture();
    const p = await creatorProduct(c.id);
    const order = await orderFor("cs_conf", [{ productId: p.id, totalCents: 390 }]);
    await fulfillOrderFromSession(paidSession("cs_conf", { amount_total: 390 }), {}, db);
    const paidAt = (await db.order.findUniqueOrThrow({ where: { id: order.id } })).paidAt!;
    expect(await confirmDueCommissions(db, new Date(paidAt.getTime() + 13 * 86400_000), settings)).toBe(0);
    expect(await confirmDueCommissions(db, new Date(paidAt.getTime() + 14 * 86400_000 + 1000), settings)).toBe(1);
    expect((await db.commissionEntry.findFirstOrThrow()).status).toBe("CONFIRMED");
  });

  it("tâche quotidienne : rattrape une commande payée sans commission", async () => {
    const c = await creatorFixture();
    const p = await creatorProduct(c.id);
    const order = await orderFor("cs_bf", [{ productId: p.id, totalCents: 390 }]);
    await db.order.update({ where: { id: order.id }, data: { status: "PAID", paidAt: new Date() } });
    const r = await runDailyCreatorJobs(db);
    expect(r.backfilled).toBe(1);
    expect(await db.commissionEntry.count()).toBe(1);
  });
});

describe("paiements", () => {
  async function confirmed(creatorId: string, amounts: number[]) {
    const p = await creatorProduct(creatorId);
    for (const [i, amount] of amounts.entries()) {
      const order = await orderFor(`cs_${creatorId}_${i}_${Math.random()}`, [{ productId: p.id, totalCents: 390 }]);
      const it = await db.orderItem.findFirstOrThrow({ where: { orderId: order.id } });
      await db.commissionEntry.create({ data: { orderId: order.id, orderItemId: it.id, productId: p.id, creatorId, baseCents: amount * 4, originalBaseCents: amount * 4, rateBp: 2500, amountCents: amount, originalAmountCents: amount, status: "CONFIRMED" } });
    }
  }

  it("regroupe les commissions confirmées par créatrice, au-delà du seuil seulement", async () => {
    const a = await creatorFixture({ email: "a@example.com", slug: "a" });
    const b = await creatorFixture({ email: "b@example.com", slug: "b" });
    await confirmed(a.id, [1500, 800]); // 23 € ≥ 20 €
    await confirmed(b.id, [900]); // 9 € < 20 €
    const now = new Date("2026-11-30T10:00:00Z");
    const r = await preparePayouts(db, now, 2000);
    expect(r).toMatchObject({ period: "2026-11", created: 1, updated: 0 });
    expect(r.belowThreshold).toEqual([{ creatorId: b.id, totalCents: 900 }]);
    const payout = await db.creatorPayout.findFirstOrThrow({ include: { entries: true } });
    expect(payout).toMatchObject({ creatorId: a.id, totalCents: 2300, status: "PENDING" });
    expect(payout.entries).toHaveLength(2);
    // Idempotent : rien de plus à regrouper
    expect((await preparePayouts(db, now, 2000)).created).toBe(0);
    expect(await db.creatorPayout.count()).toBe(1);

    await markPayoutPaid(payout.id, "VIR-2026-11-01", {}, db);
    expect(await db.commissionEntry.count({ where: { creatorId: a.id, status: "PAID" } })).toBe(2);
    expect((await db.creatorPayout.findUniqueOrThrow({ where: { id: payout.id } })).reference).toBe("VIR-2026-11-01");
    await expect(markPayoutPaid(payout.id, " ", {}, db)).rejects.toThrow(/Référence/);
  });

  it("export CSV : IBAN déchiffré uniquement dans l'export", async () => {
    const a = await creatorFixture({ email: "a@example.com", slug: "a" });
    await db.creator.update({ where: { id: a.id }, data: { ...encryptIban("FR76 3000 6000 0112 3456 7890 189"), ibanHolder: "Marie Dupont" } });
    await confirmed(a.id, [2500]);
    await preparePayouts(db, new Date("2026-11-30T10:00:00Z"), 2000);
    const { csv, count } = await payoutsCsv("2026-11", db);
    expect(count).toBe(1);
    expect(csv).toContain("FR76 3000 6000 0112 3456 7890 189");
    expect(csv).toContain("25,00");
    const stored = await db.creator.findUniqueOrThrow({ where: { id: a.id } });
    expect(JSON.stringify(stored)).not.toContain("30006000011234567890189");
  });
});

describe("IBAN", () => {
  it("valide la clé, chiffre et ne garde que les 4 derniers caractères en clair", () => {
    expect(isValidIban("FR76 3000 6000 0112 3456 7890 189")).toBe(true);
    expect(isValidIban("FR76 3000 6000 0112 3456 7890 188")).toBe(false);
    expect(isValidIban("BE68 5390 0754 7034")).toBe(true);
    expect(isValidIban("pas un iban")).toBe(false);
    const { ibanEnc, ibanLast4 } = encryptIban("fr76 3000 6000 0112 3456 7890 189");
    expect(ibanLast4).toBe("0189".slice(-4));
    expect(ibanEnc).not.toContain("3000");
    expect(ibanEnc.startsWith("v1.")).toBe(true);
    expect(decryptIban(ibanEnc)).toBe(normalizeIban("FR7630006000011234567890189"));
    expect(encryptIban("FR7630006000011234567890189").ibanEnc).not.toBe(ibanEnc); // IV aléatoire
    expect(() => encryptIban("FR76 1234")).toThrow(/IBAN invalide/);
    expect(maskIban("0189")).toBe("•••• •••• •••• 0189");
  });
});

describe("lien magique et session", () => {
  it("lien valide : connexion, puis refusé une seconde fois (usage unique)", async () => {
    const c = await creatorFixture();
    const token = createLoginToken(c.id, 3600);
    const first = await consumeLoginToken(token, db);
    expect(first.ok).toBe(true);
    if (first.ok) expect(verifySessionToken(first.sessionToken)).toEqual({ creatorId: c.id, version: 1 });
    expect(await consumeLoginToken(token, db, Date.now() + 1000)).toEqual({ ok: false, reason: "used" });
  });

  it("refuse un lien expiré, falsifié, d'une autre nature ou d'une créatrice suspendue", async () => {
    const c = await creatorFixture();
    const now = Date.now();
    const expired = createLoginToken(c.id, 60, now - 3600_000);
    expect(await consumeLoginToken(expired, db)).toEqual({ ok: false, reason: "invalid" });
    const token = createLoginToken(c.id, 3600);
    const [payload, exp, sig] = token.split(".");
    const forged = `${Buffer.from(`clogin:autre:${now}`).toString("base64url")}.${exp}.${sig}`;
    expect(verifyLoginToken(forged)).toBeNull();
    expect(verifyLoginToken(`${payload}.${Number(exp) + 999}.${sig}`)).toBeNull();
    // Jeton signé avec le secret des téléchargements / commandes : refusé
    expect(verifyLoginToken(signPayload(`clogin:${c.id}:${now}`, Math.floor(now / 1000) + 3600))).toBeNull();
    // Un jeton de session n'est pas un lien de connexion
    expect(verifyLoginToken(createSessionToken(c.id, 1))).toBeNull();
    await db.creator.update({ where: { id: c.id }, data: { status: "SUSPENDED" } });
    expect(await consumeLoginToken(createLoginToken(c.id, 3600), db)).toEqual({ ok: false, reason: "suspended" });
  });

  it("session : refusée si falsifiée, expirée, version révoquée ou compte suspendu", async () => {
    const c = await creatorFixture();
    const token = createSessionToken(c.id, 1);
    expect((await creatorFromSession(token, db))?.id).toBe(c.id);
    expect(await creatorFromSession(token.slice(0, -2) + "xx", db)).toBeNull();
    expect(await creatorFromSession(createSessionToken(c.id, 1, Date.now() - 40 * 86400_000), db)).toBeNull();
    await db.creator.update({ where: { id: c.id }, data: { sessionVersion: 2 } });
    expect(await creatorFromSession(token, db)).toBeNull();
    const t2 = createSessionToken(c.id, 2);
    expect(await creatorFromSession(t2, db)).not.toBeNull();
    await db.creator.update({ where: { id: c.id }, data: { status: "SUSPENDED" } });
    expect(await creatorFromSession(t2, db)).toBeNull();
  });
});

describe("protection des routes de l'espace créatrice", () => {
  it("redirige vers la connexion sans session, laisse passer la page de connexion", async () => {
    const { proxy } = await import("@/proxy");
    const res = await proxy(new NextRequest("http://localhost:3000/espace-createur/idees"));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/espace-createur/connexion");
    const login = await proxy(new NextRequest("http://localhost:3000/espace-createur/connexion?jeton=abc"));
    expect(login.status).toBe(200);
    expect(login.headers.get("location")).toBeNull();
    expect(login.headers.get("x-middleware-rewrite")).toBeNull(); // pas de réécriture multi-univers
  });

  it("renvoie 401 pour l'API créatrice sans session ou avec un cookie falsifié", async () => {
    const { proxy } = await import("@/proxy");
    expect((await proxy(new NextRequest("http://localhost:3000/api/createur/upload", { method: "POST" }))).status).toBe(401);
    const forged = new NextRequest("http://localhost:3000/api/createur/upload", { method: "POST", headers: { cookie: `${CREATOR_SESSION_COOKIE}=${signPayload("csess:abc:1", Math.floor(Date.now() / 1000) + 3600)}` } });
    expect((await proxy(forged)).status).toBe(401);
  });

  it("laisse passer une session valide", async () => {
    const { proxy } = await import("@/proxy");
    const res = await proxy(new NextRequest("http://localhost:3000/espace-createur", { headers: { cookie: `${CREATOR_SESSION_COOKIE}=${createSessionToken("abc123", 1)}` } }));
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it("route d'envoi de photo : 401 sans session, 403 pour un compte non actif", async () => {
    const { POST } = await import("@/app/api/createur/upload/route");
    const call = () => POST(new Request("http://localhost/api/createur/upload", { method: "POST", body: new FormData() }));
    cookieValue = undefined;
    expect((await call()).status).toBe(401);
    const c = await creatorFixture({ status: "INVITED" });
    cookieValue = createSessionToken(c.id, 1);
    expect((await call()).status).toBe(403);
    await db.creator.update({ where: { id: c.id }, data: { status: "ACTIVE" } });
    expect((await call()).status).toBe(400); // fichier manquant
    cookieValue = undefined;
  });
});

describe("modération et suivi par le studio", () => {
  async function submitted(creatorId: string, contribution: "IDEA" | "FULL_TUTORIAL" = "IDEA", exclusive = false) {
    return db.creatorSubmission.create({ data: { creatorId, title: "Le hérisson dans sa bulle", status: "SUBMITTED", submittedAt: new Date(), contribution, exclusive, materials: ["bocal"], steps: ["Étape 1"], photos: [{ key: `private/creators/${creatorId}/a.jpg` }] } });
  }

  it("invitation : e-mail avec lien de connexion", async () => {
    const c = await inviteCreator({ name: "Angélique", email: "Angelique@Example.com" }, db);
    expect(c).toMatchObject({ email: "angelique@example.com", status: "INVITED" });
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("angelique@example.com");
    expect(sent[0].text).toMatch(/\/espace-createur\/connexion\?jeton=/);
  });

  it("accepter fixe le taux (apport + exclusivité) ; refuser exige un commentaire ; e-mail à chaque décision", async () => {
    const c = await creatorFixture();
    const s1 = await submitted(c.id, "FULL_TUTORIAL", true);
    const accepted = await moderateSubmission(s1.id, { decision: "ACCEPTED" }, {}, db);
    expect(accepted).toMatchObject({ status: "ACCEPTED", rateBp: 4500 });
    expect(sent.at(-1)?.subject).toMatch(/acceptée/);
    const s2 = await submitted(c.id);
    await expect(moderateSubmission(s2.id, { decision: "REJECTED" }, {}, db)).rejects.toThrow(/commentaire/);
    const changes = await moderateSubmission(s2.id, { decision: "CHANGES_REQUESTED", comment: "Ajoutez une photo du collage" }, {}, db);
    expect(changes.status).toBe("CHANGES_REQUESTED");
    expect(sent.at(-1)?.text).toContain("Ajoutez une photo du collage");
  });

  it("cycle studio : fabrication → aperçu → lien produit ; publication bloquée avant la validation de la créatrice", async () => {
    const c = await creatorFixture();
    const s = await submitted(c.id);
    await moderateSubmission(s.id, { decision: "ACCEPTED", rateBp: 3000 }, {}, db);
    await startProduction(s.id, "book_1", db);
    const product = await createProductFixture({ slug: "herisson", status: "DRAFT" });
    await linkSubmissionToProduct(s.id, product.id, db);
    expect(await db.product.findUniqueOrThrow({ where: { id: product.id } })).toMatchObject({ creatorId: c.id, creatorRateBp: 3000 });
    await markPreviewReady(s.id, "https://studio.example.com/preview/abc", db);
    expect(sent.at(-1)?.subject).toMatch(/Aperçu à valider/);

    // Publication par l'API refusée tant que l'aperçu n'est pas validé
    const secret = "cc_studio_test";
    await db.apiKey.create({ data: { name: "Studio", prefix: secret.slice(0, 8), keyHash: sha256(secret), scopes: ["products:write", "products:publish"] } });
    const { POST: publish } = await import("@/app/api/v1/products/[id]/publish/route");
    const call = () => publish(new Request("http://localhost/api/v1/products/x/publish", { method: "POST", headers: { authorization: `Bearer ${secret}`, "content-type": "application/json" }, body: "{}" }), { params: Promise.resolve({ id: product.id }) });
    expect((await call()).status).toBe(409);

    await approvePreview(s.id, c.id, db, { notify: false });
    expect((await call()).status).toBe(200);
    expect((await db.creatorSubmission.findUniqueOrThrow({ where: { id: s.id } })).status).toBe("PUBLISHED");
  });

  it("API : scope creators:read requis, aucune donnée personnelle renvoyée, photos en URL signée", async () => {
    const c = await creatorFixture();
    const s = await submitted(c.id);
    await moderateSubmission(s.id, { decision: "ACCEPTED" }, {}, db, { sendEmail: false });
    await db.apiKey.create({ data: { name: "Produits", prefix: "cc_prodw", keyHash: sha256("cc_prodwrite"), scopes: ["products:write"] } });
    await db.apiKey.create({ data: { name: "Studio", prefix: "cc_creat", keyHash: sha256("cc_creators"), scopes: ["creators:write"] } });
    const { GET } = await import("@/app/api/v1/creators/submissions/route");
    const get = (key: string) => GET(new Request("http://localhost/api/v1/creators/submissions", { headers: { authorization: `Bearer ${key}` } }));
    expect((await get("cc_prodwrite")).status).toBe(403);
    const res = await get("cc_creators");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toMatchObject({ id: s.id, credit: "Une idée de Marie", creator: { publicName: "Marie" } });
    expect(body.data[0].photos[0].url).toMatch(/sig=/);
    expect(JSON.stringify(body)).not.toContain("marie@example.com");
    expect(JSON.stringify(body)).not.toContain("Dupont");

    const { POST: production } = await import("@/app/api/v1/creators/submissions/[id]/production/route");
    const r = await production(new Request("http://localhost", { method: "POST", headers: { authorization: "Bearer cc_creators", "content-type": "application/json" }, body: JSON.stringify({ bookId: "book_42" }) }), { params: Promise.resolve({ id: s.id }) });
    expect(r.status).toBe(200);
    expect((await r.json()).data).toMatchObject({ status: "IN_PRODUCTION", studioBookId: "book_42" });
  });
});

describe("formulaire de proposition", () => {
  it("nettoie les listes et exige 3 photos, des étapes, du matériel et un âge pour l'envoi", () => {
    const input = submissionInputSchema.parse({ title: "Bulle", materials: ["bocal", " ", ""], steps: ["Une étape", ""], photos: [{ key: "private/creators/c/a.jpg" }], ageMin: "4", ageMax: "" });
    expect(input.materials).toEqual(["bocal"]);
    expect(input.steps).toEqual(["Une étape"]);
    expect(input.ageMin).toBe(4);
    expect(input.ageMax).toBeUndefined();
    expect(submitProblems(input).join(" ")).toMatch(/au moins 3 photos/);
    expect(() => submissionInputSchema.parse({ title: "Bulle", ageMin: 8, ageMax: 4 })).toThrow();
  });
});
