import { describe, expect, it } from "vitest";
import { KIT_TYPES, isStructuredKit, kitContentsFor, kitType, kitTypeFromShop } from "@/lib/kits/types";
import { KitPlanSchema, PranksKitSchema, TreasureHuntSchema, detectKitContentFormat } from "@/lib/kits/schemas";
import { mockKitPlan, mockPranksKit, mockTreasureHunt } from "@/lib/kits/mock";
import { buildPranksPages, buildTreasureHuntPages } from "@/lib/kits/pages";
import { kitIllustrationPlan } from "@/lib/kits/generate";
import { listingFromProduct, toCatalogEntry, ageRangeFromProduct } from "@/lib/shop/catalog";
import { buildListingFromBook, type BookForListing } from "@/lib/shop/publish";
import { DEFAULT_SHOP_SETTINGS } from "@/lib/schemas/settings";
import { PageLayoutSchema } from "@/lib/schemas/layout";
import { BUILTIN_TEMPLATES } from "@/lib/layout/themes";
import type { ShopProduct } from "@/lib/shop/client";

const CATEGORIES = ["chasses-au-tresor", "activites-educatives", "evenements", "histoires-et-aventures", "guides-pratiques", "recettes"];
const ctx = { widthMm: 210, heightMm: 297, theme: BUILTIN_TEMPLATES[0].theme };

describe("référentiel des types de kits", () => {
  it("clés uniques, catégories et modèles de fiche cohérents", () => {
    const keys = KIT_TYPES.map((k) => k.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const k of KIT_TYPES) {
      expect(CATEGORIES).toContain(k.shopCategory);
      expect(["ADVENTURE", "ACTIVITY", "STORY", "EVENT", "CLASSIC", "GUIDE", "RECIPES"]).toContain(k.template);
      expect(k.presets.length).toBeGreaterThan(0);
      expect(k.defaultAge).toMatch(/^\d+-\d+$/);
      if (k.family === "kit") expect(k.format).toBeDefined();
      if (k.shopCategory === "chasses-au-tresor") expect(k.template).toBe("ADVENTURE");
    }
    expect(isStructuredKit("chasse-au-tresor")).toBe(true);
    expect(isStructuredKit("lutins-farceurs")).toBe(true);
    expect(isStructuredKit("sciences")).toBe(false);
    expect(isStructuredKit("activites")).toBe(false);
  });

  it("déduit le type de kit d'un produit de la boutique", () => {
    expect(kitTypeFromShop({ categorySlug: "chasses-au-tresor", name: "Le trésor de la Capitaine Coquelicot" })).toBe("chasse-au-tresor");
    expect(kitTypeFromShop({ categorySlug: "evenements", name: "Lutins farceurs : 30 idées pour Noël" })).toBe("lutins-farceurs");
    expect(kitTypeFromShop({ categorySlug: "chasses-au-tresor", name: "Mission agents secrets" })).toBe("mission-enquete");
    expect(kitTypeFromShop({ categorySlug: "histoires-et-aventures", name: "Histoire" })).toBe("histoire-illustree");
    expect(kitTypeFromShop({ template: "EVENT", name: "Fête" })).toBe("kit-anniversaire");
  });

  it("contenus du kit pour la fiche boutique (kitContents)", () => {
    const items = kitContentsFor(kitType("chasse-au-tresor"), { main: 10 });
    expect(items.map((i) => i.title)).toEqual(expect.arrayContaining(["Guide de l'organisateur", "10 cartes énigmes version texte", "10 cartes énigmes version images", "Carte au trésor en 10 morceaux", "Diplômes", "Invitations"]));
    expect(items.find((i) => i.title.startsWith("10 cartes énigmes version texte"))?.quantity).toBe(10);
    const pranks = kitContentsFor(kitType("lutins-farceurs"), { main: 30 });
    expect(pranks.map((i) => i.title)).toContain("30 idées");
  });
});

describe("contenu structuré des kits", () => {
  it("reconnaît et valide un JSON de chasse au trésor ou de lutins (format docs/prompts)", () => {
    const hunt = mockTreasureHunt({ count: 10, heroName: "Professeure Fossile", companion: "Pépite" });
    const pranks = mockPranksKit({ count: 30 });
    expect(detectKitContentFormat(hunt)).toBe("treasure_hunt");
    expect(detectKitContentFormat(pranks)).toBe("pranks");
    expect(detectKitContentFormat({ title: "x" })).toBeNull();
    expect(TreasureHuntSchema.parse(JSON.parse(JSON.stringify(hunt))).enigmes).toHaveLength(10);
    expect(PranksKitSchema.parse(JSON.parse(JSON.stringify(pranks))).idees).toHaveLength(30);
    // JSON minimal collé depuis Claude : champs facultatifs complétés par défaut
    const minimal = TreasureHuntSchema.parse({ titre: "Chasse", lettre: "Bonjour les aventuriers, voici ma lettre.", enigmes: [{ numero: 1, texte: "Je suis froid" }] });
    expect(minimal.defis).toEqual([]);
    expect(minimal.enigmes[0].cachette).toBe("");
  });

  it("plan de kit depuis un brief (démo)", () => {
    expect(KitPlanSchema.parse(mockKitPlan({ brief: "chasse au trésor dinosaures 5-8 ans" }))).toMatchObject({ kitType: "chasse-au-tresor", universe: "Dinosaures" });
    expect(mockKitPlan({ brief: "lutins farceurs pour Noël" }).kitType).toBe("lutins-farceurs");
  });

  it("plan d'illustrations : un emplacement par énigme / idée, sans doublon", () => {
    const hunt = TreasureHuntSchema.parse(mockTreasureHunt({ count: 4 }));
    const slots = kitIllustrationPlan(hunt).map((p) => p.slot);
    expect(slots).toEqual(expect.arrayContaining(["planche-personnage", "lettre", "carte", "diplome", "enigme-image-1", "enigme-image-4"]));
    expect(new Set(slots).size).toBe(slots.length);
    const idees = kitIllustrationPlan(PranksKitSchema.parse(mockPranksKit({ count: 5 }))).map((p) => p.slot);
    expect(idees.filter((s) => s.startsWith("idee-"))).toHaveLength(5);
  });

  it("gabarits de pages valides (lettre, cartes énigmes 4/page, carte, diplômes, idées, calendrier)", () => {
    const hunt = TreasureHuntSchema.parse(mockTreasureHunt({ count: 10 }));
    const pages = buildTreasureHuntPages(ctx, hunt, {});
    for (const p of pages) expect(() => PageLayoutSchema.parse(p.layout)).not.toThrow();
    const keys = pages.map((p) => p.templateKey);
    expect(keys.filter((k) => k === "kit_riddle_text")).toHaveLength(3); // 10 énigmes, 4 par page
    expect(keys).toEqual(expect.arrayContaining(["kit_guide", "kit_letter", "kit_riddle_image", "kit_map", "kit_challenges", "kit_diploma", "kit_invitation"]));
    const pp = buildPranksPages(ctx, PranksKitSchema.parse(mockPranksKit({ count: 6 })), {});
    for (const p of pp) expect(() => PageLayoutSchema.parse(p.layout)).not.toThrow();
    expect(pp.filter((p) => p.templateKey === "kit_idea")).toHaveLength(6);
    expect(pp.map((p) => p.templateKey)).toEqual(expect.arrayContaining(["kit_calendar", "kit_notes", "kit_diploma", "kit_guide"]));
  });
});

const product = {
  id: "p1", slug: "tresor-capitaine-coquelicot", name: "Le trésor de la Capitaine Coquelicot", status: "PUBLISHED", needsReview: false,
  publicUrl: "https://boutique.test/aventures/tresor-capitaine-coquelicot", editUrl: "https://boutique.test/admin/produits/p1",
  images: [{ id: "i1", url: "/images/seed/coquelicot-couverture.webp", role: "MAIN" }], files: [],
  tagline: "10 énigmes, une carte secrète", shortDescription: "Chasse au trésor pirates.", template: "ADVENTURE", universe: "Pirates",
  category: { id: "c1", slug: "chasses-au-tresor", name: "Chasses au trésor" }, collections: [{ id: "k", slug: "pirates", name: "Pirates" }],
  priceCents: 990, salePriceCents: null, currency: "EUR", ageMin: 5, ageMax: 8, salesCount: 3, tags: ["pirates"], kitContents: [{ title: "Carte au trésor" }],
} as unknown as ShopProduct;

describe("import d'un produit de la boutique", () => {
  it("entrée de catalogue : URL absolue, type proposé, livre lié", () => {
    const e = toCatalogEntry(product, "https://boutique.test", new Map([["p1", { id: "b1", title: "Coquelicot" }]]));
    expect(e.imageUrl).toBe("https://boutique.test/images/seed/coquelicot-couverture.webp");
    expect(e.suggestedKitType).toBe("chasse-au-tresor");
    expect(e.linkedBook).toEqual({ id: "b1", title: "Coquelicot" });
    expect(toCatalogEntry(product, "https://boutique.test", new Map()).linkedBook).toBeNull();
  });

  it("fiche commerciale du studio pré-remplie et âge", () => {
    const l = listingFromProduct(product);
    expect(l).toMatchObject({ name: product.name, slug: product.slug, priceCents: 990, categorySlug: "chasses-au-tresor", template: "ADVENTURE", universe: "Pirates", ageMin: 5, ageMax: 8, collectionSlugs: ["pirates"] });
    expect(ageRangeFromProduct(product, "3-10")).toBe("5-8");
    expect(ageRangeFromProduct({ ...product, ageMin: null } as unknown as ShopProduct, "3-10")).toBe("3-10");
  });
});

describe("fiche boutique d'un kit", () => {
  it("utilise le type de kit, la personnalisation et la section boutique du contenu", () => {
    const hunt = mockTreasureHunt({ count: 10, heroName: "Commandante Stella" });
    const book = {
      id: "cmw000000000000000kit01", title: "Mission astronaute", subtitle: null, kitType: "chasse-au-tresor", bookType: "chasse-au-tresor", ageRange: "5-8", targetCount: 10,
      kitContent: hunt, customization: { universe: "Espace", priceCents: 1090 }, shopListing: null, shopProductSlug: null, cover: null, brief: null, activities: [], exports: [],
    } as unknown as BookForListing;
    const l = buildListingFromBook(book, DEFAULT_SHOP_SETTINGS);
    expect(l.categorySlug).toBe("chasses-au-tresor");
    expect(l.template).toBe("ADVENTURE");
    expect(l.universe).toBe("Espace");
    expect(l.priceCents).toBe(1090);
    expect(l.ageMin).toBe(5);
    expect((l.kitContents ?? []).length).toBeGreaterThan(3);
  });
});
