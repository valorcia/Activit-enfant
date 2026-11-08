import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { readUtm, slugifyUtm, withUtm } from "@/lib/social/attribution";
import { computeRoi, netRevenueOfItem } from "@/lib/social/roi";
import { decryptSecret, encryptSecret, sha256Normalized } from "@/lib/crypto";
import { buildCopywriterPrompt, composePostText, extractJson, parseCopywriterOutput } from "@/lib/social/copywriter";
import { metaPurchaseBody, tiktokPurchaseBody } from "@/lib/social/conversions";
import { createPendingOrder, createProductFixture, db, resetDb } from "./helpers/db";

process.env.MARKETING_ENCRYPTION_KEY ??= "test-marketing-key";

describe("attribution UTM", () => {
  it("construit un lien tracé sans écraser les paramètres existants", () => {
    const url = withUtm("https://exemple.fr/aventures/coquelicot?ref=x", { utm_source: "instagram", utm_medium: "paid", utm_campaign: "lancement", utm_content: "post1" });
    const u = new URL(url);
    expect(u.searchParams.get("ref")).toBe("x");
    expect(u.searchParams.get("utm_source")).toBe("instagram");
    expect(u.searchParams.get("utm_campaign")).toBe("lancement");
    expect(u.searchParams.get("utm_content")).toBe("post1");
  });
  it("normalise le slug de campagne", () => {
    expect(slugifyUtm("Lancement Coquelicot – Été 2026 !")).toBe("lancement-coquelicot-ete-2026");
    expect(slugifyUtm("")).toBe("campagne");
  });
  it("lit les UTM d'une commande de façon tolérante", () => {
    expect(readUtm({ utm_source: "tiktok", utm_campaign: "x", other: 1 })).toMatchObject({ utm_source: "tiktok", utm_campaign: "x" });
    expect(readUtm(null)).toEqual({});
    expect(readUtm({ utm_source: "" }).utm_source).toBeUndefined();
  });
});

describe("rentabilité", () => {
  it("calcule marge, ROAS et coût par commande", () => {
    const r = computeRoi({ revenueTtcCents: 11880, revenueHtCents: 9900, orders: 12, adSpendCents: 3000, creationCostCents: 650 });
    expect(r.marginCents).toBe(9900 - 3000 - 650);
    expect(r.roas).toBe(3.3);
    expect(r.costPerOrderCents).toBe(250);
    expect(r.marginRate).toBeCloseTo((9900 - 3650) / 9900, 3);
  });
  it("renvoie null sans dépenses ni revenus", () => {
    const r = computeRoi({ revenueTtcCents: 0, revenueHtCents: 0, orders: 0, adSpendCents: 0, creationCostCents: 0 });
    expect(r.roas).toBeNull(); expect(r.costPerOrderCents).toBeNull(); expect(r.marginRate).toBeNull();
  });
  it("déduit les remboursements au prorata et extrait la TVA", () => {
    const { ttc, ht } = netRevenueOfItem({ totalCents: 1200, taxRateBp: 2000 }, { totalCents: 2400, refundedCents: 1200 });
    expect(ttc).toBe(600);
    expect(ht).toBe(500);
  });
});

describe("chiffrement des jetons", () => {
  it("chiffre et déchiffre (aller-retour), sortie non lisible", () => {
    const enc = encryptSecret("EAAB-token-secret");
    expect(enc.startsWith("v1.")).toBe(true);
    expect(enc).not.toContain("token-secret");
    expect(decryptSecret(enc)).toBe("EAAB-token-secret");
    expect(encryptSecret("a")).not.toBe(encryptSecret("a")); // IV aléatoire
  });
  it("refuse un jeton altéré", () => {
    const enc = encryptSecret("abc");
    const tampered = enc.slice(0, -2) + (enc.endsWith("A") ? "BB" : "AA");
    expect(() => decryptSecret(tampered)).toThrow();
  });
  it("hache les emails normalisés (CAPI)", () => {
    expect(sha256Normalized("  Camille@Example.com ")).toBe(sha256Normalized("camille@example.com"));
    expect(sha256Normalized("a@b.fr")).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("rédaction des posts", () => {
  const brief = { name: "Le trésor de la Capitaine Coquelicot", tagline: "10 énigmes", priceLabel: "9,90 € TTC", kitContents: [{ title: "Carte", quantity: 1 }], images: [{ index: 0, alt: "Couverture", role: "MAIN" }], url: "https://x.fr/a?utm_source=instagram", brandName: "La Malle à Jeux" };
  it("le prompt interdit les inventions et liste les faits", () => {
    const p = buildCopywriterPrompt(brief, ["instagram", "meta_ad"], 2);
    expect(p).toContain("N'invente AUCUN fait");
    expect(p).toContain("9,90 € TTC");
    expect(p).toContain("meta_ad : 2 variantes");
    expect(p).toContain("RÉPONDS UNIQUEMENT");
  });
  it("retire les fences et valide le JSON", () => {
    const pasted = "Voici :\n```json\n{\"variants\":[{\"channel\":\"instagram\",\"label\":\"Pluie\",\"hook\":\"Il pleut ?\",\"body\":\"Texte\",\"cta\":\"Découvrir\",\"hashtags\":[\"pirates\",\"#enfants\"],\"imageIndex\":0}]}\n```";
    expect(extractJson(pasted).startsWith("{")).toBe(true);
    const v = parseCopywriterOutput(pasted);
    expect(v).toHaveLength(1);
    expect(v[0].hashtags).toEqual(["#pirates", "#enfants"]);
  });
  it("rejette une réponse hors schéma", () => {
    expect(() => parseCopywriterOutput('{"variants":[{"channel":"x"}]}')).toThrow();
    expect(() => parseCopywriterOutput("pas de json")).toThrow();
  });
  it("compose le texte final selon le canal", () => {
    const t = composePostText({ hook: "A", body: "B", cta: "C", hashtags: ["#x"], linkUrl: "https://l" }, "facebook");
    expect(t).toContain("https://l");
    expect(composePostText({ body: "B", hashtags: [], linkUrl: "https://l" }, "instagram")).toContain("Lien dans la bio");
  });
});

describe("événements de conversion", () => {
  const payload = { orderId: "ord_1", email: "a@b.fr", valueCents: 990, currency: "eur", contentIds: ["p1"], eventTime: new Date("2026-01-01T00:00:00Z"), sourceUrl: "https://x.fr/commande/confirmation" };
  it("construit le corps Meta CAPI avec email haché et event_id = commande", () => {
    const b = metaPurchaseBody(payload, "123");
    expect(b.data[0].event_id).toBe("ord_1");
    expect(b.data[0].user_data.em?.[0]).toBe(sha256Normalized("a@b.fr"));
    expect(b.data[0].custom_data.value).toBe(9.9);
    expect(b.data[0].custom_data.currency).toBe("EUR");
  });
  it("construit le corps TikTok Events", () => {
    const b = tiktokPurchaseBody(payload, "PIX");
    expect(b.data[0].event).toBe("CompletePayment");
    expect(b.data[0].properties.contents[0].content_id).toBe("p1");
  });
});

describe("ConversionEvent (base)", () => {
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await db.$disconnect(); });
  it("une seule ligne par commande, fournisseur et événement", async () => {
    const p = await createProductFixture({ slug: "conv" });
    const order = await createPendingOrder({ sessionId: "cs_conv", productIds: [p.id] });
    const key = { orderId_provider_eventName: { orderId: order.id, provider: "META" as const, eventName: "Purchase" } };
    await db.conversionEvent.upsert({ where: key, create: { orderId: order.id, provider: "META", eventName: "Purchase", status: "FAILED" }, update: {} });
    await db.conversionEvent.upsert({ where: key, create: { orderId: order.id, provider: "META", eventName: "Purchase", status: "SENT" }, update: { status: "SENT" } });
    const rows = await db.conversionEvent.findMany({ where: { orderId: order.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("SENT");
  });
});
