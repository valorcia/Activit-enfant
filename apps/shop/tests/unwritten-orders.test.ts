import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * UNWRITTEN de bout en bout (base shop_test) : brouillon et reprise, paiement d'une ligne
 * personnalisée, webhook idempotent, API du studio, livraison individuelle, parcours cadeau, RGPD.
 * Stripe et l'envoi d'e-mails sont simulés : aucune dépense, aucun appel réseau.
 */
vi.mock("next/cache", () => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn(), unstable_cache: (fn: unknown) => fn }));
const sent = vi.hoisted(() => [] as Array<{ to: string; subject: string; html: string; text?: string }>);
vi.mock("@/lib/email", () => ({ sendEmail: vi.fn(async (msg: { to: string; subject: string; html: string; text?: string }) => { sent.push(msg); return { ok: true, id: "test" }; }) }));
const stripeCalls = vi.hoisted(() => [] as Array<Record<string, unknown>>);
vi.mock("@/lib/stripe", () => ({
  isStripeConfigured: async () => true,
  getStripeWebhookSecret: async () => "whsec_test",
  getStripe: async () => ({
    checkout: { sessions: { create: async (p: Record<string, unknown>) => { stripeCalls.push(p); return { id: `cs_uw_${stripeCalls.length}`, url: `https://checkout.stripe.test/${stripeCalls.length}` }; } } },
    coupons: { create: async () => ({ id: "co_test" }) },
    webhooks: { constructEvent: (payload: string) => JSON.parse(payload) },
  }),
}));

import { sha256 } from "@/lib/tokens";
import { resetRateLimits } from "@/lib/api/auth";
import { authorizeDownload } from "@/lib/orders/access";
import { createCheckoutSession, CheckoutError } from "@/lib/orders/checkout";
import { applyRefund, fulfillOrderFromSession, markOrderExpired } from "@/lib/orders/fulfillment";
import { seedUnwritten } from "@/lib/unwritten/seed";
import { UNWRITTEN_SITE_ID } from "@/lib/unwritten/constants";
import {
  consumeResumeToken, deleteDraft, DraftError, freezeDraftForCheckout, getDraft, issueResumeLink, purgeUnwrittenData,
  resolveDraftState, saveDraftStep, setDraftMode, startDraft, type DraftWithRefs,
} from "@/lib/unwritten/drafts";
import { completeGift, findGiftByToken, rotateGiftToken, saveGiftStep } from "@/lib/unwritten/orders";
import { createResumeToken } from "@/lib/unwritten/tokens";
import { db, paidSession, resetDb } from "./helpers/db";

let webhook: typeof import("@/app/api/stripe/webhook/route");
let listRoute: typeof import("@/app/api/v1/personal/items/route");
let productionRoute: typeof import("@/app/api/v1/personal/items/[id]/production/route");
let errorRoute: typeof import("@/app/api/v1/personal/items/[id]/error/route");
let fileRoute: typeof import("@/app/api/v1/personal/items/[id]/file/route");
let deliverRoute: typeof import("@/app/api/v1/personal/items/[id]/deliver/route");

beforeAll(async () => {
  webhook = await import("@/app/api/stripe/webhook/route");
  listRoute = await import("@/app/api/v1/personal/items/route");
  productionRoute = await import("@/app/api/v1/personal/items/[id]/production/route");
  errorRoute = await import("@/app/api/v1/personal/items/[id]/error/route");
  fileRoute = await import("@/app/api/v1/personal/items/[id]/file/route");
  deliverRoute = await import("@/app/api/v1/personal/items/[id]/deliver/route");
});
beforeEach(async () => {
  await resetDb();
  await seedUnwritten(db);
  resetRateLimits();
  sent.length = 0;
  stripeCalls.length = 0;
});
afterAll(async () => { await db.$disconnect(); });

const RETENTION = { retentionDays: 30 };
const site = { id: UNWRITTEN_SITE_ID, name: "UNWRITTEN", primaryDomain: null, domains: [] as string[] };

async function secretBook() {
  return db.product.findUniqueOrThrow({ where: { slug: "the-secret-book" } });
}

async function newDraft(mode: "self" | "gift" | "gift_recipient" = "self"): Promise<DraftWithRefs> {
  const product = await secretBook();
  const d = await startDraft({ siteId: UNWRITTEN_SITE_ID, productId: product.id, locale: "fr", currency: "EUR", utm: { utm_source: "instagram", ref: "amie-42" }, retentionDays: 30 }, db);
  if (mode !== "self") await setDraftMode(d, { mode, recipientName: "Léa", recipientEmail: mode === "gift_recipient" ? "lea@example.com" : null, message: "Joyeux anniversaire" }, RETENTION, db);
  return (await getDraft(d.id, db))!;
}

async function save(draftId: string, step: string, input: Record<string, unknown>, consent = true) {
  const d = (await getDraft(draftId, db))!;
  return saveDraftStep(d, step, input, { consent, ...RETENTION }, db);
}

async function completeDraft(mode: "self" | "gift" | "gift_recipient" = "self") {
  const d = await newDraft(mode);
  expect((await save(d.id, "edition", { edition: "couple" })).ok).toBe(true);
  if (mode !== "gift_recipient") {
    expect((await save(d.id, "people", { mainName: "Sam", partnerName: "Léa" })).ok).toBe(true);
    expect((await save(d.id, "story", { shared: "Les crêpes du dimanche" })).ok).toBe(true);
    expect((await save(d.id, "challenges", { tone: "tender" })).ok).toBe(true);
  }
  expect((await save(d.id, "voice", { secret: "Un secret jamais dit", dedication: "Pour toi" })).ok).toBe(true);
  return (await getDraft(d.id, db))!;
}

async function checkout(draft: DraftWithRefs) {
  await freezeDraftForCheckout(draft, "client@example.com", db);
  const session = await createCheckoutSession({
    site,
    lines: [{ kind: "personalized", id: draft.productId, draftId: draft.id, quantity: 1 }],
    email: "client@example.com",
    currency: "EUR",
    stripeLocale: "fr",
    successUrl: "http://localhost:3000/fr/commande/confirmation?session_id={CHECKOUT_SESSION_ID}&site=unwritten",
    cancelUrl: "http://localhost:3000/fr/creer/the-secret-book/recapitulatif",
    orderPrefix: "UW",
    utm: draft.utm as Record<string, string>,
    orderMetadata: { locale: "fr", storefront: "unwritten" },
  });
  await db.personalizationDraft.update({ where: { id: draft.id }, data: { orderId: session.orderId } }); // comme checkoutAction
  return session;
}

function webhookRequest(eventId: string, sessionId: string, amount = 1990) {
  const event = { id: eventId, type: "checkout.session.completed", data: { object: paidSession(sessionId, { amount_total: amount }) } };
  return new Request("http://localhost/api/stripe/webhook", { method: "POST", headers: { "stripe-signature": "t=1,v1=test" }, body: JSON.stringify(event) });
}

async function apiKey(scopes: string[]) {
  const raw = `uw_test_${scopes.join("_")}_${Math.random().toString(36).slice(2)}`;
  await db.apiKey.create({ data: { name: "Studio", prefix: raw.slice(0, 8), keyHash: sha256(raw), scopes } });
  return raw;
}

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const authed = (key: string, init: RequestInit = {}) => ({ ...init, headers: { authorization: `Bearer ${key}`, "content-type": "application/json", ...(init.headers ?? {}) } });

async function paidOrder(mode: "self" | "gift" | "gift_recipient" = "self") {
  const draft = await completeDraft(mode);
  const { orderId } = await checkout(draft);
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
  const res = await webhook.POST(webhookRequest(`evt_${orderId}`, order.stripeCheckoutSessionId!));
  expect(res.status).toBe(200);
  return { draft, order: await db.order.findUniqueOrThrow({ where: { id: orderId }, include: { personalItems: { include: { gift: true } }, entitlements: true, items: true } }) };
}

describe("brouillon de personnalisation", () => {
  it("sauvegarde chaque étape, glisse l'expiration et enregistre le consentement aux champs sensibles", async () => {
    const d = await newDraft();
    const first = d.expiresAt.getTime();
    expect((await save(d.id, "edition", { edition: "growth" })).ok).toBe(true);
    expect((await save(d.id, "challenges", { tone: "bold" })).ok).toBe(true);
    const refused = await save(d.id, "voice", { secret: "Une peur" }, false);
    expect(refused.ok).toBe(false);
    expect(refused.errors).toEqual({ secret: "consentRequired" });
    expect((await save(d.id, "voice", { secret: "Une peur" }, true)).ok).toBe(true);
    const after = (await getDraft(d.id, db))!;
    expect(after.answers).toEqual({ edition: "growth", tone: "bold", secret: "Une peur" });
    expect(after.sensitiveConsentAt).not.toBeNull();
    expect(after.expiresAt.getTime()).toBeGreaterThanOrEqual(first);
    expect(after.utm).toEqual({ utm_source: "instagram", ref: "amie-42" });
  });

  it("se reprend par lien magique à usage unique ; jeton expiré ou falsifié refusé", async () => {
    const d = await newDraft();
    const now = Date.now();
    const url = await issueResumeLink(d, "Client@Example.com", { validityHours: 72, baseUrl: "https://unwritten.test" }, db, now);
    expect(url).toMatch(/^https:\/\/unwritten\.test\/fr\/reprendre\//);
    const token = url.split("/").pop()!;
    expect(token).not.toContain("."); // un point ferait prendre le segment pour un fichier (pas de réécriture)
    expect((await getDraft(d.id, db))!.email).toBe("client@example.com");

    const tampered = token.slice(0, -2) + (token.endsWith("AA") ? "BB" : "AA");
    expect(await consumeResumeToken(tampered, db, now + 1000)).toEqual({ ok: false, reason: "invalid" });
    expect(await consumeResumeToken(token, db, now + 73 * 3600 * 1000)).toEqual({ ok: false, reason: "invalid" }); // expiré
    expect(await consumeResumeToken(createResumeToken("inconnu", 3600, now), db, now + 1000)).toEqual({ ok: false, reason: "invalid" });

    const ok = await consumeResumeToken(token, db, now + 1000);
    expect(ok.ok).toBe(true);
    expect(await consumeResumeToken(token, db, now + 2000)).toEqual({ ok: false, reason: "used" });
    // Un lien émis après la reprise fonctionne
    const again = (await issueResumeLink(d, "client@example.com", { validityHours: 72, baseUrl: "https://unwritten.test" }, db, now + 5000)).split("/").pop()!;
    expect((await consumeResumeToken(again, db, now + 6000)).ok).toBe(true);
  });

  it("expire après la durée de conservation (réponses effacées) et refuse alors la reprise", async () => {
    const d = await newDraft();
    await save(d.id, "edition", { edition: "couple" });
    const token = createResumeToken(d.id, 3600);
    await db.personalizationDraft.update({ where: { id: d.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await consumeResumeToken(token, db)).toEqual({ ok: false, reason: "expired" });
    const expired = await db.personalizationDraft.findUniqueOrThrow({ where: { id: d.id } });
    expect(expired.status).toBe("EXPIRED");
    expect(expired.answers).toEqual({});
    await expect(save(d.id, "edition", { edition: "family" })).rejects.toBeInstanceOf(DraftError);
  });

  it("est supprimé définitivement à la demande du client, et purgé à expiration", async () => {
    const a = await newDraft();
    expect(await deleteDraft(a.id, db)).toBe(true);
    expect(await db.personalizationDraft.count({ where: { id: a.id } })).toBe(0);
    const b = await newDraft();
    await db.personalizationDraft.update({ where: { id: b.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const res = await purgeUnwrittenData(db);
    expect(res.draftsDeleted).toBe(1);
  });

  it("est figé pendant le paiement puis libéré si la session expire", async () => {
    const d = await completeDraft();
    const { orderId } = await checkout(d);
    await expect(save(d.id, "edition", { edition: "family" })).rejects.toMatchObject({ code: "locked" });
    const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
    await markOrderExpired(order.stripeCheckoutSessionId!, db);
    const fresh = (await getDraft(d.id, db))!;
    expect(await resolveDraftState(fresh, db)).toBe("editable");
    expect((await save(d.id, "edition", { edition: "family" })).ok).toBe(true);
  });

  it("refuse le paiement d'un brouillon incomplet", async () => {
    const d = await newDraft();
    await save(d.id, "edition", { edition: "couple" });
    await expect(freezeDraftForCheckout((await getDraft(d.id, db))!, "x@example.com", db)).rejects.toMatchObject({ code: "incomplete" });
  });
});

describe("commande personnalisée", () => {
  it("crée une ligne « produit personnalisé » liée au brouillon figé, au prix de la devise", async () => {
    const d = await completeDraft();
    const { orderId, url } = await checkout(d);
    expect(url).toMatch(/^https:\/\/checkout\.stripe\.test/);
    const order = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
    expect(order.number).toMatch(/^UW-\d{4}-\d{6}$/);
    expect(order.currency).toBe("EUR");
    expect(order.totalCents).toBe(1990);
    expect(order.utm).toEqual({ utm_source: "instagram", ref: "amie-42" });
    expect(order.metadata).toMatchObject({ locale: "fr", storefront: "unwritten" });
    expect(order.items).toHaveLength(1);
    expect(order.items[0].personalDraftId).toBe(d.id);
    const snap = order.items[0].snapshot as { personalization: { answers: Record<string, unknown>; version: number } };
    expect(snap.personalization.version).toBe(2);
    expect(snap.personalization.answers).toMatchObject({ edition: "couple", mainName: "Sam", secret: "Un secret jamais dit" });
    const params = stripeCalls[0];
    expect(params.locale).toBe("fr");
    expect(params.success_url).toContain("/fr/commande/confirmation?session_id={CHECKOUT_SESSION_ID}");
    expect((params.line_items as Array<{ price_data: { currency: string; unit_amount: number } }>)[0].price_data).toMatchObject({ currency: "eur", unit_amount: 1990 });
    expect((params.payment_intent_data as { statement_descriptor_suffix: string }).statement_descriptor_suffix).toBe("UNWRITTEN");
  });

  it("refuse deux brouillons du même produit dans une commande", async () => {
    const a = await completeDraft();
    const b = await completeDraft();
    await freezeDraftForCheckout(a, null, db);
    await freezeDraftForCheckout(b, null, db);
    await expect(createCheckoutSession({ site, lines: [{ kind: "personalized", id: a.productId, draftId: a.id, quantity: 1 }, { kind: "personalized", id: b.productId, draftId: b.id, quantity: 1 }] })).rejects.toBeInstanceOf(CheckoutError);
  });

  it("webhook : crée UN SEUL livre « en attente de génération », sans droit sur des fichiers communs, même rejoué", async () => {
    const { draft, order } = await paidOrder();
    expect(order.status).toBe("PAID");
    expect(order.personalItems).toHaveLength(1);
    const item = order.personalItems[0];
    expect(item.status).toBe("PENDING_GENERATION");
    expect(item.locale).toBe("fr");
    expect(item.answers).toMatchObject({ edition: "couple", partnerName: "Léa" });
    expect(order.entitlements).toHaveLength(0);
    // Même événement rejoué, nouvel événement pour la même session, appel direct : aucun doublon
    expect(await (await webhook.POST(webhookRequest(`evt_${order.id}`, order.stripeCheckoutSessionId!))).json()).toMatchObject({ duplicate: true });
    expect((await webhook.POST(webhookRequest(`evt_${order.id}_bis`, order.stripeCheckoutSessionId!))).status).toBe(200);
    expect((await fulfillOrderFromSession(paidSession(order.stripeCheckoutSessionId!), {}, db)).status).toBe("already_fulfilled");
    expect(await db.personalOrderItem.count({ where: { orderId: order.id } })).toBe(1);
    // Minimisation : le brouillon est vidé une fois copié dans la commande
    const d = await db.personalizationDraft.findUniqueOrThrow({ where: { id: draft.id } });
    expect(d.status).toBe("ORDERED");
    expect(d.answers).toEqual({});
    // E-mail localisé « en préparation », envoyé une seule fois
    const mails = sent.filter((m) => m.to === "client@example.com");
    expect(mails).toHaveLength(1);
    expect(mails[0].subject).toBe(`Votre livre est en préparation · ${order.number}`);
    expect(mails[0].html).toContain('lang="fr"');
    expect(mails[0].html).toContain("/fr/commande/");
    expect(/\/fr\/commande\/([^"?\s]+)/.exec(mails[0].html)![1]).not.toContain(".");
    expect((await db.product.findUniqueOrThrow({ where: { slug: "the-secret-book" } })).salesCount).toBe(1);
  });

  it("remboursement total : le livre non livré est annulé", async () => {
    const { order } = await paidOrder();
    await applyRefund({ payment_intent: order.stripePaymentIntentId, amount_refunded: 1990, amount: 1990, refunds: { data: [{ id: "re_1", amount: 1990, reason: null }] } }, db);
    expect((await db.personalOrderItem.findFirstOrThrow({ where: { orderId: order.id } })).status).toBe("CANCELLED");
  });
});

describe("API v1 du studio et livraison individuelle", () => {
  it("liste, passe en production, signale une erreur, reçoit le PDF, livre (idempotent)", async () => {
    const { order } = await paidOrder();
    const item = order.personalItems[0];
    const key = await apiKey(["personal:write"]);

    const reader = await apiKey(["products:write"]);
    expect((await listRoute.GET(new Request("http://localhost/api/v1/personal/items", authed(reader)))).status).toBe(403);

    const list = await (await listRoute.GET(new Request("http://localhost/api/v1/personal/items", authed(key)))).json();
    expect(list.data).toHaveLength(1);
    expect(list.data[0]).toMatchObject({ id: item.id, status: "PENDING_GENERATION", locale: "fr", product: { collectionKey: "secret-book" } });
    expect(JSON.stringify(list.data[0])).not.toContain("client@example.com"); // pas d'e-mail transmis au studio

    const prod = await productionRoute.POST(new Request("http://localhost/x", authed(key, { method: "POST", body: JSON.stringify({ studioRef: "book_123" }) })), ctx(item.id));
    expect((await prod.json()).data).toMatchObject({ status: "IN_PRODUCTION", studioRef: "book_123" });

    const err = await errorRoute.POST(new Request("http://localhost/x", authed(key, { method: "POST", body: JSON.stringify({ message: "Débordement page 12" }) })), ctx(item.id));
    expect((await err.json()).data).toMatchObject({ status: "ERROR", errorCount: 1, lastError: "Débordement page 12" });
    expect((await productionRoute.POST(new Request("http://localhost/x", authed(key, { method: "POST", body: "{}" })), ctx(item.id))).status).toBe(200);

    // Livraison impossible sans PDF
    expect((await deliverRoute.POST(new Request("http://localhost/x", authed(key, { method: "POST" })), ctx(item.id))).status).toBe(422);

    const fd = new FormData();
    fd.set("file", new File([Buffer.from("%PDF-1.7\n% livre de test\n")], "livre.pdf", { type: "application/pdf" }));
    const up = await fileRoute.POST(new Request("http://localhost/x", { method: "POST", headers: { authorization: `Bearer ${key}` }, body: fd }), ctx(item.id));
    expect(up.status).toBe(201);
    const notPdf = new FormData();
    notPdf.set("file", new File([Buffer.from("hello")], "x.pdf", { type: "application/pdf" }));
    expect((await fileRoute.POST(new Request("http://localhost/x", { method: "POST", headers: { authorization: `Bearer ${key}` }, body: notPdf }), ctx(item.id))).status).toBe(422);

    sent.length = 0;
    const delivered = await deliverRoute.POST(new Request("http://localhost/x", authed(key, { method: "POST" })), ctx(item.id));
    expect((await delivered.json()).data.status).toBe("DELIVERED");
    expect((await deliverRoute.POST(new Request("http://localhost/x", authed(key, { method: "POST" })), ctx(item.id))).status).toBe(200);
    const ents = await db.downloadEntitlement.findMany({ where: { orderId: order.id } });
    expect(ents).toHaveLength(1);
    expect(ents[0].personalItemId).toBe(item.id);
    expect(sent.filter((m) => m.subject === "Votre livre est prêt")).toHaveLength(1);

    // Téléchargement : uniquement le PDF de ce livre
    expect(await authorizeDownload(ents[0].token, "autre-fichier", {}, db)).toMatchObject({ ok: false, status: 404 });
    const dl = await authorizeDownload(ents[0].token, item.id, {}, db);
    expect(dl).toMatchObject({ ok: true, mime: "application/pdf", fileName: "livre.pdf" });
    expect(dl.ok && dl.storageKey.startsWith(`private/personal/${item.id}/`)).toBe(true);

    const audit = await db.auditLog.findMany({ where: { entity: "personalOrderItem", entityId: item.id } });
    expect(audit.map((a) => a.action)).toEqual(expect.arrayContaining(["personal.production", "personal.error", "personal.file", "personal.deliver"]));
  });

  it("purge les réponses d'un livre livré après la durée de conservation", async () => {
    const { order } = await paidOrder();
    await db.personalOrderItem.updateMany({ where: { orderId: order.id }, data: { status: "DELIVERED", deliveredAt: new Date(Date.now() - 91 * 86400_000) } });
    const res = await purgeUnwrittenData(db);
    expect(res.itemsPurged).toBe(1);
    const item = await db.personalOrderItem.findFirstOrThrow({ where: { orderId: order.id } });
    expect(item.answers).toEqual({});
    expect(item.dataPurgedAt).not.toBeNull();
  });
});

describe("parcours cadeau (le destinataire complète ses informations)", () => {
  it("de l'achat à la file du studio, sans exiger de données sur le destinataire", async () => {
    const { order } = await paidOrder("gift_recipient");
    const item = order.personalItems[0];
    expect(item.status).toBe("AWAITING_RECIPIENT");
    expect(item.isGift).toBe(true);
    // Au paiement, seules les réponses de l'acheteur sont figées (édition, dédicace)
    expect(Object.keys(item.answers as object).sort()).toEqual(["dedication", "edition"]);
    expect(item.gift?.recipientName).toBe("Léa");

    // Le destinataire reçoit son lien ; l'acheteur reçoit sa confirmation
    const invite = sent.find((m) => m.to === "lea@example.com")!;
    expect(invite.subject).toBe("Un livre attend d'être écrit pour vous");
    const token = /\/fr\/cadeau\/([A-Za-z0-9_-]+)/.exec(invite.text!)![1];
    expect(sent.some((m) => m.to === "client@example.com")).toBe(true);

    // Le studio ne voit pas encore ce livre
    const key = await apiKey(["personal:read"]);
    expect((await (await listRoute.GET(new Request("http://localhost/x", authed(key)))).json()).data).toHaveLength(0);

    const found = await findGiftByToken(token, db);
    expect(found.ok).toBe(true);
    if (!found.ok) return;
    // Réponses du destinataire (questions « subject » seulement)
    expect((await saveGiftStep(found.claim, "people", { mainName: "Léa", partnerName: "Sam" }, { consent: false }, db)).ok).toBe(true);
    await expect(completeGift(found.claim.id, db)).rejects.toMatchObject({ status: 422 }); // réponses manquantes
    const refreshed = (await findGiftByToken(token, db)) as Extract<Awaited<ReturnType<typeof findGiftByToken>>, { ok: true }>;
    expect((await saveGiftStep(refreshed.claim, "story", { shared: "Nos voyages" }, { consent: false }, db)).ok).toBe(true);
    const again = (await findGiftByToken(token, db)) as typeof refreshed;
    expect((await saveGiftStep(again.claim, "challenges", { tone: "playful", edition: "family" }, { consent: false }, db)).ok).toBe(true);
    await completeGift(again.claim.id, db);

    const done = await db.personalOrderItem.findUniqueOrThrow({ where: { id: item.id }, include: { gift: true } });
    expect(done.status).toBe("PENDING_GENERATION");
    expect(done.answers).toMatchObject({ edition: "couple", dedication: "Pour toi", mainName: "Léa", shared: "Nos voyages", tone: "playful" }); // l'édition de l'acheteur n'est pas modifiable
    expect(done.gift?.completedAt).not.toBeNull();
    expect(done.gift?.answers).toEqual({});
    expect(await findGiftByToken(token, db)).toEqual({ ok: false, reason: "completed" });
    expect((await (await listRoute.GET(new Request("http://localhost/x", authed(key)))).json()).data).toHaveLength(1);
  });

  it("une relance émet un nouveau lien et révoque l'ancien ; un lien inconnu est refusé", async () => {
    const { order } = await paidOrder("gift_recipient");
    const item = order.personalItems[0];
    const old = /\/fr\/cadeau\/([A-Za-z0-9_-]+)/.exec(sent.find((m) => m.to === "lea@example.com")!.text!)![1];
    const { token } = await rotateGiftToken(item.id, db);
    expect(token).not.toBe(old);
    expect(await findGiftByToken(old, db)).toEqual({ ok: false, reason: "invalid" });
    expect((await findGiftByToken(token, db)).ok).toBe(true);
    expect(await findGiftByToken("x".repeat(43), db)).toEqual({ ok: false, reason: "invalid" });
  });

  it("cadeau sans e-mail du destinataire : le lien est donné à l'acheteur", async () => {
    const draft = await newDraft("gift_recipient");
    await setDraftMode(draft, { mode: "gift_recipient", recipientName: null, recipientEmail: null, message: null }, RETENTION, db);
    await save(draft.id, "edition", { edition: "friends" });
    await save(draft.id, "voice", { dedication: "" });
    const { orderId } = await checkout((await getDraft(draft.id, db))!);
    const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
    await webhook.POST(webhookRequest("evt_gift_nomail", order.stripeCheckoutSessionId!));
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("client@example.com");
    expect(sent[0].text).toMatch(/\/fr\/cadeau\/[A-Za-z0-9_-]{20,}/);
  });
});
