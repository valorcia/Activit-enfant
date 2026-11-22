import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/sites", () => ({ getRequestSite: async () => ({ id: "site-default" }) }));

import { cleanPath, deviceOf, isBot, recordClientEvent, recordServerEvent, sourceOf } from "@/lib/analytics/events";
import { getFunnelStats } from "@/lib/admin/funnel";
import { createProductFixture, db, DEFAULT_SITE_ID, ensureDefaultSite, resetDb } from "./helpers/db";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1";
const MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 Safari/605.1.15";

beforeEach(async () => {
  await resetDb();
  await ensureDefaultSite();
  await db.siteEvent.deleteMany();
});
afterAll(async () => { await db.$disconnect(); });

describe("mesure d'audience : classement", () => {
  it("reconnaît la source (utm, clic publicitaire, site d'origine, direct)", () => {
    expect(sourceOf({ utm: { utm_source: "Facebook", utm_medium: "paid", utm_campaign: "Dinos" } })).toEqual({ source: "facebook", medium: "paid", campaign: "dinos" });
    expect(sourceOf({ utm: { fbclid: "1" } }).source).toBe("facebook");
    expect(sourceOf({ utm: { gclid: "1" } }).source).toBe("google");
    expect(sourceOf({ ref: "https://l.facebook.com/l.php?u=x" }).source).toBe("facebook");
    expect(sourceOf({ ref: "https://www.google.fr/" }).source).toBe("google");
    expect(sourceOf({ ref: "https://www.lamalleajeux.eu/boutique", ownHost: "www.lamalleajeux.eu" }).source).toBe("direct");
    expect(sourceOf({}).source).toBe("direct");
  });
  it("reconnaît l'appareil, exclut les robots, retire les jetons des adresses", () => {
    expect(deviceOf(IPHONE)).toBe("mobile");
    expect(deviceOf(MAC)).toBe("desktop");
    expect(deviceOf("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)")).toBe("tablet");
    expect(isBot("facebookexternalhit/1.1")).toBe(true);
    expect(isBot("Googlebot/2.1")).toBe(true);
    expect(isBot(null)).toBe(true);
    expect(isBot(IPHONE)).toBe(false);
    expect(cleanPath("/commande/eyJvIjoiYWJjIn0.1893456000.c2ln?x=1")).toBe("/commande/…");
    expect(cleanPath("/aventures/dinos?utm_source=facebook")).toBe("/aventures/dinos");
  });
});

describe("collecte", () => {
  it("l'adresse /api/t enregistre une visite et ignore les robots", async () => {
    const route = await import("@/app/api/t/route");
    const body = JSON.stringify({ type: "page_view", path: "/", vid: "visiteur0001", sid: "session0001", ref: "https://l.facebook.com/", utm: {} });
    const req = (ua: string) => new Request("http://localhost/api/t", { method: "POST", headers: { "user-agent": ua, "x-forwarded-for": "203.0.113.7" }, body }) as unknown as import("next/server").NextRequest;
    expect((await route.POST(req("facebookexternalhit/1.1"))).status).toBe(204);
    expect(await db.siteEvent.count()).toBe(0);
    expect((await route.POST(req(IPHONE))).status).toBe(204);
    const ev = await db.siteEvent.findFirstOrThrow();
    expect(ev).toMatchObject({ siteId: DEFAULT_SITE_ID, type: "page_view", source: "facebook", device: "mobile", path: "/" });
  });
});

describe("parcours d'achat", () => {
  it("calcule l'entonnoir, les sources, les sorties et les refus de paiement", async () => {
    const p = await createProductFixture({ slug: "bebes-dinos", name: "Les bébés dinosaures", priceCents: 490 });
    const ev = (sid: string, type: "page_view" | "view_item" | "add_to_cart" | "begin_checkout", extra: Record<string, unknown> = {}, ua = IPHONE) =>
      recordClientEvent(DEFAULT_SITE_ID, { type, sid, vid: `v${sid}`, ...extra }, { userAgent: ua, ownHost: "www.lamalleajeux.eu" }, db);
    // 4 visites : 2 depuis Facebook (mobile), 2 directes (ordinateur)
    await ev("session0001", "page_view", { path: "/aventures/bebes-dinos", utm: { utm_source: "facebook" } });
    await ev("session0001", "view_item", { productId: p.id, value: 4.9 });
    await ev("session0001", "begin_checkout", { productId: p.id, value: 4.9 });
    await ev("session0002", "page_view", { path: "/aventures/bebes-dinos", utm: { utm_source: "facebook" } });
    await ev("session0002", "view_item", { productId: p.id });
    await ev("session0003", "page_view", { path: "/" }, MAC);
    await ev("session0003", "page_view", { path: "/boutique" }, MAC);
    await ev("session0004", "page_view", { path: "/" }, MAC);
    // 2 pages de paiement ouvertes : 1 payée, 1 abandonnée ; 1 refus de carte
    const order = (number: string, status: "PAID" | "CANCELLED", paid: boolean) => db.order.create({
      data: { siteId: DEFAULT_SITE_ID, number, email: "x@example.com", status, currency: "EUR", subtotalCents: 490, totalCents: 490, paidAt: paid ? new Date() : null, utm: paid ? { utm_source: "facebook" } : undefined, items: { create: { productId: p.id, name: p.name, quantity: 1, unitPriceCents: 490, totalCents: 490 } } },
    });
    await order("CC-2026-000101", "PAID", true);
    await order("CC-2026-000102", "CANCELLED", false);
    await recordServerEvent({ siteId: DEFAULT_SITE_ID, type: "payment_failed", value: 490, detail: "insufficient_funds" }, db);

    const s = await getFunnelStats({ siteId: DEFAULT_SITE_ID, from: new Date(Date.now() - 86400_000), to: new Date(Date.now() + 60_000) }, db);
    expect(s.steps.map((x) => x.count)).toEqual([4, 2, 1, 2, 1]);
    expect(s.visitors).toBe(4);
    expect(s.pageViews).toBe(5);
    expect(s.buyClicks).toBe(1);
    expect(s.revenueCents).toBe(490);
    expect(s.checkoutOutcomes).toMatchObject({ created: 2, paid: 1, abandoned: 1, failed: 0 });
    expect(s.byProduct[0]).toMatchObject({ name: "Les bébés dinosaures", views: 2, buyClicks: 1, checkouts: 2, paid: 1 });
    expect(s.bySource).toEqual(expect.arrayContaining([{ source: "facebook", visits: 2, buyVisits: 1 }, { source: "direct", visits: 2, buyVisits: 0 }]));
    expect(s.byDevice).toEqual(expect.arrayContaining([{ device: "mobile", visits: 2, buyVisits: 1 }, { device: "desktop", visits: 2, buyVisits: 0 }]));
    // Sorties : visites sans clic « Acheter », dernière page vue
    expect(s.exitPages).toEqual(expect.arrayContaining([{ path: "/aventures/bebes-dinos", visits: 1 }, { path: "/boutique", visits: 1 }, { path: "/", visits: 1 }]));
    expect(s.paymentFailures).toEqual([{ code: "insufficient_funds", label: "Fonds insuffisants", count: 1 }]);
    expect(s.paidBySource).toEqual([{ source: "facebook", orders: 1, revenueCents: 490 }]);
    expect(s.daily.reduce((a, d) => a + d.visits, 0)).toBe(4);
  });
});
