import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, describe, expect, it } from "vitest";
import { PageRenderer } from "@/components/page-renderer";
import { composeBook, proseText, sliceItem } from "@/lib/editorial/compose";
import { COVER_DIRECTIONS } from "@/lib/editorial/covers";
import { fontFaceCss, UNWRITTEN_FONT_FACES } from "@/lib/editorial/fonts";
import { EDITORIAL_GRIDS, textHeight, textWidth } from "@/lib/editorial/grid";
import type { ManuscriptInput } from "@/lib/editorial/manuscript";
import type { MeasureFlow, MeasuredLines, Measurer } from "@/lib/editorial/measure";
import { paginateFlow, type FlowUnit } from "@/lib/editorial/paginate";
import { contrastRatio, PALETTE, DERIVED } from "@/lib/editorial/palette";
import { analyzeQa, type QaPage, type QaSnapshot } from "@/lib/editorial/qa";
import { runsText, typeset } from "@/lib/editorial/typography";
import { PAGE_FORMATS } from "@/lib/schemas/activity";
import { PageLayoutSchema, type ProseItem } from "@/lib/schemas/layout";
import { BUILTIN_TEMPLATES } from "@/lib/layout/themes";
import { UNWRITTEN_DEMOS } from "@/lib/demo/unwritten";
import { buildMalleReferencePages } from "./helpers/malle-reference";
import { renderMalleReference } from "./helpers/malle-render";
import pagesGolden from "./fixtures/malle-pages.golden.json";
import renderGolden from "./fixtures/malle-render.golden.json";

// ---------------------------------------------------------------------------
// Mesureur factice (sans navigateur) : coupe les paragraphes tous les ~N caractères
// ---------------------------------------------------------------------------
function fakeMeasurer(charsPerMm = 0.55): Measurer {
  return {
    async measure(flows: MeasureFlow[]) {
      return flows.map((f) =>
        f.items.map((it: ProseItem): MeasuredLines => {
          const text = runsText(it.runs);
          const per = Math.max(8, Math.floor(f.block.w * charsPerMm * (10 / f.block.fontSizePt)));
          const starts: number[] = [];
          let pos = 0;
          while (pos < text.length) {
            starts.push(pos);
            let end = Math.min(text.length, pos + per);
            if (end < text.length) {
              const sp = text.lastIndexOf(" ", end);
              end = sp > pos ? sp + 1 : end;
            }
            pos = end;
          }
          return { starts, hyphen: starts.map(() => false), heightMm: starts.length * f.block.leadingMm };
        }),
      );
    },
    async close() {},
  };
}

const unit = (lines: number, kind: FlowUnit["kind"] = "p", spaceBefore?: number): FlowUnit<string> => ({ kind, lines, spaceBefore });

describe("pagination éditoriale (veuves, orphelines, flottants)", () => {
  it("ne laisse jamais une ligne seule en bas (orpheline) ni en haut de page (veuve)", () => {
    for (let cap = 6; cap <= 14; cap++) {
      const units = [unit(cap - 1), unit(3), unit(7), unit(cap * 2 + 1), unit(2), unit(5)];
      const pages = paginateFlow(units, { capacity: () => cap });
      for (const p of pages) {
        expect(p.used).toBeLessThanOrEqual(p.capacity);
        for (const f of p.fragments) {
          const total = units[f.unit].lines;
          if (f.to - f.from === total) continue;
          if (f.from === 0) expect(f.to - f.from).toBeGreaterThanOrEqual(2); // orpheline
          if (f.to === total) expect(f.to - f.from).toBeGreaterThanOrEqual(2); // veuve
        }
      }
      // Toutes les lignes sont placées, dans l'ordre, une seule fois
      const placed = pages.flatMap((p) => p.fragments).reduce((s, f) => s + f.to - f.from, 0);
      expect(placed).toBe(units.reduce((s, u) => s + u.lines, 0));
    }
  });
  it("reporte un paragraphe de 3 lignes plutôt que de le couper en 2 + 1", () => {
    const pages = paginateFlow([unit(8), unit(3)], { capacity: () => 10 });
    expect(pages).toHaveLength(2);
    expect(pages[1].fragments[0]).toMatchObject({ unit: 1, from: 0, to: 3 });
    expect(pages[0].used).toBe(8);
  });
  it("garde un intertitre avec au moins deux lignes de texte et supprime l'espace avant en haut de page", () => {
    const pages = paginateFlow([unit(8), unit(1, "subhead", 1), unit(5)], { capacity: () => 10 });
    expect(pages[0].fragments.map((f) => f.unit)).toEqual([0]);
    expect(pages[1].fragments[0]).toMatchObject({ unit: 1, spaceBefore: 0 });
  });
  it("place une figure en tête de la page suivante et réduit sa capacité", () => {
    const units: FlowUnit<string>[] = [unit(4), { kind: "float", lines: 0, float: "fig" }, unit(30)];
    const pages = paginateFlow(units, { capacity: (_i, fig) => 20 - (fig ? 8 : 0), isFigure: (f) => f === "fig" });
    expect(pages[1].figure).toBe("fig");
    expect(pages[1].capacity).toBe(12);
  });
  it("n'insère une page pleine (activité) qu'entre deux paragraphes, une illustration n'importe où", () => {
    const units: FlowUnit<string>[] = [unit(2), { kind: "float", lines: 0, float: "act" }, unit(25), unit(4)];
    const pages = paginateFlow(units, { capacity: () => 10, canSplitParagraph: (f) => f === "ill" });
    const where = pages.findIndex((p) => p.floatsAfter.includes("act"));
    // La page qui précède l'activité se termine sur une fin de paragraphe
    const lastFrag = pages[where].fragments.at(-1)!;
    expect(lastFrag.to).toBe(units[lastFrag.unit].lines);
  });
});

const SMALL: ManuscriptInput = {
  collection: "secret-book",
  lang: "en",
  title: "A Small Secret",
  recipient: "Maya",
  dedication: { text: "For Maya." },
  chapters: [
    { title: "One", blocks: Array.from({ length: 14 }, (_, k) => `Paragraph ${k} about Maya and the house on Ashcombe Lane, where every step has a story and every story has a step that creaks in the night when nobody listens.`) },
    { title: "Two", blocks: ["Short chapter.", { type: "activity", title: "Your turn", prompt: "Write.", kind: "lines" }, { type: "memory", title: "Keep", prompt: "Stick a photo.", kind: "both", fields: ["Date"] }] },
    { title: "Three", blocks: ["A third chapter, with a quote page.", { type: "citation", text: "Quiet.", source: "Someone" }, { type: "illustration", mode: "figure", caption: "A figure" }, ...Array.from({ length: 24 }, (_, k) => `More text ${k} so that the figure lands on the next page and the flow continues below the illustration.`)] },
  ],
  conclusion: { title: "End", blocks: ["Goodbye."], signature: "Grandpa Tom" },
  backCover: { blurb: "Blurb." },
  cover: { direction: "secret-seal" },
  personalization: ["Maya", "Ashcombe Lane", "Grandpa Tom"],
};

describe("moteur éditorial : livre composé", () => {
  it("saute à la page impaire pour chaque chapitre en mode impression, sans page blanche en numérique", async () => {
    const print = await composeBook(SMALL, { format: "A5", mode: "print", measurer: fakeMeasurer() });
    const openings = print.pages.filter((p) => p.templateKey === "ed_chapter_opening" || p.templateKey === "ed_conclusion");
    expect(openings).toHaveLength(4);
    for (const p of openings) expect(p.layout.editorial!.folio! % 2).toBe(1);
    const interior = print.pages.filter((p) => p.layout.editorial?.folio !== undefined);
    expect(interior.length % 2).toBe(0);
    interior.forEach((p, k) => expect(p.layout.editorial!.folio).toBe(k + 1));
    const digital = await composeBook(SMALL, { format: "A5", mode: "digital", measurer: fakeMeasurer() });
    expect(digital.pages.some((p) => p.templateKey === "ed_blank")).toBe(false);
    expect(digital.pages.length).toBeLessThan(print.pages.length);
  });

  it("produit tous les gabarits, des mises en page valides, des blocs dans la page et dans les marges", async () => {
    for (const format of ["A5", "A4", "SQUARE", "PORTRAIT_3_4"] as const) {
      const g = EDITORIAL_GRIDS[format];
      const book = await composeBook(SMALL, { format, mode: "print", measurer: fakeMeasurer() });
      const keys = new Set(book.pages.map((p) => p.templateKey));
      for (const k of ["ed_cover", "ed_half_title", "ed_title", "ed_colophon", "ed_dedication", "ed_contents", "ed_chapter_opening", "ed_text", "ed_text_figure", "ed_quote", "ed_activity", "ed_memory", "ed_conclusion", "ed_back_cover", "ed_blank"]) expect(keys, `${format} ${k}`).toContain(k);
      expect(book.pageFormat in PAGE_FORMATS).toBe(true);
      for (const p of book.pages) {
        expect(PageLayoutSchema.safeParse(p.layout).success).toBe(true);
        const ed = p.layout.editorial!;
        for (const b of p.layout.blocks) {
          expect(b.x).toBeGreaterThanOrEqual(-0.01);
          expect(b.y).toBeGreaterThanOrEqual(-0.01);
          expect(b.x + b.w).toBeLessThanOrEqual(g.widthMm + 0.01);
          expect(b.y + b.h).toBeLessThanOrEqual(g.heightMm + 0.01);
          // Texte courant : exactement dans la colonne, sur la grille
          if (b.type === "prose" && ed.folio !== undefined && p.templateKey !== "ed_quote") {
            expect(b.x).toBeGreaterThanOrEqual(ed.safe!.left - 0.01);
            expect(b.x + b.w).toBeLessThanOrEqual(g.widthMm - ed.safe!.right + 0.01);
            // Les lignes composées (pas la marge de sécurité du cadre) tiennent dans la colonne
            const content = b.items.reduce((sum, it) => sum + ((it.lines ?? 0) + (it.spaceBefore ?? 0)) * b.leadingMm, 0);
            expect(b.y + content).toBeLessThanOrEqual(g.top + textHeight(g) + 0.01);
          }
        }
        // Le petit fond (marge intérieure) est côté reliure
        if (ed.side === "recto" && ed.safe) expect(ed.safe.left).toBe(g.inner);
        if (ed.side === "verso" && ed.safe) expect(ed.safe.right).toBe(g.inner);
      }
      // Le texte du manuscrit est intégralement présent, une seule fois
      const text = book.pages.map(proseText).join("\n");
      for (let k = 0; k < 14; k++) expect(text.split(`Paragraph ${k} `).length - 1).toBe(1);
    }
  });

  it("numérote le sommaire avec les folios définitifs", async () => {
    const book = await composeBook(SMALL, { format: "A5", mode: "print", measurer: fakeMeasurer() });
    const toc = book.pages.find((p) => p.templateKey === "ed_contents")!;
    const opening = book.pages.find((p) => p.templateKey === "ed_chapter_opening")!;
    const texts = toc.layout.blocks.filter((b) => b.type === "text").map((b) => (b as { text: string }).text);
    expect(texts).toContain(String(opening.layout.editorial!.folio));
  });

  it("propose trois directions de couverture distinctes par collection", () => {
    for (const c of ["secret-book", "before-too-late", "movie-of-my-life"]) expect(COVER_DIRECTIONS.filter((d) => d.collection === c)).toHaveLength(3);
  });

  it("recompose un fragment à la ligne près et ajoute le trait d'union d'une césure", () => {
    const base: ProseItem = { kind: "p", runs: [{ t: "Alpha beta gam" }, { t: "ma delta", i: true }], indent: true };
    // « Alpha beta gamma delta » : lignes « Alpha », « beta », « gam‐ » (césure), « ma delta »
    const ml: MeasuredLines = { starts: [0, 6, 11, 14], hyphen: [false, false, true, false], heightMm: 0 };
    const a = sliceItem(base, ml, 0, 2);
    expect(runsText(a.runs)).toBe("Alpha beta");
    expect(a.continues).toBe(true);
    const b = sliceItem(base, ml, 0, 3);
    expect(b.lines).toBe(3);
    expect(runsText(b.runs)).toBe("Alpha beta gam\u2010");
    const d = sliceItem(base, ml, 3, 4);
    expect(d.continued).toBe(true);
    expect(d.indent).toBeUndefined();
    expect(d.runs).toEqual([{ t: "ma delta", i: true }]);
  });

  it("compose les trois manuscrits de démonstration", async () => {
    for (const demo of UNWRITTEN_DEMOS) {
      const book = await composeBook(demo.manuscript, { format: demo.format, mode: "print", measurer: fakeMeasurer() });
      expect(book.pages.length).toBeGreaterThan(15);
      expect(book.expectations.length).toBeGreaterThan(2);
    }
  });
});

describe("typographie et design system", () => {
  it("applique la typographie française et anglaise", () => {
    expect(typeset('Il dit : "oui" ! Pourquoi ?', "fr")).toBe("Il dit : « oui » ! Pourquoi ?");
    expect(typeset(`It's "fine"... really`, "en")).toBe("It’s “fine”… really");
  });
  it("vérifie les contrastes annoncés dans le design system", () => {
    expect(contrastRatio(PALETTE.ink, PALETTE.ivory)).toBeCloseTo(16.33, 1);
    expect(contrastRatio(DERIVED.graphite, PALETTE.ivory)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(DERIVED.bronze, PALETTE.ivory)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(PALETTE.champagne, PALETTE.ink)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(PALETTE.stone, PALETTE.ivory)).toBeLessThan(3); // pierre : filets uniquement
  });
  it("embarque les polices OFL déclarées et les déclare à l'identique dans globals.css", () => {
    const root = path.resolve(__dirname, "..");
    const css = readFileSync(path.join(root, "src/app/globals.css"), "utf8");
    for (const rule of fontFaceCss().split("\n")) expect(css).toContain(rule);
    for (const f of UNWRITTEN_FONT_FACES) expect(existsSync(path.join(root, "public/fonts/unwritten", f.file))).toBe(true);
    for (const l of ["OFL-Fraunces.txt", "OFL-Newsreader.txt", "OFL-Inter.txt"]) expect(readFileSync(path.join(root, "public/fonts/unwritten", l), "utf8")).toContain("SIL Open Font License");
  });
  it("garde des colonnes de 60 à 80 signes environ dans chaque format", () => {
    for (const g of Object.values(EDITORIAL_GRIDS)) {
      const chars = textWidth(g) / (g.bodyPt * 0.3528 * 0.46);
      expect(chars).toBeGreaterThan(58);
      expect(chars).toBeLessThan(82);
    }
  });
});

// ---------------------------------------------------------------------------
// Contrôle qualité
// ---------------------------------------------------------------------------

function qaPage(over: Partial<QaPage>): QaPage {
  return { index: 1, template: "text", folio: 1, side: "recto", blank: false, sparse: false, chapterEnd: true, safe: [18, 16, 24, 19], widthMm: 148, heightMm: 210, background: "rgb(247, 244, 238)", blocks: [], ...over };
}
const textBlock = (o: Partial<QaPage["blocks"][number]> = {}) => ({ id: "t", type: "text", rect: { x: 20, y: 20, w: 100, h: 10 }, ink: { x: 20, y: 20, w: 90, h: 8 }, text: "Bonjour Maya", color: "rgb(23, 23, 23)", opacity: 1, fontSizePt: 10, fontWeight: 400, fontFamily: "Newsreader", fontLoaded: true, overflowPx: 0, ...o });

describe("contrôle qualité éditorial", () => {
  it("détecte une page vide non prévue, mais pas une page blanche volontaire", () => {
    const snap: QaSnapshot = { fontErrors: [], pages: [qaPage({ index: 1, folio: 1 }), qaPage({ index: 2, folio: 2, side: "verso", blank: true }), qaPage({ index: 3, folio: 3, blocks: [textBlock()] })] };
    const r = analyzeQa(snap);
    const empty = r.defects.filter((d) => d.code === "EMPTY_PAGE");
    expect(empty).toHaveLength(1);
    expect(empty[0]).toMatchObject({ severity: "critical", pageIndex: 1 });
    expect(r.ok).toBe(false);
  });
  it("détecte un contraste insuffisant (pierre sur ivoire) et accepte l'encre sur ivoire", () => {
    const bad = analyzeQa({ fontErrors: [], pages: [qaPage({ blocks: [textBlock({ color: PALETTE.stone })] })] });
    expect(bad.defects.find((d) => d.code === "CONTRAST")?.severity).toBe("critical");
    const good = analyzeQa({ fontErrors: [], pages: [qaPage({ blocks: [textBlock()] })] });
    expect(good.defects.filter((d) => d.code === "CONTRAST")).toHaveLength(0);
    // Texte ivoire sur un aplat d'encre posé dessous : fond effectif = l'aplat
    const onShape = analyzeQa({ fontErrors: [], pages: [qaPage({ blocks: [{ id: "s", type: "shape", rect: { x: 0, y: 0, w: 148, h: 210 }, text: "", fill: "rgb(23, 23, 23)", opacity: 1, overflowPx: 0 }, textBlock({ color: PALETTE.ivory })] })] });
    expect(onShape.defects.filter((d) => d.code === "CONTRAST")).toHaveLength(0);
  });
  it("détecte veuves, orphelines, débordements, pagination discontinue et personnalisation absente", () => {
    const prose = textBlock({ type: "prose", prose: [{ kind: "p", expected: 1, actual: 1, continued: true, continues: false }, { kind: "p", expected: 1, actual: 1, continued: false, continues: true }], overflowPx: 12 });
    const r = analyzeQa({ fontErrors: [], pages: [qaPage({ folio: 1, blocks: [prose] }), qaPage({ index: 2, folio: 3, blocks: [textBlock()] })] }, { expect: ["Maya", "Ashcombe Lane"] });
    const codes = r.defects.map((d) => d.code);
    for (const c of ["WIDOW", "ORPHAN", "OVERFLOW", "FOLIO_SEQUENCE", "PERSONALIZATION_MISSING"]) expect(codes).toContain(c);
    expect(r.personalization.find((p) => p.text === "Maya")!.pages.length).toBeGreaterThan(0);
  });
  it("signale un grand vide involontaire sur une page de texte courant", () => {
    const r = analyzeQa({ fontErrors: [], pages: [qaPage({ chapterEnd: false, blocks: [textBlock({ ink: { x: 20, y: 20, w: 90, h: 30 } })] })] });
    expect(r.defects.map((d) => d.code)).toEqual(expect.arrayContaining(["NEAR_EMPTY", "LARGE_GAP"]));
  });
});

// ---------------------------------------------------------------------------
// Intégration Chromium : mesure réelle, rendu PageRenderer, contrôle qualité
// ---------------------------------------------------------------------------

const chromium = ["/opt/pw-browsers/chromium", process.env.CHROMIUM_PATH].filter(Boolean).some((p) => existsSync(p!));

describe.skipIf(!chromium)("intégration Chromium (mesure réelle + rendu + contrôle qualité)", () => {
  afterAll(async () => {
    const { closeBrowser } = await import("@/lib/pdf/browser");
    await closeBrowser();
  });
  it("compose, rend avec PageRenderer et passe le contrôle qualité sans défaut critique ; détecte page vide et contraste", async () => {
    const { createChromiumMeasurer, openStandalonePage, standaloneHtml } = await import("@/lib/editorial/measure");
    const { getBrowser } = await import("@/lib/pdf/browser");
    const { runEditorialQa } = await import("@/lib/editorial/qa");
    const measurer = await createChromiumMeasurer();
    const book = await composeBook(SMALL, { format: "A5", mode: "print", measurer });
    await measurer.close();
    const html = book.pages.map((p, i) => renderToStaticMarkup(createElement(PageRenderer, { layout: p.layout, theme: book.theme, mode: "print", pageIndex: i }))).join("");
    const css = ".book-page{position:relative;overflow:hidden;box-sizing:border-box}.book-page [data-block-id]{position:absolute;box-sizing:border-box}.book-page p{margin:0}";
    const page = await openStandalonePage(await getBrowser(), standaloneHtml(html, { extraCss: css }));
    await page.waitForFunction(() => document.fonts.status === "loaded");
    const r = await runEditorialQa(page, { expect: book.expectations, mode: "print" });
    await page.context().close();
    expect(r.defects.filter((d) => d.severity === "critical")).toEqual([]);
    expect(r.personalization.every((p) => p.pages.length > 0)).toBe(true);

    // Page vide et texte en pierre sur ivoire : défauts critiques détectés sur le rendu réel
    const broken = [
      { ...book.pages[3].layout, blocks: [] },
      { ...book.pages[3].layout, blocks: [{ id: "x", type: "text" as const, role: "body" as const, text: "Illisible", x: 20, y: 40, w: 100, h: 10, editable: false, style: { color: PALETTE.stone, fontSizePt: 10, fontFamily: "Newsreader" } }] },
    ];
    const html2 = broken.map((l, i) => renderToStaticMarkup(createElement(PageRenderer, { layout: PageLayoutSchema.parse(l), theme: book.theme, mode: "print", pageIndex: i }))).join("");
    const page2 = await openStandalonePage(await getBrowser(), standaloneHtml(html2, { extraCss: css }));
    const r2 = await runEditorialQa(page2, {});
    await page2.context().close();
    expect(r2.defects.map((d) => d.code)).toEqual(expect.arrayContaining(["EMPTY_PAGE", "CONTRAST"]));
  }, 60_000);
});

// ---------------------------------------------------------------------------
// Non-régression La Malle à Jeux
// ---------------------------------------------------------------------------

describe("non-régression La Malle à Jeux", () => {
  it("construit exactement les mêmes pages de kits et de livres d'activités qu'avant le moteur éditorial", () => {
    expect(JSON.parse(JSON.stringify(buildMalleReferencePages()))).toEqual(pagesGolden);
  });
  it("produit exactement le même HTML de pages avec PageRenderer qu'avant ses extensions", () => {
    expect(renderMalleReference()).toEqual(renderGolden);
  });
  it("conserve les formats et les modèles graphiques existants", () => {
    expect(PAGE_FORMATS.A4_PORTRAIT).toMatchObject({ widthMm: 210, heightMm: 297 });
    expect(PAGE_FORMATS.A4_LANDSCAPE).toMatchObject({ widthMm: 297, heightMm: 210 });
    expect(PAGE_FORMATS.SQUARE).toMatchObject({ widthMm: 210, heightMm: 210 });
    expect(PAGE_FORMATS.A5_PORTRAIT).toMatchObject({ widthMm: 148, heightMm: 210 });
    expect(PAGE_FORMATS.PORTRAIT_3_4).toMatchObject({ widthMm: 180, heightMm: 240 });
    expect(BUILTIN_TEMPLATES.map((t) => t.key)).toEqual(["atelier", "foret", "bonbon", "malle", "ardoise", "expert", "recettes", "labo"]);
  });
});
