import { describe, expect, it } from "vitest";
import sharp from "sharp";
import {
  AUTO_CONTAIN_MISMATCH,
  compositionHints,
  effectiveDpi,
  effectiveFit,
  framingStyle,
  nearestRatio,
  ratioForSlot,
  ratioMismatch,
  sizeForRatio,
  visibleWindow,
} from "@/lib/images/framing";
import { analyzeImage, focalPoint } from "@/lib/images/analyze";
import { applyFramingToLayout } from "@/lib/images/service";
import { checkLayoutImages, type ImageInfo } from "@/lib/quality/images";
import { needsGeneration } from "@/lib/generation/regen-policy";
import { reworkPrompt, reworkQuality, reworkRatio } from "@/lib/generation/rework";
import { useSketch } from "@/lib/generation/sketch";
import { createPreviewToken, verifyPreviewToken } from "@/lib/preview/token";
import { applyOutcome, approveCurrent, initStages, markStarted } from "@/lib/autopilot/stages";
import { AutopilotSettingsSchema } from "@/lib/schemas/settings";
import { estimateRun } from "@/lib/autopilot/estimate";
import type { PageLayout } from "@/lib/schemas/layout";

describe("format cible et taille demandée", () => {
  it("choisit la taille GPT Image selon le ratio", () => {
    expect(sizeForRatio("portrait")).toBe("1024x1536");
    expect(sizeForRatio("landscape")).toBe("1536x1024");
    expect(sizeForRatio("square")).toBe("1024x1024");
  });
  it("associe chaque emplacement à son format", () => {
    expect(ratioForSlot("carte")).toBe("portrait");
    expect(ratioForSlot("diplome")).toBe("portrait");
    expect(ratioForSlot("enigme-image-3")).toBe("portrait");
    expect(ratioForSlot("lettre")).toBe("landscape");
    expect(ratioForSlot("idee-12")).toBe("landscape");
    expect(ratioForSlot("planche-personnages")).toBe("landscape");
    expect(ratioForSlot("visuel-story")).toBe("portrait");
    expect(ratioForSlot(null, "COVER")).toBe("square");
    expect(ratioForSlot(null, "FINAL")).toBe("square");
  });
  it("trouve le ratio le plus proche d'un cadre", () => {
    expect(nearestRatio(81, 119)).toBe("portrait");
    expect(nearestRatio(180, 107)).toBe("landscape");
    expect(nearestRatio(100, 96)).toBe("square");
  });
  it("ajoute marges de sécurité, zones réservées et « aucun texte » au prompt", () => {
    const h = compositionHints("diplome");
    expect(h).toMatch(/portrait \(2:3\)/);
    expect(h).toMatch(/10 %/);
    expect(h).toMatch(/Aucun texte/);
    expect(compositionHints("visuel-story")).toMatch(/zones réservées/);
  });
});

describe("écart de format et résolution d'impression", () => {
  it("mesure l'écart de format", () => {
    expect(ratioMismatch(1024, 1024, 100, 100)).toBe(0);
    expect(ratioMismatch(1024, 1536, 58, 123)).toBeCloseTo(0.415, 2); // ancien cadre du diplôme : trop étroit
    expect(ratioMismatch(1536, 1024, 142, 89)).toBeLessThan(AUTO_CONTAIN_MISMATCH); // nouveau cadre des idées
  });
  it("passe automatiquement en « ajuster » au-delà de 25 % d'écart, sauf choix manuel", () => {
    expect(effectiveFit({ imgW: 1536, imgH: 1024, frameW: 180, frameH: 55 })).toBe("contain");
    expect(effectiveFit({ imgW: 1536, imgH: 1024, frameW: 150, frameH: 95 })).toBe("cover");
    expect(effectiveFit({ fit: "cover", imgW: 1536, imgH: 1024, frameW: 180, frameH: 55 })).toBe("cover");
  });
  it("calcule la résolution effective (cover, contain, zoom)", () => {
    // 1024 px sur 86,7 mm (3,41 pouces) ≈ 300 ppp
    expect(effectiveDpi({ imgW: 1024, imgH: 1024, frameWmm: 86.7, frameHmm: 86.7, fit: "cover" })).toBe(300);
    // Pleine page A4 en carré 1024 : ≈ 105 ppp en remplissage (limite)
    expect(effectiveDpi({ imgW: 1024, imgH: 1024, frameWmm: 210, frameHmm: 297, fit: "cover" })).toBeLessThan(150);
    // Le zoom divise la résolution
    expect(effectiveDpi({ imgW: 1024, imgH: 1024, frameWmm: 86.7, frameHmm: 86.7, fit: "cover", zoom: 2 })).toBe(150);
    // Ajuster : l'image tient entière, résolution sur le plus grand côté
    expect(effectiveDpi({ imgW: 1536, imgH: 1024, frameWmm: 130, frameHmm: 130, fit: "contain" })).toBe(300);
  });
});

describe("styles de cadrage (aperçu = PDF)", () => {
  it("convertit le point focal en object-position, sans déformation", () => {
    expect(framingStyle({ fit: "cover", focalX: 0.75, focalY: 0.25 })).toEqual({ objectFit: "cover", objectPosition: "75% 25%" });
    expect(framingStyle({ fit: "contain", focalX: 0.1, focalY: 0.9 })).toEqual({ objectFit: "contain", objectPosition: "50% 50%" });
    const z = framingStyle({ fit: "cover", focalX: 0.3, focalY: 0.6, zoom: 1.5 });
    expect(z.transform).toBe("scale(1.5)");
    expect(z.transformOrigin).toBe("30% 60%");
  });
  it("garde le point focal dans la zone visible", () => {
    const w = visibleWindow({ imgW: 1536, imgH: 1024, frameW: 100, frameH: 100, focalX: 0.9, focalY: 0.5 });
    expect(0.9).toBeGreaterThanOrEqual(w.x0);
    expect(0.9).toBeLessThanOrEqual(w.x1);
    const z = visibleWindow({ imgW: 1024, imgH: 1024, frameW: 100, frameH: 100, focalX: 0.2, focalY: 0.8, zoom: 2 });
    expect(z.vw).toBeCloseTo(0.5);
    expect(0.2).toBeGreaterThanOrEqual(z.x0);
    expect(0.8).toBeLessThanOrEqual(z.y1);
  });
});

describe("point focal automatique (sharp attention, sans IA)", () => {
  async function testImage() {
    // Fond clair uniforme, un sujet coloré et contrasté en haut à droite
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#f4efe6"/><circle cx="620" cy="140" r="70" fill="#d9342b"/><circle cx="600" cy="120" r="14" fill="#111"/><rect x="560" y="200" width="120" height="30" fill="#1d4ed8"/></svg>`;
    return sharp(Buffer.from(svg)).png().toBuffer();
  }
  it("trouve la zone d'intérêt d'une image générée pour le test", async () => {
    const img = await testImage();
    const f = await focalPoint(img, "attention");
    expect(f.focalX).toBeGreaterThan(0.6);
    expect(f.focalY).toBeLessThan(0.45);
    const a = await analyzeImage(img);
    expect(a.width).toBe(800);
    expect(a.height).toBe(600);
    expect(a.focalX).toBeGreaterThan(0.6);
    expect(a.dominantColor).toMatch(/^#[0-9a-f]{6}$/);
    expect(a.contrast).toBeGreaterThan(6);
  });
  it("repère une image presque unie et garde le centre", async () => {
    const flat = await sharp({ create: { width: 512, height: 512, channels: 3, background: "#ffffff" } }).png().toBuffer();
    const a = await analyzeImage(flat);
    expect(a.contrast).toBeLessThan(1);
    expect(a.focalX).toBe(0.5);
    expect(a.focalY).toBe(0.5);
  });
});

function layoutWith(blocks: PageLayout["blocks"]): PageLayout {
  return { widthMm: 210, heightMm: 297, blocks } as PageLayout;
}
const img = (o: Partial<PageLayout["blocks"][number]> & { id: string; w: number; h: number }) =>
  ({ type: "image", role: "decoration", alt: "", caption: "", isDemo: false, fit: "cover", x: 10, y: 10, editable: true, style: {}, src: "/api/assets/a", ...o }) as PageLayout["blocks"][number];

describe("application du cadrage aux pages", () => {
  it("copie point focal, zoom, ajustement et couleur de fond", () => {
    const layout = layoutWith([img({ id: "b1", illustrationId: "i1", w: 180, h: 55 }), img({ id: "b2", illustrationId: "i2", w: 100, h: 150 })]);
    const ills = new Map([
      ["i1", { id: "i1", focalX: 0.5, focalY: 0.5, zoom: 1, fit: null, asset: { width: 1536, height: 1024, dominantColor: "#aabbcc" } }],
      ["i2", { id: "i2", focalX: 0.2, focalY: 0.3, zoom: 1.4, fit: "cover", asset: { width: 1024, height: 1536, dominantColor: "#112233" } }],
    ]);
    const r = applyFramingToLayout(layout, ills);
    expect(r.changed).toBe(true);
    const [b1, b2] = r.layout.blocks as Array<{ fit: string; focalX?: number; zoom?: number; bg?: string }>;
    expect(b1.fit).toBe("contain"); // bandeau trop large : aucune coupe
    expect(b1.bg).toBe("#aabbcc");
    expect(b2.fit).toBe("cover");
    expect(b2.focalX).toBe(0.2);
    expect(b2.zoom).toBe(1.4);
    expect(applyFramingToLayout(r.layout, ills).changed).toBe(false);
  });
});

describe("contrôle qualité des images", () => {
  const info = (o: Partial<ImageInfo>): ImageInfo => ({ width: 1024, height: 1024, contrast: 40, isSketch: false, isDemo: false, fit: null, zoom: 1, ...o });
  it("signale basse résolution, blocage, écart de format, image unie, manquante et esquisse", () => {
    const pages = [{ id: "p1", layout: layoutWith([
      img({ id: "full", illustrationId: "a", w: 210, h: 297 }), // 1024 px en pleine page : ≈ 124 ppp
      img({ id: "huge", illustrationId: "b", w: 210, h: 297, src: "/api/assets/b" }), // 512 px : ≈ 62 ppp
      img({ id: "crop", illustrationId: "c", w: 180, h: 55 }),
      img({ id: "flat", illustrationId: "d", w: 60, h: 60 }),
      img({ id: "none", w: 60, h: 60, src: undefined }),
    ]) }];
    const ills = new Map<string, ImageInfo>([
      ["a", info({})],
      ["b", info({ width: 512, height: 512 })],
      ["c", info({ width: 1536, height: 1024, fit: "cover", isSketch: true })],
      ["d", info({ contrast: 1 })],
    ]);
    const issues = checkLayoutImages(pages, ills);
    const codes = (id: string) => issues.filter((i) => i.blockId === id).map((i) => i.code).sort();
    // Carré en pleine page A4 : ajusté sans coupe (écart > 25 %) et résolution limite
    expect(codes("full")).toEqual(["auto_contain", "dpi_low"]);
    expect(codes("huge")).toEqual(["auto_contain", "dpi_blocking"]);
    expect(codes("crop")).toEqual(["ratio_mismatch", "sketch"]);
    expect(codes("flat")).toEqual(["uniform"]);
    expect(codes("none")).toEqual(["missing"]);
    expect(issues.find((i) => i.code === "dpi_blocking")?.severity).toBe("blocking");
    expect(issues.find((i) => i.code === "ratio_mismatch")?.actions).toContain("recadrer");
  });
  it("ajuste automatiquement (info) quand le format diffère sans cadrage manuel", () => {
    const pages = [{ layout: layoutWith([img({ id: "x", illustrationId: "c", w: 180, h: 55 })]) }];
    const issues = checkLayoutImages(pages, new Map([["c", info({ width: 1536, height: 1024 })]]));
    expect(issues.map((i) => i.code)).toEqual(["auto_contain"]);
    expect(issues[0].severity).toBe("info");
  });
});

describe("règle « pas de regénération implicite »", () => {
  it("ne regénère jamais une image acceptée, générée ou collée", () => {
    expect(needsGeneration({ status: "ACCEPTED", isDemo: false }, { realProvider: true })).toBe(false);
    expect(needsGeneration({ status: "GENERATED", isDemo: false, provider: "openai" }, { realProvider: true })).toBe(false);
    expect(needsGeneration({ status: "GENERATED", isDemo: false, provider: "manual" }, { realProvider: true })).toBe(false);
    expect(needsGeneration({ status: "GENERATING", isDemo: false }, { realProvider: true })).toBe(false);
  });
  it("génère ce qui manque, a échoué ou a été refusé", () => {
    expect(needsGeneration(null, { realProvider: true })).toBe(true);
    expect(needsGeneration({ status: "FAILED", isDemo: false }, { realProvider: true })).toBe(true);
    expect(needsGeneration({ status: "REJECTED", isDemo: false }, { realProvider: true })).toBe(true);
  });
  it("remplace une image de démonstration seulement avec un vrai fournisseur", () => {
    expect(needsGeneration({ status: "GENERATED", isDemo: true, provider: "mock" }, { realProvider: false })).toBe(false);
    expect(needsGeneration({ status: "GENERATED", isDemo: true, provider: "mock" }, { realProvider: true })).toBe(true);
  });
});

describe("esquisse → version finale", () => {
  const settings = { imageQuality: "high" as const, sketchQuality: "low" as const };
  it("réutilise le prompt d'origine (consignes de format comprises) et vise la qualité finale", () => {
    const ill = { prompt: "Carte au trésor\n\nFormat portrait (2:3)", slot: "carte", kind: "KIT", targetRatio: "portrait", isSketch: true };
    const p = reworkPrompt(ill, "final");
    expect(p.startsWith(ill.prompt)).toBe(true);
    expect(p).toMatch(/reprendre exactement la composition/);
    expect(reworkQuality(ill, "final", settings)).toEqual({ quality: "high", sketch: false });
    expect(sizeForRatio(reworkRatio(ill))).toBe("1024x1536");
  });
  it("ajoute la correction libre au prompt ; une correction d'esquisse reste une esquisse", () => {
    const ill = { prompt: "Lettre", slot: "lettre", kind: "KIT", targetRatio: null, isSketch: true };
    expect(reworkPrompt(ill, "correction", "le perroquet est vert")).toMatch(/Correction demandée.*le perroquet est vert/);
    expect(reworkQuality(ill, "correction", settings)).toEqual({ quality: "low", sketch: true });
    expect(reworkRatio(ill)).toBe("landscape");
    expect(reworkQuality({ isSketch: false }, "fresh", settings)).toEqual({ quality: "high", sketch: false });
  });
  it("mode esquisse : jamais en copier-coller, demande explicite prioritaire", () => {
    expect(useSketch({ sketchMode: true }, "openai")).toBe(true);
    expect(useSketch({ sketchMode: false }, "openai")).toBe(false);
    expect(useSketch({ sketchMode: true }, "manual", true)).toBe(false);
    expect(useSketch({ sketchMode: false }, "mock", true)).toBe(true);
    expect(useSketch({ sketchMode: true }, "mock")).toBe(false);
  });
  it("estimation du pilote : esquisse + finale, réglage par défaut activé", () => {
    const cfg = AutopilotSettingsSchema.parse({});
    expect(cfg.sketchFirst).toBe(true);
    expect(cfg.sketchApproval).toBe(true);
    const ai = { mode: "api", manualFor: "all", textProvider: "anthropic", textModel: "claude-sonnet-4-5", imageProvider: "openai", imageModel: "gpt-image-1", imageQuality: "high", sketchQuality: "low" } as const;
    const withSketch = estimateRun({ format: "treasure_hunt", count: 10, contentProvided: true, ai, autopilot: cfg, runwayUsdPerSecond: 0 });
    const direct = estimateRun({ format: "treasure_hunt", count: 10, contentProvided: true, ai, autopilot: { ...cfg, sketchFirst: false }, runwayUsdPerSecond: 0 });
    expect(withSketch.stages.illustrations!).toBeGreaterThan(direct.stages.illustrations!);
    expect(withSketch.notes.join(" ")).toMatch(/Mode esquisse/);
  });
  it("une étape qui redemande une validation attend un nouvel accord", () => {
    const cfg = AutopilotSettingsSchema.parse({});
    let stages = initStages(cfg).map((s) => (["plan", "content", "quality", "character"].includes(s.key) ? { ...s, status: "done" as const } : s));
    stages = approveCurrent(stages); // ex. accord du plafond de coût avant l'étape
    stages = markStarted(stages, "illustrations", 1);
    const t = applyOutcome({ status: "RUNNING", stages }, "illustrations", { type: "approval", reason: "Esquisses prêtes" }, 1.2);
    const ill = t.stages.find((s) => s.key === "illustrations")!;
    expect(t.status).toBe("WAITING_APPROVAL");
    expect(ill.approved).toBe(false);
    expect(approveCurrent(t.stages).find((s) => s.key === "illustrations")!.approved).toBe(true);
  });
});

describe("lien d'aperçu signé", () => {
  it("est valable 7 jours et lié au livre", async () => {
    const now = Date.UTC(2026, 10, 8);
    const { token, expiresAt } = await createPreviewToken("book_123", { now });
    expect(expiresAt.getTime() - now).toBe(7 * 86400 * 1000);
    expect((await verifyPreviewToken(token, { now }))?.bookId).toBe("book_123");
    expect(await verifyPreviewToken(token, { now: now + 8 * 86400 * 1000 })).toBeNull();
    const [, exp, sig] = token.split(".");
    expect(await verifyPreviewToken(`book_456.${exp}.${sig}`, { now })).toBeNull();
    expect(await verifyPreviewToken("n'importe.quoi", { now })).toBeNull();
  });
});
