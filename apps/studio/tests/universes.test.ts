import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Paramètres en mémoire : la boutique est « configurée » ou non selon le test.
const shop = { shopApiUrl: "", shopApiKey: "" };
vi.mock("../src/lib/settings", () => ({
  getShopSettings: async () => ({ ...shop }),
  getStudioSettings: async () => ({ defaultSiteSlug: null, illustrationCharters: {}, illustrationCharter: "" }),
}));

import { PRESETS, UNIVERSE_PRESETS, charterFor, isPreset } from "@/lib/universes/presets";
import { DEFAULT_SITE_SLUG, FALLBACK_SITES, groupByAudience, parseSites } from "@/lib/universes/sites";
import { activeSites, clearSitesCache, defaultSiteSlug, loadSites, presetForBook } from "@/lib/universes";
import { KIT_TYPES, defaultTypeForPreset, isAdultAge, kitType, typeAllowedForPreset, typesForPreset } from "@/lib/kits/types";
import { BUILTIN_TEMPLATES, themeForPreset } from "@/lib/layout/themes";
import { GuideSchema, KIT_CONTENT_SCHEMAS, RecipesSchema, ScienceSchema, detectKitContentFormat } from "@/lib/kits/schemas";
import { mockGuide, mockKitPlan, mockRecipes, mockScience } from "@/lib/kits/mock";
import { briefToPlanPrompt, contentPromptFor, systemPromptFor } from "@/lib/kits/prompts";
import { planFromContent, withSite } from "@/lib/kits/create";
import { buildGuideBookPages, buildRecipesBookPages, buildScienceBookPages } from "@/lib/kits/pages-universes";
import { kitIllustrationPlan } from "@/lib/kits/generate";
import { checkKitContent } from "@/lib/autopilot/quality";
import { MockTextProvider } from "@/lib/ai/text/mock";
import { contextBlock } from "@/lib/ai/structured";
import { PageLayoutSchema } from "@/lib/schemas/layout";
import { buildListingFromBook, type BookForListing } from "@/lib/shop/publish";
import { DEFAULT_SHOP_SETTINGS } from "@/lib/schemas/settings";
import { MANUAL_SCHEMA_BY_PURPOSE } from "@/lib/ai/manual-schemas";
import { cleanPastedJson } from "@/lib/ai/manual-core";
import { extractJson } from "@/lib/ai/structured";
import { KitCustomizationSchema } from "@/lib/kits/schemas";

const LIVE_SITES = [
  { id: "s1", slug: "la-malle-a-jeux", name: "La Malle à Jeux", preset: "kit-enfants", status: "ACTIVE", audience: { slug: "familles", name: "Familles & enfants" }, primaryDomain: "lamalleajeux.fr", url: "https://lamalleajeux.fr", categories: [{ slug: "chasses-au-tresor", name: "Chasses au trésor" }] },
  { id: "s2", slug: "piscine-facile", name: "Piscine Facile", preset: "guide-expert", status: "TEST", audience: { slug: "maison", name: "Maison & jardin" }, primaryDomain: "piscine-facile.fr", url: "https://piscine-facile.fr", categories: [{ slug: "guides-pratiques", name: "Guides pratiques" }, { slug: "entretien", name: "Entretien" }] },
  { id: "s3", slug: "ancien", name: "Ancien univers", preset: "recettes", status: "ARCHIVED", audience: { slug: "cuisine", name: "Cuisine" }, primaryDomain: null, url: null, categories: [] },
];

function mockFetch(status: number, body: unknown) {
  return vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
}

const ctx = { widthMm: 210, heightMm: 297, theme: themeForPreset("guide-expert") };

beforeEach(() => {
  clearSitesCache();
  shop.shopApiUrl = "";
  shop.shopApiKey = "";
});
afterEach(() => vi.unstubAllGlobals());

describe("préréglages d'univers", () => {
  it("chaque préréglage a une charte, un ton, un prompt système et un thème PDF existant", () => {
    for (const p of UNIVERSE_PRESETS) {
      const def = PRESETS[p];
      expect(def.key).toBe(p);
      expect(def.charter.length).toBeGreaterThan(40);
      expect(def.system.length).toBeGreaterThan(40);
      expect(BUILTIN_TEMPLATES.some((t) => t.key === def.themeKey)).toBe(true);
      expect(themeForPreset(p).templateKey).toBe(def.themeKey);
    }
    expect(isPreset("guide-expert")).toBe(true);
    expect(isPreset("inconnu")).toBe(false);
  });

  it("le guide expert interdit les promesses irréalistes et impose la sécurité chimique", () => {
    const sys = PRESETS["guide-expert"].system.toLowerCase();
    expect(sys).toMatch(/promesse/);
    expect(sys).toMatch(/chimique|sécurité/);
    expect(systemPromptFor(PRESETS["guide-expert"])).toBe(PRESETS["guide-expert"].system);
  });

  it("charte : surcharge par préréglage, sinon charte historique pour les kits enfants, sinon charte intégrée", () => {
    expect(charterFor("guide-expert", { "guide-expert": "Ma charte" })).toBe("Ma charte");
    expect(charterFor("kit-enfants", {}, "Charte historique")).toBe("Charte historique");
    expect(charterFor("guide-expert", {}, "Charte historique")).toBe(PRESETS["guide-expert"].charter);
  });
});

describe("types d'e-books filtrés par univers", () => {
  it("guide expert → guides pratiques uniquement ; kit enfants → pas de guide adulte", () => {
    expect(typesForPreset("guide-expert").map((k) => k.key)).toEqual(["guide-pratique"]);
    expect(typesForPreset("recettes").map((k) => k.key)).toEqual(["livre-recettes"]);
    expect(typesForPreset("sciences-enfants").map((k) => k.key)).toContain("fiches-sciences");
    const kids = typesForPreset("kit-enfants").map((k) => k.key);
    expect(kids).toContain("chasse-au-tresor");
    expect(kids).not.toContain("guide-pratique");
    expect(typeAllowedForPreset("guide-pratique", "kit-enfants")).toBe(false);
    expect(typeAllowedForPreset("guide-pratique", null)).toBe(true);
    expect(typesForPreset(null)).toHaveLength(KIT_TYPES.length);
  });

  it("type par défaut et public adulte", () => {
    expect(defaultTypeForPreset("guide-expert")).toBe("guide-pratique");
    expect(defaultTypeForPreset("kit-enfants")).toBe("chasse-au-tresor");
    expect(kitType("guide-pratique").template).toBe("GUIDE");
    expect(kitType("livre-recettes").template).toBe("RECIPES");
    expect(isAdultAge("18-99")).toBe(true);
    expect(isAdultAge("5-8")).toBe(false);
  });
});

describe("univers de la boutique (GET /api/v1/sites)", () => {
  it("normalise la réponse : préréglage inconnu → kit-enfants, statut inconnu → ACTIVE", () => {
    const sites = parseSites([{ slug: "x", name: "X", preset: "bizarre", status: "??", audience: null }, { nope: true }]);
    expect(sites).toHaveLength(1);
    expect(sites[0].preset).toBe("kit-enfants");
    expect(sites[0].status).toBe("ACTIVE");
    expect(sites[0].audience.name).toBe("Sans audience");
  });

  it("boutique non configurée → univers de repli « La Malle à Jeux »", async () => {
    const r = await loadSites();
    expect(r.source).toBe("fallback");
    expect(r.sites).toEqual(FALLBACK_SITES);
    expect(r.sites[0].slug).toBe(DEFAULT_SITE_SLUG);
    expect(r.sites[0].preset).toBe("kit-enfants");
    expect(r.sites[0].categories.length).toBeGreaterThan(0);
  });

  it("/sites répond 404 → repli avec message explicite", async () => {
    shop.shopApiUrl = "http://boutique.test";
    shop.shopApiKey = "cle";
    const fetch = mockFetch(404, { error: "Not found" });
    vi.stubGlobal("fetch", fetch);
    const r = await loadSites();
    expect(fetch).toHaveBeenCalledOnce();
    expect(String(fetch.mock.calls[0][0])).toBe("http://boutique.test/api/v1/sites");
    expect(r.source).toBe("fallback");
    expect(r.sites.map((s) => s.slug)).toEqual([DEFAULT_SITE_SLUG]);
    expect(r.error).toMatch(/univers/);
  });

  it("liste live : groupée par audience, univers archivés exclus des choix, cache 60 s", async () => {
    shop.shopApiUrl = "http://boutique.test";
    shop.shopApiKey = "cle";
    const fetch = mockFetch(200, { data: LIVE_SITES });
    vi.stubGlobal("fetch", fetch);
    const r = await loadSites();
    expect(r.source).toBe("live");
    expect(r.sites).toHaveLength(3);
    expect(groupByAudience(r.sites).map((g) => g.audience)).toEqual(["Familles & enfants", "Maison & jardin", "Cuisine"]);
    expect((await activeSites()).map((s) => s.slug)).toEqual(["la-malle-a-jeux", "piscine-facile"]);
    expect(await defaultSiteSlug()).toBe("la-malle-a-jeux");
    expect(fetch).toHaveBeenCalledOnce(); // le cache évite le second appel
    expect((await presetForBook({ siteSlug: "piscine-facile", kitType: "chasse-au-tresor" })).key).toBe("guide-expert");
    expect((await presetForBook({ siteSlug: null, kitType: "guide-pratique" })).key).toBe("guide-expert");
  });
});

describe("plan depuis un brief avec choix d'univers", () => {
  it("le prompt de plan liste les univers, leurs types et catégories, et demande siteSlug", () => {
    const p = briefToPlanPrompt("guide piscine eau verte", parseSites(LIVE_SITES));
    expect(p).toContain("piscine-facile");
    expect(p).toContain("guide-pratique");
    expect(p).toContain("guides-pratiques");
    expect(p).toContain("siteSlug");
  });

  it("brief « guide piscine eau verte » (démo) → guide pratique dans l'univers guide expert", () => {
    const plan = mockKitPlan({ brief: "Guide piscine eau verte pour particuliers", sites: "la-malle-a-jeux:kit-enfants,piscine-facile:guide-expert" });
    expect(plan.kitType).toBe("guide-pratique");
    expect(plan.siteSlug).toBe("piscine-facile");
    expect(plan.ageRange).toBe("18-99");
    expect(plan.title).toMatch(/eau verte/i);
    const kids = mockKitPlan({ brief: "chasse au trésor dinosaures", sites: "la-malle-a-jeux:kit-enfants,piscine-facile:guide-expert" });
    expect(kids.siteSlug).toBe("la-malle-a-jeux");
  });

  it("univers imposé : type rendu compatible et catégorie prise dans l'univers", async () => {
    shop.shopApiUrl = "http://boutique.test";
    shop.shopApiKey = "cle";
    vi.stubGlobal("fetch", mockFetch(200, { data: LIVE_SITES }));
    const base = mockKitPlan({ brief: "chasse au trésor pirates" });
    const forced = await withSite(base, "piscine-facile");
    expect(forced.siteSlug).toBe("piscine-facile");
    expect(forced.kitType).toBe("guide-pratique");
    expect(forced.shopCategorySlug).toBe("guides-pratiques");
    const kept = await withSite(mockKitPlan({ brief: "guide piscine", sites: "piscine-facile:guide-expert" }));
    expect(kept.siteSlug).toBe("piscine-facile");
    const unknown = await withSite({ ...base, siteSlug: "inexistant" });
    expect(unknown.siteSlug).toBe("la-malle-a-jeux");
  });
});

describe("génération démo du guide pratique", () => {
  it("le fournisseur démo produit un guide valide pour le prompt de contenu", async () => {
    const def = kitType("guide-pratique");
    const prompt = contentPromptFor("guide", { def, title: "Fini l'eau verte", ageRange: "18-99", count: 8, c: KitCustomizationSchema.parse({}) }) + "\n\n" + contextBlock("kit_guide", { title: "Fini l'eau verte", count: 8 });
    expect(prompt).toMatch(/chapitres/);
    const res = await new MockTextProvider().complete({ system: systemPromptFor(PRESETS["guide-expert"]), prompt, model: "mock", json: true });
    const guide = GuideSchema.parse(JSON.parse(res.text));
    expect(guide.chapitres).toHaveLength(8);
    expect(detectKitContentFormat(guide)).toBe("guide");
  });

  it("contenu démo : contrôle qualité OK, plan importé, illustrations et pages", () => {
    const guide = mockGuide({ count: 8 });
    expect(KIT_CONTENT_SCHEMAS.guide.safeParse(guide).success).toBe(true);
    const q = checkKitContent(guide, { expectedCount: 8 });
    expect(q.issues.filter((i) => i.level === "error")).toEqual([]);
    expect(q.ok).toBe(true);
    const plan = planFromContent("guide", guide);
    expect(plan.kitType).toBe("guide-pratique");
    expect(plan.count).toBe(8);
    const slots = kitIllustrationPlan(guide).map((s) => s.slot);
    expect(slots).toContain("guide-probleme");
    expect(slots).toContain("chapitre-1");
    const pages = buildGuideBookPages(ctx, guide, {});
    expect(pages.length).toBeGreaterThanOrEqual(8 + 2);
    for (const p of pages) {
      PageLayoutSchema.parse(p.layout);
      for (const b of p.layout.blocks) expect(b.y + b.h).toBeLessThanOrEqual(ctx.heightMm + 0.5);
    }
    const text = JSON.stringify(pages);
    expect(text).toContain("Checklist");
    expect(text).toContain("Sécurité");
  });

  it("contrôle qualité : produit chimique sans sécurité ou promesse irréaliste → bloquant", () => {
    const guide = mockGuide({ count: 2 });
    const noSafety = checkKitContent({ ...guide, securite: [] }, { expectedCount: 2 });
    expect(noSafety.ok).toBe(false);
    const promise = checkKitContent({ ...guide, introduction: guide.introduction + " Résultat garanti en 72 h !" }, { expectedCount: 2 });
    expect(promise.ok).toBe(false);
  });

  it("recettes et fiches sciences démo : schémas, pages et qualité", () => {
    const r = RecipesSchema.parse(mockRecipes({ count: 3 }));
    expect(checkKitContent(r, { expectedCount: 3 }).ok).toBe(true);
    expect(buildRecipesBookPages({ ...ctx, theme: themeForPreset("recettes") }, r, {}).length).toBeGreaterThanOrEqual(4);
    const s = ScienceSchema.parse(mockScience({ count: 3 }));
    expect(checkKitContent(s, { expectedCount: 3 }).ok).toBe(true);
    expect(buildScienceBookPages({ ...ctx, theme: themeForPreset("sciences-enfants") }, s, {}).length).toBeGreaterThanOrEqual(4);
    expect(planFromContent("recipes", r).kitType).toBe("livre-recettes");
    expect(planFromContent("science", s).kitType).toBe("fiches-sciences");
  });

  it("fiche boutique du guide : modèle GUIDE, univers (siteSlug), sans tranche d'âge enfant", () => {
    const guide = mockGuide({ count: 8 });
    const book = {
      id: "cmw000000000000000guide1", title: guide.titre, subtitle: null, kitType: "guide-pratique", bookType: "guide-pratique", ageRange: "18-99", targetCount: 8, siteSlug: "piscine-facile",
      kitContent: guide, customization: {}, shopListing: null, shopProductSlug: null, cover: null, brief: null, activities: [], exports: [],
    } as unknown as BookForListing;
    const l = buildListingFromBook(book, DEFAULT_SHOP_SETTINGS) as ReturnType<typeof buildListingFromBook> & { siteSlug?: string };
    expect(l.template).toBe("GUIDE");
    expect(l.categorySlug).toBe("guides-pratiques");
    expect(l.siteSlug).toBe("piscine-facile");
    expect(l.ageMin).toBeUndefined();
    expect(l.longDescription).toContain("Au sommaire");
  });

  it("copier-coller : la réponse JSON d'un guide collée (avec balises) est reconnue et validée", () => {
    const pasted = "Voici le guide :\n```json\n" + JSON.stringify(mockGuide({ count: 3 })) + "\n```";
    const json = extractJson(cleanPastedJson(pasted));
    expect(MANUAL_SCHEMA_BY_PURPOSE.kit_guide.schema.safeParse(json).success).toBe(true);
    expect(detectKitContentFormat(json)).toBe("guide");
  });
});
