import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { findCuts, orderUploads, processCell, splitSheet, vectorizeLineArt } from "@/lib/coloring/split";
import { makeTestSheet } from "@/lib/coloring/test-sheets";
import { buildSheetMasterPrompt, sheetCount } from "@/lib/coloring/sheet-prompt";
import { assignSlots, swapCells } from "@/lib/coloring/sheet-batch";
import { coloringComplexity, DEFAULT_COLORING_CHARTER } from "@/lib/kits/coloring";

describe("découpage des planches", () => {
  it("2×2 avec gouttières : coupes détectées au milieu", async () => {
    const sheet = await makeTestSheet({ side: 2, gutter: 80 });
    const r = await splitSheet(sheet, 4);
    expect(r.fallback).toBe(false);
    expect(r.cells).toHaveLength(4);
    expect(Math.abs(r.cutsX[0] - 512)).toBeLessThan(20);
    expect(Math.abs(r.cutsY[0] - 768)).toBeLessThan(20);
  });
  it("3×3 avec gouttières : 9 cases", async () => {
    const r = await splitSheet(await makeTestSheet({ side: 3, gutter: 50 }), 9);
    expect(r.fallback).toBe(false);
    expect(r.cells).toHaveLength(9);
    expect(r.cutsX).toHaveLength(2);
  });
  it("sans gouttières : repli sur une découpe régulière", async () => {
    const r = await splitSheet(await makeTestSheet({ side: 2, gutter: 0 }), 4);
    expect(r.fallback).toBe(true);
    expect(r.cells).toHaveLength(4);
    expect(r.cutsX[0]).toBe(512);
  });
  it("findCuts : null si aucune bande blanche près de la coupe attendue", () => {
    expect(findCuts(new Array(100).fill(0.5), 2)).toBeNull();
    const p = new Array(100).fill(0.5);
    for (let i = 47; i < 54; i++) p[i] = 0;
    expect(findCuts(p, 2)).toEqual([50]);
  });
});

describe("traitement d'un dessin", () => {
  it("rognage, noir et blanc et vectorisation (SVG non vide, dimensions)", async () => {
    const [cell] = (await splitSheet(await makeTestSheet({ side: 2 }), 4)).cells;
    const r = await processCell(cell);
    expect(r.svg).toMatch(/<svg/);
    expect(r.svg).toMatch(/<path/);
    expect(r.width).toBeGreaterThan(100);
    expect(r.height).toBeGreaterThan(100);
    const meta = await sharp(r.png).metadata();
    expect(meta.width).toBeLessThan(512); // rogné sur le contenu
  }, 30_000);
  it("une image vide ne se vectorise pas", async () => {
    const blank = await sharp({ create: { width: 200, height: 300, channels: 3, background: "#ffffff" } }).png().toBuffer();
    expect(await vectorizeLineArt(blank)).toBeNull();
  });
});

describe("ordre et réaffectation", () => {
  it("ordre des fichiers : nom (horodatage ChatGPT) puis date de modification", () => {
    const files = [
      { name: "ChatGPT Image 11 nov. 2026, 10_12_03.png", lastModified: 3 },
      { name: "ChatGPT Image 11 nov. 2026, 09_58_41.png", lastModified: 9 },
      { name: "planche-10.png", lastModified: 1 },
      { name: "planche-2.png", lastModified: 2 },
    ];
    expect(orderUploads(files).map((f) => f.name)).toEqual(["ChatGPT Image 11 nov. 2026, 09_58_41.png", "ChatGPT Image 11 nov. 2026, 10_12_03.png", "planche-2.png", "planche-10.png"]);
  });
  it("permuter deux dessins garde les emplacements dans l'ordre du sommaire", () => {
    const drawings = [1, 2, 3, 4].map((n) => ({ slot: `dessin-${n}`, numero: n, titre: `D${n}`, description: "" }));
    const cells = assignSlots([0, 1, 2, 3].map((i) => ({ sheet: 0, cell: i, pngAssetId: `png${i}`, svgAssetId: `svg${i}` })), drawings);
    const swapped = swapCells(cells, 0, 2);
    expect(swapped.map((c) => c.slot)).toEqual(["dessin-1", "dessin-2", "dessin-3", "dessin-4"]);
    expect(swapped[0].svgAssetId).toBe("svg2");
    expect(swapped[2].svgAssetId).toBe("svg0");
  });
});

describe("prompt maître", () => {
  it("120 dessins en 2×2 = 30 planches, consigne « continue », aucune case numérotée dans l'image", () => {
    const drawings = Array.from({ length: 120 }, (_, i) => ({ numero: i + 1, titre: `Dino ${i + 1}`, description: "un dinosaure souriant" }));
    const p = buildSheetMasterPrompt({ title: "Dinos", ageRange: "3-5", charter: DEFAULT_COLORING_CHARTER, complexity: coloringComplexity("3-5"), grid: 4, drawings });
    expect(sheetCount(120, 4)).toBe(30);
    expect(sheetCount(120, 9)).toBe(14);
    expect(p).toMatch(/Planche 30 :/);
    expect(p).not.toMatch(/Planche 31/);
    expect(p).toMatch(/continue/);
    expect(p).toMatch(/gouttières BLANCHES/);
    expect(p).toMatch(/Aucun texte, aucun numéro/);
  });
});
