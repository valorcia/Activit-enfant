import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn(), unstable_cache: (fn: unknown) => fn }));
const sent = vi.hoisted(() => [] as Array<{ to: string; subject: string; html: string; text?: string }>);
vi.mock("@/lib/email", () => ({ sendEmail: vi.fn(async (msg: { to: string; subject: string; html: string; text?: string }) => { sent.push(msg); return { ok: true, id: "test" }; }) }));

import { sha256 } from "@/lib/tokens";
import { resetRateLimits } from "@/lib/api/auth";
import { normalizeHost, resolveSiteSlug, siteBaseUrl, statementDescriptorSuffix, type SiteRouting } from "@/lib/sites/host";
import { mergeSettings } from "@/lib/settings";
import { deepMerge, getPreset } from "@/lib/sites/presets";
import { accountsForAudience } from "@/lib/social/accounts";
import { buildCatalogWhere } from "@/lib/catalog";
import { createSite, deleteSite, updateSite } from "@/lib/sites/admin";
import { db, resetDb, createProductFixture, createSiteFixture, DEFAULT_SITE_ID } from "./helpers/db";

let productsRoute: typeof import("@/app/api/v1/products/route");
let productRoute: typeof import("@/app/api/v1/products/[id]/route");
let sitesRoute: typeof import("@/app/api/v1/sites/route");
let notify: typeof import("@/lib/orders/notify");

beforeAll(async () => {
  productsRoute = await import("@/app/api/v1/products/route");
  productRoute = await import("@/app/api/v1/products/[id]/route");
  sitesRoute = await import("@/app/api/v1/sites/route");
  notify = await import("@/lib/orders/notify");
});
beforeEach(async () => { await resetDb(); resetRateLimits(); sent.length = 0; });
afterAll(async () => { await db.$disconnect(); });

async function apiKey(scopes: string[]) {
  const secret = `cc_${Math.random().toString(36).slice(2)}`;
  await db.apiKey.create({ data: { name: "Univers", prefix: secret.slice(0, 8), keyHash: sha256(secret), scopes } });
  return secret;
}
const json = (key: string, body: unknown, method = "POST") => new Request("http://localhost/api/v1/products", { method, headers: { authorization: `Bearer ${key}`, "content-type": "application/json" }, body: JSON.stringify(body) });
const get = (key: string, url = "http://localhost/api/v1/sites") => new Request(url, { headers: { authorization: `Bearer ${key}` } });

describe("résolution de l'univers d'une requête", () => {
  const sites: SiteRouting[] = [
    { slug: "la-malle-a-jeux", status: "ACTIVE", domains: ["lamalleajeux.fr"], isDefault: true },
    { slug: "fini-l-eau-verte", status: "ACTIVE", domains: ["finileauverte.fr"], isDefault: false },
    { slug: "recettes-faciles", status: "TEST", domains: ["recettesfaciles.fr"], isDefault: false },
    { slug: "ancien", status: "ARCHIVED", domains: ["ancien.fr"], isDefault: false },
  ];
  const resolve = (input: Parameters<typeof resolveSiteSlug>[1]) => resolveSiteSlug(sites, input, "la-malle-a-jeux");

  it("domaine exact, avec ou sans www, port et casse ignorés", () => {
    expect(resolve({ host: "finileauverte.fr" })).toBe("fini-l-eau-verte");
    expect(resolve({ host: "www.finileauverte.fr" })).toBe("fini-l-eau-verte");
    expect(resolve({ host: "WWW.FiniLeauVerte.fr:443" })).toBe("fini-l-eau-verte");
    expect(normalizeHost("www.Exemple.fr.")).toBe("exemple.fr");
  });

  it("sous-domaine du domaine hub, y compris pour un univers en test", () => {
    expect(resolve({ host: "fini-l-eau-verte.hub.example.com", hubDomain: "hub.example.com" })).toBe("fini-l-eau-verte");
    expect(resolve({ host: "recettes-faciles.hub.example.com", hubDomain: "hub.example.com" })).toBe("recettes-faciles");
    expect(resolve({ host: "ancien.hub.example.com", hubDomain: "hub.example.com" })).toBe("la-malle-a-jeux");
  });

  it("cookie de prévisualisation (?site=) pour les univers non archivés", () => {
    expect(resolve({ host: "localhost:3000", previewSlug: "recettes-faciles" })).toBe("recettes-faciles");
    expect(resolve({ host: "localhost:3000", previewSlug: "ancien" })).toBe("la-malle-a-jeux");
    // le domaine exact d'un univers actif l'emporte sur l'aperçu
    expect(resolve({ host: "finileauverte.fr", previewSlug: "recettes-faciles" })).toBe("fini-l-eau-verte");
  });

  it("un univers en test est servi sur son domaine (non indexé) ; archivé ou inconnu : univers par défaut", () => {
    expect(resolve({ host: "recettesfaciles.fr" })).toBe("recettes-faciles");
    expect(resolve({ host: "inconnu.fr" })).toBe("la-malle-a-jeux");
    expect(resolve({ host: "ancien.fr" })).toBe("la-malle-a-jeux");
    expect(resolve({})).toBe("la-malle-a-jeux");
  });

  it("URL publique et libellé bancaire d'un univers", () => {
    expect(siteBaseUrl({ primaryDomain: "www.finileauverte.fr", domains: ["finileauverte.fr"] }, "http://localhost:3000")).toBe("https://www.finileauverte.fr");
    expect(siteBaseUrl({ primaryDomain: null, domains: ["finileauverte.fr"] }, "http://localhost:3000")).toBe("https://finileauverte.fr");
    expect(siteBaseUrl({ primaryDomain: null, domains: [] }, "http://localhost:3000/")).toBe("http://localhost:3000");
    expect(statementDescriptorSuffix("La Malle à Jeux")).toBe("LA MALLE A JEUX");
    expect(statementDescriptorSuffix("Fini l'eau verte — guides piscine experts")).toHaveLength(22);
    expect(statementDescriptorSuffix("***")).toBe("BOUTIQUE");
  });
});

describe("fusion des réglages par univers", () => {
  const globals = {
    brand: { name: "La Malle à Jeux", logoUrl: "/images/brand/logo.png" },
    theme: { colors: { coral: "#FF826F" } },
    commerce: { downloadLinkValidityHours: 48 },
  };

  it("un nouvel univers reçoit son préréglage, jamais l'identité de La Malle à Jeux", () => {
    const s = mergeSettings({ id: "s2", name: "Fini l'eau verte", preset: "guide-expert", settings: {} }, globals);
    expect(s.brand.name).toBe("Fini l'eau verte");
    expect(s.brand.logoUrl ?? null).not.toBe("/images/brand/logo.png");
    expect(s.theme.colors.coral.toLowerCase()).toBe("#0e7490");
    expect(s.theme.fonts.heading).toBe("Manrope");
    expect(s.conversion.buyNowLabel).toBe("Télécharger le guide");
    // le commerce reste commun (réglages globaux)
    expect(s.commerce.downloadLinkValidityHours).toBe(48);
  });

  it("les surcharges de l'univers priment sur le préréglage et les réglages communs", () => {
    const s = mergeSettings({ id: "s2", name: "Fini l'eau verte", preset: "guide-expert", settings: { brand: { name: "FLEV", tagline: "Piscine claire" }, commerce: { downloadLinkValidityHours: 24 } } }, globals);
    expect(s.brand.name).toBe("FLEV");
    expect(s.brand.tagline).toBe("Piscine claire");
    expect(s.commerce.downloadLinkValidityHours).toBe(24);
  });

  it("sans univers : valeurs par défaut et réglages communs", () => {
    const s = mergeSettings(null, globals);
    expect(s.brand.name).toBe("La Malle à Jeux");
    expect(s.theme.colors.coral).toBe("#FF826F");
  });

  it("deepMerge : undefined conserve, null remplace, tableaux remplacés", () => {
    expect(deepMerge({ a: 1, b: { c: 2, d: 3 }, l: [1, 2] }, { a: undefined, b: { c: null }, l: [3] })).toEqual({ a: 1, b: { c: null, d: 3 }, l: [3] });
    expect(getPreset("inconnu").id).toBe("kit-enfants");
  });
});

describe("filtrage par univers", () => {
  it("le catalogue d'un univers ne montre que ses produits", async () => {
    const other = await createSiteFixture({ slug: "fini-l-eau-verte", domains: ["finileauverte.test"] });
    await createProductFixture({ slug: "tresor-pirates" });
    await createProductFixture({ slug: "guide-piscine", siteId: other.id });
    const slugs = async (siteId: string) => (await db.product.findMany({ where: buildCatalogWhere({ siteId }), select: { slug: true } })).map((p) => p.slug);
    expect(await slugs(DEFAULT_SITE_ID)).toEqual(["tresor-pirates"]);
    expect(await slugs(other.id)).toEqual(["guide-piscine"]);
  });

  it("les comptes sociaux suivent l'audience de l'univers, puis les comptes communs", () => {
    const accounts = [{ id: "fam", audienceId: "a-fam" }, { id: "mai", audienceId: "a-mai" }, { id: "com", audienceId: null }];
    expect(accountsForAudience(accounts, "a-mai").map((a) => a.id)).toEqual(["mai", "com"]);
    expect(accountsForAudience(accounts, null).map((a) => a.id)).toEqual(["com"]);
  });

  it("création d'un univers : catégories de départ du préréglage, domaines uniques, suppression d'un univers de test", async () => {
    const audience = await db.audience.create({ data: { slug: "maison-jardin", name: "Maison & jardin" } });
    const site = await createSite(db, { name: "Fini l'eau verte", slug: "fini-l-eau-verte", audienceId: audience.id, preset: "guide-expert", status: "TEST", domains: "https://www.FiniLeauVerte.test/\nfinileauverte.test" });
    expect(site.domains).toEqual(["finileauverte.test"]);
    expect((await db.category.findMany({ where: { siteId: site.id }, orderBy: { position: "asc" } })).map((c) => c.slug)).toEqual(["guides-pratiques", "checklists"]);
    // une même catégorie (slug) peut exister dans deux univers
    await db.category.create({ data: { slug: "guides-pratiques", name: "Guides", siteId: DEFAULT_SITE_ID } });
    await expect(createSite(db, { name: "Doublon", slug: "doublon", audienceId: audience.id, domains: "finileauverte.test" })).rejects.toThrow(/déjà rattaché/);
    await expect(updateSite(db, DEFAULT_SITE_ID, { name: "La Malle à Jeux", slug: "la-malle-a-jeux", audienceId: "aud-familles-enfants", status: "ARCHIVED", isDefault: true })).rejects.toThrow(/ne peut pas être archivé/);
    await deleteSite(db, site.id);
    expect(await db.site.findUnique({ where: { id: site.id } })).toBeNull();
    expect(await db.category.count({ where: { siteId: site.id } })).toBe(0);
  });
});

describe("API v1 multi-univers", () => {
  it("GET /sites liste les univers avec leur audience, URL et catégories (toute clé valide)", async () => {
    const other = await createSiteFixture({ slug: "fini-l-eau-verte", name: "Fini l'eau verte", domains: ["finileauverte.test"], status: "TEST" });
    await db.category.create({ data: { slug: "guides-pratiques", name: "Guides pratiques", siteId: other.id } });
    await createSiteFixture({ slug: "archive", status: "ARCHIVED" });
    const key = await apiKey(["products:publish"]);
    const res = await sitesRoute.GET(get(key));
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data.map((s: { slug: string }) => s.slug)).toEqual(["la-malle-a-jeux", "fini-l-eau-verte"]);
    expect(data[1]).toMatchObject({ name: "Fini l'eau verte", preset: "guide-expert", status: "TEST", audience: { slug: "maison-jardin" }, primaryDomain: "finileauverte.test", url: "https://finileauverte.test", categories: [{ slug: "guides-pratiques", name: "Guides pratiques" }] });
    expect(data[0]).toMatchObject({ isDefault: true, url: "http://localhost:3000" });
    expect((await sitesRoute.GET(get("cc_inconnue"))).status).toBe(401);
  });

  it("POST /products avec siteSlug : catégorie résolue dans l'univers, URL publique sur son domaine", async () => {
    const other = await createSiteFixture({ slug: "fini-l-eau-verte", name: "Fini l'eau verte", domains: ["finileauverte.test"] });
    await db.category.create({ data: { slug: "guides", name: "Guides (La Malle)", siteId: DEFAULT_SITE_ID } });
    const cat = await db.category.create({ data: { slug: "guides", name: "Guides (piscine)", siteId: other.id } });
    const key = await apiKey(["products:write"]);
    const res = await productsRoute.POST(json(key, { name: "Guide piscine verte", priceCents: 1490, template: "GUIDE", siteSlug: "fini-l-eau-verte", categorySlug: "guides" }));
    expect(res.status).toBe(201);
    const { data } = await res.json();
    expect(data.category.id).toBe(cat.id);
    expect(data.site).toEqual({ slug: "fini-l-eau-verte", name: "Fini l'eau verte", url: "https://finileauverte.test" });
    expect(data.template).toBe("GUIDE");
    const row = await db.product.findUniqueOrThrow({ where: { id: data.id } });
    expect(row.siteId).toBe(other.id);

    // publicUrl sur le domaine de l'univers une fois publié
    await db.product.update({ where: { id: data.id }, data: { status: "PUBLISHED", publishedAt: new Date() } });
    const read = await productRoute.GET(get(key, `http://localhost/api/v1/products/${data.id}`), { params: Promise.resolve({ id: data.id }) });
    expect((await read.json()).data.publicUrl).toBe(`https://finileauverte.test/aventures/${data.slug}`);
  });

  it("POST /products sans siteSlug : univers par défaut ; univers inconnu : 422", async () => {
    const key = await apiKey(["products:write"]);
    const res = await productsRoute.POST(json(key, { name: "Chasse au trésor", priceCents: 990 }));
    expect(res.status).toBe(201);
    const { data } = await res.json();
    expect(data.site.slug).toBe("la-malle-a-jeux");
    expect((await db.product.findUniqueOrThrow({ where: { id: data.id } })).siteId).toBe(DEFAULT_SITE_ID);
    const bad = await productsRoute.POST(json(key, { name: "Perdu", priceCents: 990, siteSlug: "nulle-part" }));
    expect(bad.status).toBe(422);
    expect((await bad.json()).error).toMatch(/Univers inconnu/);
  });

  it("PATCH /products/:id avec siteSlug déplace le produit et filtre la liste par univers", async () => {
    const other = await createSiteFixture({ slug: "fini-l-eau-verte", domains: ["finileauverte.test"] });
    const p = await createProductFixture({ slug: "a-deplacer", status: "DRAFT" });
    const key = await apiKey(["products:write"]);
    const res = await productRoute.PATCH(new Request("http://localhost/x", { method: "PATCH", headers: { authorization: `Bearer ${key}`, "content-type": "application/json" }, body: JSON.stringify({ siteSlug: "fini-l-eau-verte" }) }), { params: Promise.resolve({ id: p.id }) });
    expect(res.status).toBe(200);
    expect((await db.product.findUniqueOrThrow({ where: { id: p.id } })).siteId).toBe(other.id);
    const list = await productsRoute.GET(get(key, "http://localhost/api/v1/products?site=fini-l-eau-verte"));
    expect((await list.json()).data.map((x: { slug: string }) => x.slug)).toEqual(["a-deplacer"]);
  });
});

describe("emails : URLs absolues sur le domaine de l'univers de la commande", () => {
  async function order(siteId: string) {
    return db.order.create({ data: { number: `CC-${Math.random().toString(36).slice(2, 8)}`, email: "client@example.com", status: "PAID", siteId, subtotalCents: 990, totalCents: 990, items: { create: [{ name: "Guide", unitPriceCents: 990, quantity: 1, totalCents: 990 }] } } });
  }

  it("confirmation d'une commande d'un autre univers : nom et liens de cet univers", async () => {
    const other = await createSiteFixture({ slug: "fini-l-eau-verte", name: "Fini l'eau verte", domains: ["finileauverte.test"] });
    const o = await order(other.id);
    await notify.sendOrderConfirmation(o.id);
    expect(sent).toHaveLength(1);
    expect(sent[0].html).toContain("https://finileauverte.test/commande/");
    expect(sent[0].html).not.toContain("http://localhost:3000/commande");
    expect(`${sent[0].subject} ${sent[0].html}`).toContain("Fini l");
  });

  it("commande de l'univers par défaut : URL de l'application", async () => {
    const o = await order(DEFAULT_SITE_ID);
    await notify.sendOrderConfirmation(o.id);
    expect(sent[0].html).toContain("http://localhost:3000/commande/");
  });
});
