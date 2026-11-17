import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Non-régression La Malle à Jeux après l'ajout de la couche marque et de la vitrine UNWRITTEN :
 * routage (accueil, fiche produit, panier), paiement Stripe (paramètres identiques), webhook et
 * livraison, données de l'univers par défaut intactes, seed UNWRITTEN sans effet sur l'existant.
 */
vi.mock("next/cache", () => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn(), unstable_cache: (fn: unknown) => fn }));
const sent = vi.hoisted(() => [] as Array<{ to: string; subject: string; html: string; text?: string }>);
vi.mock("@/lib/email", () => ({ sendEmail: vi.fn(async (msg: { to: string; subject: string; html: string; text?: string }) => { sent.push(msg); return { ok: true, id: "test" }; }) }));
const stripeCalls = vi.hoisted(() => [] as Array<Record<string, unknown>>);
vi.mock("@/lib/stripe", () => ({
  isStripeConfigured: async () => true,
  getStripeWebhookSecret: async () => "whsec_test",
  getStripe: async () => ({
    checkout: { sessions: { create: async (p: Record<string, unknown>) => { stripeCalls.push(p); return { id: `cs_malle_${stripeCalls.length}`, url: "https://checkout.stripe.test/malle" }; } } },
    coupons: { create: async () => ({ id: "co_test" }) },
    webhooks: { constructEvent: (payload: string) => JSON.parse(payload) },
  }),
}));

import { NextRequest } from "next/server";
import { createCheckoutSession, priceCart, CheckoutError } from "@/lib/orders/checkout";
import { authorizeDownload } from "@/lib/orders/access";
import { createSite } from "@/lib/sites/admin";
import { seedUnwritten } from "@/lib/unwritten/seed";
import { UNWRITTEN_SITE_ID } from "@/lib/unwritten/constants";
import { createProductFixture, db, DEFAULT_SITE_ID, paidSession, resetDb } from "./helpers/db";

let proxyMod: typeof import("@/proxy");
let webhook: typeof import("@/app/api/stripe/webhook/route");

const malleSite = { id: DEFAULT_SITE_ID, name: "La Malle à Jeux", primaryDomain: null, domains: [] as string[] };

describe("routage du proxy", () => {
  beforeAll(async () => {
    await resetDb();
    await seedUnwritten(db); // une marque UNWRITTEN existe (TEST, sans domaine)
    await db.site.update({ where: { id: DEFAULT_SITE_ID }, data: { domains: ["lamalleajeux.eu"], primaryDomain: "www.lamalleajeux.eu" } });
    proxyMod = await import("@/proxy");
  });
  const run = (url: string, init: { cookie?: string; lang?: string; host?: string } = {}) =>
    proxyMod.proxy(new NextRequest(url, { headers: { ...(init.cookie ? { cookie: init.cookie } : {}), ...(init.lang ? { "accept-language": init.lang } : {}), ...(init.host ? { host: init.host } : {}) } }));
  const rewrite = (res: Response) => new URL(res.headers.get("x-middleware-rewrite") ?? "http://x/").pathname;

  it("accueil, fiche produit et panier de La Malle à Jeux : réécriture inchangée", async () => {
    for (const host of ["http://www.lamalleajeux.eu", "http://localhost:3000"]) {
      expect(rewrite(await run(`${host}/`))).toBe("/s/la-malle-a-jeux");
      expect(rewrite(await run(`${host}/aventures/tresor-capitaine-coquelicot`))).toBe("/s/la-malle-a-jeux/aventures/tresor-capitaine-coquelicot");
      expect(rewrite(await run(`${host}/panier`))).toBe("/s/la-malle-a-jeux/panier");
      expect(rewrite(await run(`${host}/commande/confirmation?session_id=cs_1`))).toBe("/s/la-malle-a-jeux/commande/confirmation");
    }
    // Un navigateur anglophone ne change rien pour La Malle à Jeux (aucune redirection de langue)
    const res = await run("http://www.lamalleajeux.eu/boutique", { lang: "en-US" });
    expect(res.status).toBe(200);
    expect(rewrite(res)).toBe("/s/la-malle-a-jeux/boutique");
    expect(res.headers.get("content-language")).toBeNull();
    // Lien « mes fichiers » des e-mails : le jeton signé contient des points et doit être réécrit (plus de 404)
    expect(rewrite(await run("http://www.lamalleajeux.eu/commande/eyJvIjoiYWJjIn0.1893456000.c2lnbmF0dXJl"))).toBe("/s/la-malle-a-jeux/commande/eyJvIjoiYWJjIn0.1893456000.c2lnbmF0dXJl");
    // Les vrais fichiers restent servis sans réécriture
    expect((await run("http://www.lamalleajeux.eu/sitemap.xml")).headers.get("x-middleware-rewrite")).toBeNull();
    expect((await run("http://www.lamalleajeux.eu/robots.txt")).headers.get("x-middleware-rewrite")).toBeNull();
    // /u/… n'est jamais servi tel quel sur La Malle à Jeux
    expect(rewrite(await run("http://www.lamalleajeux.eu/u/en"))).toBe("/s/la-malle-a-jeux/u/en");
  });

  it("l'aperçu ?site=unwritten mène à la vitrine UNWRITTEN localisée ; ?site=default revient à La Malle", async () => {
    const res = await run("http://localhost:3000/?site=unwritten", { lang: "fr-FR,fr;q=0.9" });
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/fr?site=unwritten");
    expect(res.headers.get("set-cookie")).toContain("site_preview=unwritten");
    const page = await run("http://localhost:3000/fr/livres/the-secret-book?ref=amie", { cookie: "site_preview=unwritten" });
    expect(rewrite(page)).toBe("/u/fr/books/the-secret-book");
    expect(page.headers.get("content-language")).toBe("fr");
    expect(page.headers.get("set-cookie")).toContain("uw_ref=amie");
    const back = await run("http://localhost:3000/?site=default", { cookie: "site_preview=unwritten" });
    expect(rewrite(back)).toBe("/s/la-malle-a-jeux");
  });
});

describe("paiement, webhook et livraison de La Malle à Jeux", () => {
  beforeAll(async () => { webhook = await import("@/app/api/stripe/webhook/route"); });
  beforeEach(async () => { await resetDb(); await seedUnwritten(db); sent.length = 0; stripeCalls.length = 0; });
  afterAll(async () => { await db.$disconnect(); });

  it("la session Stripe garde exactement les paramètres historiques", async () => {
    const p = await createProductFixture({ slug: "coquelicot", priceCents: 990 });
    const { orderId } = await createCheckoutSession({ site: malleSite, lines: [{ kind: "product", id: p.id, quantity: 1 }], email: "Parent@Example.com" });
    const params = stripeCalls[0];
    expect(Object.keys(params).sort()).toEqual(["allow_promotion_codes", "billing_address_collection", "cancel_url", "custom_text", "customer_creation", "customer_email", "discounts", "expires_at", "invoice_creation", "line_items", "locale", "metadata", "mode", "payment_intent_data", "success_url"]);
    expect(params.locale).toBe("fr");
    expect(params.success_url).toBe("http://localhost:3000/commande/confirmation?session_id={CHECKOUT_SESSION_ID}");
    expect(params.cancel_url).toBe("http://localhost:3000/panier?annule=1");
    expect(params.line_items).toEqual([{ quantity: 1, price_data: { currency: "eur", unit_amount: 990, tax_behavior: "inclusive", product_data: { name: p.name, metadata: { kind: "product", id: p.id } } } }]);
    expect(params.payment_intent_data).toEqual({ metadata: { orderId, orderNumber: expect.stringMatching(/^CC-/), siteId: DEFAULT_SITE_ID }, statement_descriptor_suffix: "LA MALLE A JEUX" });
    const order = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
    expect(order.number).toMatch(/^CC-\d{4}-\d{6}$/);
    expect(order.currency).toBe("EUR");
    expect(order.metadata).toEqual({ marketingConsent: false, consentText: null });
    expect(order.items[0]).toMatchObject({ productId: p.id, bundleId: null, personalDraftId: null, snapshot: null, unitPriceCents: 990 });
  });

  it("le panier refuse toujours un produit sans fichier et un produit d'un autre univers", async () => {
    const empty = await createProductFixture({ slug: "sans-fichier" }, 0);
    await expect(priceCart([{ kind: "product", id: empty.id, quantity: 1 }], new Date(), DEFAULT_SITE_ID)).rejects.toMatchObject({ code: "NOT_DOWNLOADABLE" });
    const uw = await db.product.findUniqueOrThrow({ where: { slug: "the-secret-book" } });
    await expect(priceCart([{ kind: "product", id: uw.id, quantity: 1 }], new Date(), DEFAULT_SITE_ID)).rejects.toBeInstanceOf(CheckoutError);
    const ok = await createProductFixture({ slug: "avec-fichier", priceCents: 1290 });
    expect(await priceCart([{ kind: "product", id: ok.id, quantity: 2 }], new Date(), DEFAULT_SITE_ID)).toEqual([{ kind: "product", id: ok.id, name: ok.name, quantity: 2, unitPriceCents: 1290, compareAtCents: null, totalCents: 2580, taxRateBp: 2000 }]);
  });

  it("le webhook livre les fichiers communs et envoie l'e-mail habituel, sans livre personnalisé", async () => {
    const p = await createProductFixture({ slug: "coquelicot", priceCents: 990 });
    const { orderId } = await createCheckoutSession({ site: malleSite, lines: [{ kind: "product", id: p.id, quantity: 1 }], email: "parent@example.com" });
    const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
    const event = { id: "evt_malle", type: "checkout.session.completed", data: { object: paidSession(order.stripeCheckoutSessionId!, { customer_details: { email: "parent@example.com", name: "Camille", address: null, phone: null, tax_exempt: null, tax_ids: null } }) } };
    const req = () => new Request("http://localhost/api/stripe/webhook", { method: "POST", headers: { "stripe-signature": "t=1" }, body: JSON.stringify(event) });
    expect((await webhook.POST(req())).status).toBe(200);
    expect(await (await webhook.POST(req())).json()).toMatchObject({ duplicate: true });
    const paid = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: { entitlements: true, personalItems: true } });
    expect(paid.status).toBe("PAID");
    expect(paid.entitlements).toHaveLength(1);
    expect(paid.entitlements[0].personalItemId).toBeNull();
    expect(paid.personalItems).toHaveLength(0);
    expect(sent).toHaveLength(1);
    expect(sent[0].subject).toBe(`Votre commande ${order.number} est prête à télécharger`);
    expect(sent[0].html).toContain("Télécharger mes fichiers");
    const dl = await authorizeDownload(paid.entitlements[0].token, p.files[0].id, {}, db);
    expect(dl).toMatchObject({ ok: true, storageKey: p.files[0].storageKey });
  });
});

describe("données de l'univers par défaut", () => {
  beforeEach(async () => { await resetDb(); });

  it("le seed UNWRITTEN ne modifie pas La Malle à Jeux et ne crée la marque qu'une fois", async () => {
    const before = await db.site.findUniqueOrThrow({ where: { id: DEFAULT_SITE_ID } });
    expect(before).toMatchObject({ kind: "CATALOG", storefront: "malle", locales: ["fr"], defaultLocale: "fr", currencies: ["EUR"], isDefault: true, status: "ACTIVE" });
    await seedUnwritten(db);
    await db.product.update({ where: { slug: "the-secret-book" }, data: { priceCents: 2190 } });
    await seedUnwritten(db); // second passage : rien d'écrasé ni de dupliqué
    const after = await db.site.findUniqueOrThrow({ where: { id: DEFAULT_SITE_ID } });
    expect({ ...after, updatedAt: null }).toEqual({ ...before, updatedAt: null });
    expect(await db.site.count({ where: { kind: "PERSONALIZED" } })).toBe(1);
    expect(await db.product.count({ where: { siteId: UNWRITTEN_SITE_ID } })).toBe(3);
    expect(await db.questionnaire.count()).toBe(3);
    expect((await db.product.findUniqueOrThrow({ where: { slug: "the-secret-book" } })).priceCents).toBe(2190);
    const uw = await db.site.findUniqueOrThrow({ where: { id: UNWRITTEN_SITE_ID } });
    expect(uw).toMatchObject({ status: "TEST", domains: [], primaryDomain: null, isDefault: false, storefront: "unwritten", defaultLocale: "en" });
  });

  it("un univers créé depuis l'admin reste un catalogue « malle » en français", async () => {
    const aud = await db.audience.findFirstOrThrow();
    const s = await createSite(db, { name: "Jardin", slug: "jardin", audienceId: aud.id, preset: "guide-expert" });
    expect(s).toMatchObject({ kind: "CATALOG", storefront: "malle", locales: ["fr"], defaultLocale: "fr", currencies: ["EUR"] });
  });
});
