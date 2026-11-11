import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { ColoringSchema, KitPlanSchema, KitCustomizationSchema, TreasureHuntSchema, itemSchemaFor, KIT_CONTENT_SCHEMAS } from "@/lib/kits/schemas";
import { MAX_ITEMS_PER_BOOK, pdfTimeoutMs } from "@/lib/kits/limits";
import { assembleContent, cleanOutline, mergeBatchItems, needsBatching, planBatches, readDraft, draftKey, runPool } from "@/lib/kits/batches";
import { mockColoring, mockItems, mockOutline, mockTreasureHunt } from "@/lib/kits/mock";
import { contentTokens, coloringApiImageEstimate, estimateRun, illustrationCount } from "@/lib/autopilot/estimate";
import { DEFAULT_AI_SETTINGS, DEFAULT_AUTOPILOT_SETTINGS, AiSettingsSchema } from "@/lib/schemas/settings";
import { ensureLineArt, isLineArt, lineArtStats } from "@/lib/images/lineart";
import { buildColoringPages } from "@/lib/kits/pages-coloring";
import { ColoringOptionsSchema } from "@/lib/kits/schemas";
import { coloringComplexity, drawingPrompt } from "@/lib/kits/coloring";
import { previewPageIndices } from "@/lib/shop/publish";
import { withVariant } from "@/lib/images/variant-url";
import { kitType } from "@/lib/kits/types";
import { kitIllustrationPlan } from "@/lib/kits/generate";
import { bookCoverSettings, bookImageSettings, bookTextSettings } from "@/lib/ai/book-settings";
import { hidingPlacesFor, itemsBatchPrompt } from "@/lib/kits/prompts";
import { checkKitContent } from "@/lib/autopilot/quality";
import type { BuildContext } from "@/lib/layout/engine";

const ctx = { widthMm: 210, heightMm: 297, theme: { marginMm: 15, colorPrimary: "#1d4ed8", colorSecondary: "#f59e0b", colorText: "#111", colorBackground: "#fff", colorPanel: "#f8fafc", fontBody: "Nunito", fontHeading: "Nunito", baseFontPt: 11 } } as unknown as BuildContext;

describe("plus de plafond artificiel", () => {
  it("accepte un plan et un cahier de 120 dessins, refuse au-delà de la limite technique", () => {
    expect(KitPlanSchema.parse({ kitType: "cahier-coloriage", title: "Dinos", count: 120 }).count).toBe(120);
    expect(KitCustomizationSchema.parse({ count: 300 }).count).toBe(300);
    expect(ColoringSchema.safeParse(mockColoring({ count: 120 })).success).toBe(true);
    expect(TreasureHuntSchema.safeParse(mockTreasureHunt({ count: 40 })).success).toBe(true);
    expect(KitPlanSchema.safeParse({ kitType: "x", title: "Trop", count: MAX_ITEMS_PER_BOOK + 1 }).success).toBe(false);
  });
  it("au-delà de 12 cachettes, le prompt laisse l'auteur inventer sans répétition", () => {
    expect(hidingPlacesFor(30)).toMatch(/puis 6 autres cachettes/);
    expect(new Set(mockTreasureHunt({ count: 40 }).enigmes.map((e) => e.cachette)).size).toBe(40);
  });
  it("délai PDF proportionnel au nombre de pages", () => {
    expect(pdfTimeoutMs(130)).toBeGreaterThan(pdfTimeoutMs(20));
  });
  it("le cahier de coloriage illustre chaque dessin (120 + exemple + 2 visuels)", () => {
    const plan = kitIllustrationPlan(mockColoring({ count: 120 }), { ageRange: "3-5", customization: {} });
    expect(plan.filter((p) => p.slot.startsWith("dessin-"))).toHaveLength(120);
    expect(plan.some((p) => p.slot === "exemple-colore")).toBe(true);
    expect(plan.find((p) => p.slot === "dessin-1")!.prompt).toMatch(/3–5 ans/);
  });
});

describe("rédaction par lots", () => {
  it("découpe 120 éléments en 8 lots de 15 et fusionne un petit reste", () => {
    expect(needsBatching(20)).toBe(false);
    expect(needsBatching(21)).toBe(true);
    const b = planBatches(120);
    expect(b).toHaveLength(8);
    expect(b.every((x) => x.to - x.from + 1 === 15)).toBe(true);
    const odd = planBatches(46);
    expect(odd[odd.length - 1].to).toBe(46);
    expect(odd).toHaveLength(3);
  });
  it("fusion sans doublons, renumérotée, avec le nombre d'éléments manquants", () => {
    const a = [{ numero: 1, titre: "Le T-rex" }, { numero: 2, titre: "Tricératops" }];
    const b = [{ numero: 1, titre: "le t-rex !" }, { numero: 2, titre: "Diplodocus" }];
    const m = mergeBatchItems("coloring", [a, b], 4);
    expect(m.items.map((x) => x.numero)).toEqual([1, 2, 3]);
    expect(m.duplicates).toBe(1);
    expect(m.missing).toBe(1);
    expect(cleanOutline([{ numero: 3, titre: "A" }, { numero: 9, titre: "a" }, { numero: 4, titre: "B" }], 5)).toEqual([{ numero: 1, titre: "A", idee: undefined }, { numero: 2, titre: "B", idee: undefined }]);
  });
  it("sommaire + cadre + lots (démonstration) donnent un contenu valide de 120 dessins", () => {
    const outline = cleanOutline(mockOutline({ format: "coloring", count: 120, universe: "Dinosaures" }).elements, 120);
    expect(outline).toHaveLength(120);
    const ranges = planBatches(120);
    const frame = mockColoring({ count: ranges[0].to, universe: "Dinosaures", titles: outline.slice(0, 15).map((o) => o.titre) }) as unknown as Record<string, unknown>;
    const batches = ranges.slice(1).map((r) => mockItems({ format: "coloring", from: r.from, to: r.to, titles: outline.slice(r.from - 1, r.to).map((o) => o.titre) }).items);
    const items = batches.flat();
    expect(itemSchemaFor("coloring").safeParse(items[0]).success).toBe(true);
    const merged = mergeBatchItems("coloring", [frame.dessins as Array<Record<string, unknown>>, ...batches], 120);
    expect(merged.missing).toBe(0);
    const content = KIT_CONTENT_SCHEMAS.coloring.parse(assembleContent("coloring", frame, merged.items));
    expect(content.dessins).toHaveLength(120);
    expect(content.dessins[119].numero).toBe(120);
    expect(checkKitContent(content, { expectedCount: 120 }).ok).toBe(true);
  });
  it("le prompt d'un lot ne dépend que du sommaire (collage dans n'importe quel ordre)", () => {
    const def = kitType("cahier-coloriage");
    const args = { def, title: "Dinos", ageRange: "3-5", count: 120, c: KitCustomizationSchema.parse({ universe: "Dinosaures" }) };
    const slice = [{ numero: 16, titre: "Stégosaure" }, { numero: 17, titre: "Ptérodactyle" }];
    expect(itemsBatchPrompt("coloring", args, slice, { total: 120 })).toBe(itemsBatchPrompt("coloring", args, slice, { total: 120 }));
    expect(itemsBatchPrompt("coloring", args, slice, { total: 120 })).toMatch(/dessins 16 à 17 \(sur 120\)/);
  });
  it("brouillon : une autre clé (nombre changé) repart de zéro ; pool à concurrence bornée", async () => {
    const k = draftKey({ format: "coloring", count: 120, title: "A", ageRange: "3-5" });
    expect(readDraft({ key: k, batches: { 1: [] } }, k).batches).toHaveProperty("1");
    expect(readDraft({ key: "autre", batches: { 1: [] } }, k).batches).toEqual({});
    let running = 0;
    let peak = 0;
    const res = await runPool(Array.from({ length: 10 }, (_, i) => async () => { running++; peak = Math.max(peak, running); await new Promise((r) => setTimeout(r, 5)); running--; if (i === 3) throw new Error("x"); return i; }), 3);
    expect(peak).toBeLessThanOrEqual(3);
    expect(res.filter((r) => !r.ok)).toHaveLength(1);
  });
});

describe("coût à grand nombre", () => {
  const ai = { ...DEFAULT_AI_SETTINGS, textProvider: "anthropic" as const, imageProvider: "openai" as const };
  it("cahier de 120 dessins : gpt-image-1-mini medium portrait, sans esquisse, détail par poste", () => {
    const e = estimateRun({ format: "coloring", count: 120, contentProvided: false, ai, autopilot: DEFAULT_AUTOPILOT_SETTINGS, runwayUsdPerSecond: 0.05 });
    expect(illustrationCount("coloring", 120)).toBe(124);
    // 123 images intérieures × 0,011 × 1,5 (portrait) + couverture gpt-image-1 high 0,167
    expect(e.stages.illustrations).toBeCloseTo(123 * 0.0165 + 0.167, 2);
    expect(e.lines.illustrations).toMatch(/123 images × 0\.017 \$ \(gpt-image-1-mini, medium\)/);
    expect(e.notes.join(" ")).toMatch(/pas d'esquisse/);
    expect(e.lines.content).toMatch(/sommaire \+ lots de 15/);
    expect(contentTokens("coloring", 120).calls).toBe(9);
    const api = coloringApiImageEstimate(ai, 120);
    expect(api.label).toMatch(/^≈ 123 images × 0\.017 \$ \+ couverture 0\.17 \$ = 2\.20 \$$/);
  });
});

describe("réglages IA d'un cahier de coloriage", () => {
  const base = AiSettingsSchema.parse({ mode: "manual", manualFor: "all", textProvider: "anthropic", imageProvider: "openai" });
  it("mode mixte : texte en copier-coller, images par l'API ; couverture en gpt-image-1 high", () => {
    const book = { kitType: "cahier-coloriage", customization: { ai: { textVia: "manual", imagesVia: "api" } } };
    const img = bookImageSettings(base, book);
    expect(img.mode).toBe("manual");
    expect(img.manualFor).toBe("text");
    expect(img.imageModel).toBe("gpt-image-1-mini");
    expect(img.sketchMode).toBe(false);
    expect(bookTextSettings(base, book).manualFor).toBe("text");
    expect(bookCoverSettings(base, book)).toMatchObject({ imageModel: "gpt-image-1", imageQuality: "high" });
    expect(bookImageSettings(base, { kitType: "chasse-au-tresor", customization: {} }).imageModel).toBe("gpt-image-1");
  });
});

describe("noir et blanc", () => {
  it("détecte le gris et convertit par seuillage sans regénération", async () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600"><rect width="100%" height="100%" fill="#fff"/><circle cx="200" cy="300" r="120" fill="#bbbbbb" stroke="#000" stroke-width="8"/><rect x="40" y="40" width="80" height="80" fill="#3388ff"/></svg>`;
    const img = await sharp(Buffer.from(svg)).png().toBuffer();
    expect(isLineArt(await lineArtStats(img))).toBe(false);
    const r = await ensureLineArt(img);
    expect(r.converted).toBe(true);
    expect(isLineArt(r.stats)).toBe(true);
  });
});

describe("gabarits du cahier de coloriage", () => {
  const content = ColoringSchema.parse(mockColoring({ count: 120 }));
  const images = { "exemple-colore": { src: "/api/assets/x", isDemo: false } };
  it("une page par dessin + appartient + exemple + diplôme ; recto-verso et sommaire", () => {
    const base = buildColoringPages(ctx, content, images, ColoringOptionsSchema.parse({}));
    expect(base).toHaveLength(1 + 1 + 120 + 1);
    expect(base.filter((p) => p.templateKey === "coloring_drawing")).toHaveLength(120);
    const drawing = base.find((p) => p.templateKey === "coloring_drawing")!;
    expect(drawing.layout.blocks.find((b) => b.type === "image")).toMatchObject({ fit: "contain" });
    const duplex = buildColoringPages(ctx, content, images, ColoringOptionsSchema.parse({ duplex: true, toc: true, childName: "Léa" }));
    expect(duplex.filter((p) => p.templateKey === "coloring_blank")).toHaveLength(120);
    expect(duplex.filter((p) => p.templateKey === "coloring_toc")).toHaveLength(3);
    expect(JSON.stringify(duplex[0].layout)).toMatch(/Léa/);
  });
  it("complexité selon l'âge", () => {
    expect(coloringComplexity("3-5").level).toBe("simple");
    expect(coloringComplexity("5-8").level).toBe("moyen");
    expect(coloringComplexity("8-10").level).toBe("detaille");
    expect(drawingPrompt(content.dessins[0], "8-10")).toMatch(/8–10 ans/);
  });
});

describe("aperçu et boutique à grand volume", () => {
  it("vignettes : 8 pages réparties sur un livre de 130 pages, sans couverture ni quatrième", () => {
    const idx = previewPageIndices(130, 8);
    expect(idx).toHaveLength(8);
    expect(new Set(idx).size).toBe(8);
    expect(Math.min(...idx)).toBe(1);
    expect(Math.max(...idx)).toBeLessThanOrEqual(128);
    expect(previewPageIndices(5, 3)).toEqual([1, 2, 3]);
  });
  it("déclinaisons d'images légères (vignettes, écran, PDF numérique)", () => {
    expect(withVariant("/api/assets/abc", "thumb")).toBe("/api/assets/abc?v=thumb");
    expect(withVariant("/api/assets/abc?pt=1", "digital")).toBe("/api/assets/abc?pt=1&v=digital");
    expect(withVariant("https://cdn/x.png", "thumb")).toBe("https://cdn/x.png");
    expect(withVariant("/api/assets/abc", undefined)).toBe("/api/assets/abc");
  });
});
