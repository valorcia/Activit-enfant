import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("next/cache", () => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn(), unstable_cache: (fn: unknown) => fn }));

import {
  buildEtsyDescription, buildEtsyListing, buildEtsyTags, buildEtsyTitle, computeEtsyPriceCents, estimateEtsyFeesCents,
  markdownToPlainText, sourcesHash, ETSY_MAX_FILE_BYTES, type EtsySourceProduct,
} from "@/lib/channels/etsy-listing";
import {
  __setEtsyFetch, EtsyNotConnectedError, etsyAccessToken, etsyMedia, importEtsySales, publishProductToEtsy, salesFromReceipt,
} from "@/lib/channels/etsy";
import { etsySettingsSchema } from "@/lib/schemas/settings";
import { saveSetting } from "@/lib/settings";
import { productRoi } from "@/lib/social/roi";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { db, DEFAULT_SITE_ID, resetDb } from "./helpers/db";

process.env.MARKETING_ENCRYPTION_KEY ??= "test-marketing-key";
process.env.ETSY_API_KEY = "test-keystring";
process.env.ETSY_SHARED_SECRET = "test-shared";

const SETTINGS = etsySettingsSchema.parse({ enabled: true, defaultTaxonomyId: 1250 });

const SOURCE: EtsySourceProduct = {
  name: "Capitaine Coquelicot et le trésor des pirates",
  tagline: "Une chasse au trésor clé en main pour un anniversaire inoubliable",
  shortDescription: "Kit d'animation à imprimer pour 4 à 12 enfants.",
  longDescription: "## Le principe\n\nLes enfants **résolvent** des énigmes et suivent la [carte](https://exemple.fr).\n\n- 10 énigmes\n- 1 carte au trésor",
  story: "Le capitaine a perdu son *trésor* !",
  kitContents: [{ title: "Carte au trésor", quantity: 1 }, { title: "Énigmes", description: "10 cartes", quantity: 10 }],
  ageMin: 5, ageMax: 9, playersMin: 4, playersMax: 12, durationMinutes: 90, pageCount: 32, fileFormat: "PDF",
  materials: ["Imprimante", "Ciseaux"],
  keywords: ["chasse au trésor pirate", "anniversaire pirate enfant", "jeu de piste imprimable", "kit anniversaire 6 ans"],
  tags: ["pirates", "Pirates", "anniversaire", "un mot-clé beaucoup trop long pour etsy"],
  universe: "pirates", categoryName: "Chasses au trésor", categorySlug: "chasses-au-tresor", template: "ADVENTURE",
  priceCents: 990, siteName: "La Malle à Jeux",
};

describe("fiche Etsy (fonctions pures)", () => {
  it("titre ≤ 140 caractères, mot-clé principal en tête, nom du produit inclus", () => {
    const t = buildEtsyTitle(SOURCE);
    expect(t.length).toBeLessThanOrEqual(140);
    expect(t.toLowerCase().startsWith("chasse au trésor pirate")).toBe(true);
    expect(t).toContain("Capitaine Coquelicot");
    const long = buildEtsyTitle({ ...SOURCE, keywords: Array.from({ length: 6 }, (_, i) => `mot clé numéro ${i} assez long pour remplir le titre`) });
    expect(long.length).toBeLessThanOrEqual(140);
  });

  it("13 mots-clés maximum, 20 caractères maximum, sans doublon (accents et casse ignorés)", () => {
    const tags = buildEtsyTags(SOURCE);
    expect(tags.length).toBeGreaterThan(3);
    expect(tags.length).toBeLessThanOrEqual(13);
    for (const t of tags) {
      expect(t.length).toBeLessThanOrEqual(20);
      expect(t).toBe(t.toLowerCase());
    }
    const norm = tags.map((t) => t.normalize("NFD").replace(/\p{M}/gu, ""));
    expect(new Set(norm).size).toBe(norm.length);
    expect(tags).toContain("pirates");
  });

  it("convertit le markdown en texte brut", () => {
    const txt = markdownToPlainText("## Titre\n\nDu **gras**, de l'*italique* et un [lien](https://x.fr).\n\n- point 1\n- point 2");
    expect(txt).not.toMatch(/[#*[\]]/);
    expect(txt).toContain("TITRE");
    expect(txt).toContain("gras");
    expect(txt).toContain("lien");
    expect(txt).not.toContain("https://x.fr");
  });

  it("description : sections, mention produit numérique, mention IA configurable", () => {
    const d = buildEtsyDescription(SOURCE, SETTINGS);
    expect(d).toContain("CE QUE CONTIENT LE KIT");
    expect(d).toContain("INFOS PRATIQUES");
    expect(d).toContain("Énigmes (x10) : 10 cartes");
    expect(d).toMatch(/PRODUIT NUMÉRIQUE : aucun objet physique ne sera envoyé/);
    expect(d).toContain(SETTINGS.aiDisclosureText);
    expect(d).not.toMatch(/\*\*|##/);
    const noAi = buildEtsyDescription(SOURCE, { ...SETTINGS, aiDisclosureEnabled: false });
    expect(noAi).not.toContain(SETTINGS.aiDisclosureText);
    const custom = buildEtsyDescription(SOURCE, { aiDisclosureEnabled: true, aiDisclosureText: "Mention IA personnalisée." });
    expect(custom).toContain("Mention IA personnalisée.");
  });

  it("prix : majoration puis arrondi .90 / .99", () => {
    expect(computeEtsyPriceCents(990, 0, "90")).toBe(990);
    expect(computeEtsyPriceCents(990, 15, "90")).toBe(1190); // 11,385 → 11,90
    expect(computeEtsyPriceCents(990, 15, "99")).toBe(1199);
    expect(computeEtsyPriceCents(990, 15, "none")).toBe(1139);
    expect(computeEtsyPriceCents(1000, 0, "90")).toBe(1090);
    expect(computeEtsyPriceCents(5, 0, "none")).toBe(20);
  });

  it("surcharges de l'admin prioritaires, catégorie par défaut", () => {
    const l = buildEtsyListing(SOURCE, SETTINGS, { title: "Mon titre", tags: ["Un", "deux"], priceCents: 1500, description: "Texte" });
    expect(l).toMatchObject({ title: "Mon titre", tags: ["un", "deux"], priceCents: 1500, description: "Texte", taxonomyId: 1250 });
    const mapped = buildEtsyListing(SOURCE, { ...SETTINGS, taxonomyByCategory: { "chasses-au-tresor": 66 } });
    expect(mapped.taxonomyId).toBe(66);
  });

  it("frais estimés : commission + paiement (+ renouvellement par article)", () => {
    expect(estimateEtsyFeesCents(1000, { ...SETTINGS, listingFeeCents: 0 })).toBe(Math.round(1000 * 0.105) + 30);
    expect(estimateEtsyFeesCents(1000, SETTINGS)).toBe(Math.round(1000 * 0.105) + 30 + 20);
    expect(estimateEtsyFeesCents(1000, SETTINGS, 2)).toBe(Math.round(1000 * 0.105) + 30 + 40);
    expect(estimateEtsyFeesCents(0, SETTINGS)).toBe(0);
  });

  it("lignes de vente d'un reçu : reçu non payé ignoré, quantité prise en compte", () => {
    expect(salesFromReceipt({ receipt_id: 1, is_paid: false, transactions: [{ transaction_id: 9, listing_id: 5, quantity: 1, price: { amount: 990, divisor: 100, currency_code: "EUR" } }] })).toEqual([]);
    const [s] = salesFromReceipt({ receipt_id: 2, is_paid: true, created_timestamp: 1_760_000_000, transactions: [{ transaction_id: 9, listing_id: 5, quantity: 2, price: { amount: 990, divisor: 100, currency_code: "EUR" } }] });
    expect(s).toMatchObject({ externalId: "2:9", receiptId: "2", etsyListingId: "5", quantity: 2, grossCents: 1980, currency: "EUR" });
  });

  it("empreinte des médias stable et sensible aux changements", () => {
    expect(sourcesHash(["a", "b"])).toBe(sourcesHash(["a", "b"]));
    expect(sourcesHash(["a", "b"])).not.toBe(sourcesHash(["b", "a"]));
  });
});

// ---------------------------------------------------------------------------
// Connecteur (fetch simulé)
// ---------------------------------------------------------------------------

interface Call { method: string; url: string; body?: unknown; apiKey: string | null }
let calls: Call[] = [];
let receipts: unknown[] = [];
let nextId = 1000;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
}

function installFakeEtsy() {
  calls = [];
  __setEtsyFetch(async (input, init) => {
    const url = new URL(input);
    const method = (init?.method ?? "GET").toUpperCase();
    const headers = (init?.headers ?? {}) as Record<string, string>;
    const body = typeof init?.body === "string" ? (init.body.startsWith("{") ? JSON.parse(init.body) : Object.fromEntries(new URLSearchParams(init.body))) : init?.body instanceof FormData ? Object.fromEntries([...init.body.keys()].map((k) => [k, true])) : undefined;
    calls.push({ method, url: url.pathname, body, apiKey: headers["x-api-key"] ?? null });
    const p = url.pathname.replace("/v3/application", "");
    if (url.host === "api.etsy.com" && p.endsWith("/oauth/token")) return json({ access_token: "777.newaccess", refresh_token: "777.newrefresh", expires_in: 3600, token_type: "Bearer" });
    if (method === "POST" && /^\/shops\/\d+\/listings$/.test(p)) return json({ listing_id: 555, state: "draft", url: "https://www.etsy.com/listing/555" }, 201);
    if (method === "POST" && p.endsWith("/images")) return json({ listing_image_id: nextId++ }, 201);
    if (method === "POST" && p.endsWith("/files")) return json({ listing_file_id: nextId++ }, 201);
    if (method === "DELETE") return new Response(null, { status: 204 });
    if (method === "PATCH") return json({ listing_id: 555, state: (body as { state?: string } | undefined)?.state ?? "draft" });
    if (method === "PUT" && p.endsWith("/inventory")) return json({ products: [] });
    if (method === "GET" && /^\/listings\/\d+$/.test(p)) return json({ listing_id: 555, state: "draft", url: "https://www.etsy.com/listing/555", price: { amount: 990, divisor: 100, currency_code: "EUR" } });
    if (method === "GET" && /\/receipts$/.test(p)) return json({ count: receipts.length, results: receipts });
    return json({ error: `route non simulée ${method} ${p}` }, 404);
  });
}

async function createEtsyAccount(expiresInMs = 3_600_000) {
  return db.socialAccount.create({
    data: { provider: "ETSY", kind: "SHOP", externalId: "424242", name: "MalleAJeuxShop", accessTokenEnc: encryptSecret("777.access"), refreshTokenEnc: encryptSecret("777.refresh"), tokenExpiresAt: new Date(Date.now() + expiresInMs) },
  });
}

async function createEbook(opts: { fileSize?: number; files?: number } = {}) {
  const cat = await db.category.create({ data: { slug: `chasses-${Math.random().toString(36).slice(2, 6)}`, name: "Chasses au trésor", siteId: DEFAULT_SITE_ID } });
  return db.product.create({
    data: {
      slug: `coquelicot-${Math.random().toString(36).slice(2, 8)}`, name: SOURCE.name, tagline: SOURCE.tagline, shortDescription: SOURCE.shortDescription,
      priceCents: 990, status: "PUBLISHED", publishedAt: new Date(), categoryId: cat.id, keywords: SOURCE.keywords, ageMin: 5, ageMax: 9,
      images: { create: [{ url: "/img/main.webp", storageKey: "public/a.webp", role: "MAIN", position: 0 }, { url: "/img/2.webp", storageKey: "public/b.webp", role: "GALLERY", position: 1 }] },
      files: { create: Array.from({ length: opts.files ?? 1 }, (_, i) => ({ name: `kit-${i + 1}.pdf`, storageKey: `private/kit-${i + 1}.pdf`, kind: i === 0 ? "MAIN_PDF" as const : "BONUS" as const, sizeBytes: opts.fileSize ?? 1_000_000, position: i })) },
    },
  });
}

describe("connecteur Etsy", () => {
  const readImage = etsyMedia.readImage;
  const readFile = etsyMedia.readFile;
  beforeEach(async () => {
    await resetDb();
    await saveSetting("etsy", { enabled: true, defaultTaxonomyId: 1250 }, null);
    installFakeEtsy();
    receipts = [];
    etsyMedia.readImage = async () => ({ data: Buffer.from("jpeg"), name: "image.jpg", type: "image/jpeg" });
    etsyMedia.readFile = async (f) => ({ data: Buffer.from("%PDF"), name: f.name, type: "application/pdf" });
  });
  afterEach(() => { __setEtsyFetch(null); etsyMedia.readImage = readImage; etsyMedia.readFile = readFile; });
  afterAll(async () => { await db.$disconnect(); });

  it("crée la fiche une seule fois puis la met à jour (idempotent)", async () => {
    await createEtsyAccount();
    const p = await createEbook();
    const first = await publishProductToEtsy(p.id, {}, db);
    expect(first.created).toBe(true);
    expect(first.listing).toMatchObject({ etsyListingId: "555", state: "draft", url: "https://www.etsy.com/listing/555" });
    const create = calls.find((c) => c.method === "POST" && c.url.endsWith("/shops/424242/listings"));
    expect(create?.body).toMatchObject({ type: "download", taxonomy_id: 1250, who_made: "i_did", is_supply: false, price: 9.9, quantity: 999 });
    expect((create?.body as { tags: string[] }).tags.length).toBeLessThanOrEqual(13);
    expect(calls.filter((c) => c.url.endsWith("/images")).length).toBe(2);
    expect(calls.filter((c) => c.url.endsWith("/files")).length).toBe(1);
    expect(calls[0].apiKey).toBe("test-keystring:test-shared");

    calls = [];
    const second = await publishProductToEtsy(p.id, {}, db);
    expect(second.created).toBe(false);
    expect(calls.some((c) => c.method === "POST" && c.url.endsWith("/listings"))).toBe(false);
    expect(calls.some((c) => c.method === "PATCH")).toBe(true);
    expect(calls.some((c) => c.url.endsWith("/images") || c.url.endsWith("/files"))).toBe(false);
    expect(calls.some((c) => c.method === "PUT")).toBe(false);
    expect(await db.etsyListing.count()).toBe(1);

    // Prix surchargé → inventaire mis à jour ; activation demandée → PATCH state active
    await db.etsyListing.update({ where: { id: second.listing.id }, data: { overrides: { priceCents: 1290 } } });
    calls = [];
    await publishProductToEtsy(p.id, { state: "active" }, db);
    const inv = calls.find((c) => c.method === "PUT" && c.url.endsWith("/listings/555/inventory"));
    expect((inv?.body as { products: Array<{ offerings: Array<{ price: number }> }> }).products[0].offerings[0].price).toBe(12.9);
    expect(calls.some((c) => c.method === "PATCH" && (c.body as { state?: string }).state === "active")).toBe(true);
  });

  it("refuse un fichier de plus de 20 Mo avec un message explicite, sans appel à Etsy", async () => {
    await createEtsyAccount();
    const p = await createEbook({ fileSize: ETSY_MAX_FILE_BYTES + 1 });
    await expect(publishProductToEtsy(p.id, {}, db)).rejects.toThrow(/dépasse 20 Mo/);
    expect(calls.length).toBe(0);
  });

  it("refuse plus de 5 fichiers", async () => {
    await createEtsyAccount();
    const p = await createEbook({ files: 6 });
    await expect(publishProductToEtsy(p.id, {}, db)).rejects.toThrow(/5 fichiers au maximum/);
  });

  it("sans boutique connectée : EtsyNotConnectedError (409 etsy_not_connected)", async () => {
    const p = await createEbook();
    const err = await publishProductToEtsy(p.id, {}, db).catch((e) => e);
    expect(err).toBeInstanceOf(EtsyNotConnectedError);
    expect(err.code).toBe("etsy_not_connected");
    expect(err.status).toBe(409);
  });

  it("boutique rattachée à un autre univers : non utilisée", async () => {
    const acc = await createEtsyAccount();
    const other = await db.site.create({ data: { slug: "science", name: "Science", audienceId: "aud-familles-enfants", preset: "guide-expert" } });
    await db.socialAccount.update({ where: { id: acc.id }, data: { siteIds: [other.id] } });
    const p = await createEbook();
    await expect(publishProductToEtsy(p.id, {}, db)).rejects.toBeInstanceOf(EtsyNotConnectedError);
  });

  it("rafraîchit un jeton expiré", async () => {
    const acc = await createEtsyAccount(-1000);
    const token = await etsyAccessToken(acc, db);
    expect(token).toBe("777.newaccess");
    const updated = await db.socialAccount.findUniqueOrThrow({ where: { id: acc.id } });
    expect(decryptSecret(updated.refreshTokenEnc!)).toBe("777.newrefresh");
    expect(updated.tokenExpiresAt!.getTime()).toBeGreaterThan(Date.now());
  });

  it("importe les ventes sans doublon et les compte dans la rentabilité", async () => {
    await createEtsyAccount();
    const p = await createEbook();
    await publishProductToEtsy(p.id, {}, db);
    const ts = Math.floor(Date.now() / 1000) - 3600;
    receipts = [
      { receipt_id: 1, is_paid: true, created_timestamp: ts, transactions: [{ transaction_id: 11, listing_id: 555, quantity: 1, price: { amount: 990, divisor: 100, currency_code: "EUR" } }] },
      { receipt_id: 2, is_paid: true, created_timestamp: ts, transactions: [{ transaction_id: 21, listing_id: 555, quantity: 2, price: { amount: 990, divisor: 100, currency_code: "EUR" } }, { transaction_id: 22, listing_id: 999, quantity: 1, price: { amount: 500, divisor: 100, currency_code: "EUR" } }] },
    ];
    const a = await importEtsySales(db);
    expect(a.imported).toBe(3);
    const b = await importEtsySales(db);
    expect(b.imported).toBe(0);
    expect(await db.externalSale.count()).toBe(3);
    const linked = await db.externalSale.findMany({ where: { productId: p.id }, orderBy: { externalId: "asc" } });
    expect(linked.map((s) => s.externalId)).toEqual(["1:11", "2:21"]);
    expect(linked[1].grossCents).toBe(1980);
    expect(linked[1].feesCents).toBe(estimateEtsyFeesCents(1980, SETTINGS, 2));
    expect(linked[1].siteId).toBe(DEFAULT_SITE_ID);

    const rows = await productRoi({ from: new Date(Date.now() - 86_400_000), to: new Date() }, db);
    const row = rows.find((r) => r.productId === p.id)!;
    const gross = 990 + 1980;
    const fees = estimateEtsyFeesCents(990, SETTINGS) + estimateEtsyFeesCents(1980, SETTINGS, 2);
    expect(row.etsy).toEqual({ orders: 2, quantity: 3, grossCents: gross, feesCents: fees, netCents: gross - fees });
    expect(row.orders).toBe(2);
    expect(row.revenueTtcCents).toBe(gross);
    expect(row.revenueHtCents).toBe(gross - fees);
    expect(row.bySource.etsy).toEqual({ orders: 2, revenueHtCents: gross - fees });

    // Périmètre d'un autre univers : ventes Etsy exclues
    const other = await db.site.create({ data: { slug: "autre", name: "Autre", audienceId: "aud-familles-enfants", preset: "guide-expert" } });
    const scoped = await productRoi({ from: new Date(Date.now() - 86_400_000), to: new Date() }, db, { siteId: other.id });
    expect(scoped.find((r) => r.productId === p.id)).toBeUndefined();
  });
});
