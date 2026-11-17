/**
 * Moteur éditorial UNWRITTEN : d'un manuscrit structuré à des pages `BuiltPage`
 * compatibles avec PageRenderer, l'aperçu, l'éditeur et l'export PDF existants.
 *
 * Déroulé :
 *  1. première passe : chaque gabarit déclare les textes qu'il doit mesurer (TextBank) ;
 *  2. mesure de tous les textes en une fois dans Chromium (mêmes polices, même composant) ;
 *  3. seconde passe : pagination des chapitres (veuves, orphelines, flottants), séquence des
 *     pages (saut de chapitre sur page impaire en mode impression), folios et titres courants,
 *     sommaire avec les numéros définitifs, construction des blocs.
 *
 * Les gabarits de La Malle à Jeux (src/lib/layout/engine.ts, src/lib/kits/*) ne sont pas utilisés
 * ni modifiés.
 */
import type { Block, BookTheme, ProseItem, ProseRun } from "../schemas/layout";
import type { BuiltPage } from "../layout/engine";
import { Ids, TextBank, lineText, proseBlock, rect, rule, type MeasuredText, type TextSpec } from "./blocks";
import { COLLECTION_NAMES, coverDirection, illustrationArt, onArtColor, type CoverCtx } from "./covers";
import { FONT_DISPLAY, FONT_TEXT } from "./fonts";
import { bottomMargin, gridFor, PT_TO_MM, safeArea, textHeight, textLeft, textWidth, typeScale, type EditorialFormatKey, type EditorialGrid, type TypeScale } from "./grid";
import { LABELS, type Labels } from "./labels";
import { ManuscriptSchema, type ChapterBlock, type Manuscript, type ManuscriptInput } from "./manuscript";
import type { Measurer, MeasuredLines } from "./measure";
import { paginateFlow, type FlowPage, type FlowUnit } from "./paginate";
import { DERIVED, PALETTE } from "./palette";
import { unwrittenTheme } from "./theme";
import { leadInRuns, parseInline, runsText, sliceRuns, typeset, type EditorialLang } from "./typography";

export type ComposeMode = "print" | "digital";

export interface ComposeOptions {
  format: EditorialFormatKey;
  /** « print » : chapitres sur page impaire, pages blanches, nombre pair de pages ; « digital » : sans pages blanches */
  mode: ComposeMode;
  measurer: Measurer;
  /** Date de composition (colophon, couverture « lettre ») */
  date?: Date;
}

export interface ComposeStats {
  interiorPages: number;
  blankPages: number;
  chapters: { title: string; folio: number; pages: number }[];
  paragraphs: number;
  lines: number;
  hyphenatedLines: number;
  /** Plus longue suite de lignes consécutives terminées par une césure */
  maxConsecutiveHyphens: number;
  /** Pages de texte courtes (veuves/orphelines évitées), en lignes manquantes */
  shortPages: { folio: number; missing: number }[];
}

export interface ComposedBook {
  title: string;
  lang: EditorialLang;
  pages: BuiltPage[];
  theme: BookTheme;
  grid: EditorialGrid;
  /** Clé de PAGE_FORMATS à enregistrer sur le livre */
  pageFormat: string;
  /** Chaînes de personnalisation à retrouver dans le rendu (contrôle qualité) */
  expectations: string[];
  stats: ComposeStats;
}

// ---------------------------------------------------------------------------
// Éléments flottants et descripteurs de pages
// ---------------------------------------------------------------------------

type FloatEl = Extract<ChapterBlock, { type: "citation" | "illustration" | "activity" | "memory" }> & { key: string };

type PageDesc =
  | { t: "cover" | "back_cover" | "half_title" | "title" | "colophon" | "dedication" | "epigraph" | "blank" }
  | { t: "contents"; index: number; entries: number[] }
  | { t: "flow"; chapter: number; page: number }
  | { t: "float"; chapter: number; el: FloatEl };

interface ChapterPlan {
  index: number;
  conclusion: boolean;
  title: string;
  label: string;
  units: FlowUnit<FloatEl>[];
  /** Élément de prose de base de chaque unité de texte (même index que units) */
  items: (ProseItem | null)[];
  measured: (MeasuredLines | null)[];
  pages: FlowPage<FloatEl>[];
  sink: number;
  opening: Block[];
  figureLines: number;
}

// ---------------------------------------------------------------------------
// Entrée publique
// ---------------------------------------------------------------------------

/** Compose un livre complet : manuscrit + format + langue (celle du manuscrit) → pages. */
export async function composeBook(input: ManuscriptInput, opts: ComposeOptions): Promise<ComposedBook> {
  const m = ManuscriptSchema.parse(input);
  const collect = new TextBank();
  build(m, opts, collect);
  const keys = [...collect.requests.keys()];
  const measured = await opts.measurer.measure(keys.map((k) => collect.requests.get(k)!));
  const results = new Map(keys.map((k, i) => [k, measured[i]]));
  return build(m, opts, new TextBank(results));
}

// ---------------------------------------------------------------------------
// Construction (exécutée deux fois : collecte des mesures, puis composition)
// ---------------------------------------------------------------------------

function build(m: Manuscript, opts: ComposeOptions, T: TextBank): ComposedBook {
  const g = gridFor(opts.format);
  const sc = typeScale(g);
  const lang = m.lang;
  const labels = LABELS[lang];
  const L = g.leadingMm;
  const TW = textWidth(g);
  const ids = new Ids("uw");
  const date = labels.date(opts.date ?? new Date());
  const tx = (s: string) => typeset(s, lang);
  const mm = (pt: number) => pt * PT_TO_MM;

  const body: TextSpec = { font: FONT_TEXT, sizePt: g.bodyPt, leadingMm: L, align: "justify", color: PALETTE.ink, lang, hyphenate: true, indentEm: 1 };

  // --- 1. Chapitres : flux, mesure, ouverture, pagination -------------------------------
  const sources = [...m.chapters.map((c, i) => ({ c: { ...c, signature: undefined as string | undefined }, i, conclusion: false })), ...(m.conclusion ? [{ c: { title: m.conclusion.title, label: labels.epilogue, epigraph: undefined, blocks: m.conclusion.blocks, signature: m.conclusion.signature }, i: m.chapters.length, conclusion: true }] : [])];
  const figureLines = Math.round(g.lines * 0.44);

  const plans: ChapterPlan[] = sources.map(({ c, i, conclusion }) => {
    const { units, items } = flowUnits(c.blocks, lang, `c${i}`, c.signature);
    const textItems = items.filter((x): x is ProseItem => x !== null);
    const measuredText = T.flow(`flow.${i}`, body, TW, textItems);
    let k = 0;
    const measured = items.map((it) => (it ? measuredText[k++] : null));
    units.forEach((u, j) => {
      if (u.kind === "break") u.lines = 2;
      else if (u.kind !== "float") u.lines = Math.max(1, measured[j]?.starts.length ?? 1);
    });
    const label = c.label ?? (conclusion ? labels.epilogue : labels.chapter(i + 1));
    // Ouverture : intitulé, titre, filet, épigraphe ; la descente s'adapte à la hauteur réelle du titre
    const oids = new Ids(`uw_o${i}`);
    const ttl = T.text(`chap.${i}.title`, { font: FONT_DISPLAY, sizePt: sc.h2, leadingMm: round2(mm(sc.h2) * 1.1), align: "center", color: PALETTE.ink, lang, weightNum: 300, balance: true }, TW * 0.88, c.title);
    const ep = c.epigraph ? T.text(`chap.${i}.epigraph`, { font: FONT_TEXT, sizePt: sc.caption * 1.08, leadingMm: round2(L * 0.9), align: "center", color: DERIVED.graphite, lang, italic: true, balance: true }, TW * 0.72, c.epigraph.text) : null;
    // Hauteur de l'ensemble intitulé + titre + filet (+ épigraphe), puis placement : il se termine
    // 2,5 lignes au-dessus de la première ligne de texte (« descente » de chapitre)
    const headH = 1.6 * L + ttl.heightMm + 2.3 * L + (ep ? ep.heightMm + (c.epigraph?.source ? 1.4 * L : 0) : -1.2 * L);
    const sink = Math.max(g.chapterSink, Math.ceil(headH / L + 2.5 + 2));
    let y = Math.max(g.top + 2 * L, g.top + sink * L - 2.5 * L - headH);
    const opening: Block[] = [];
    opening.push(lineText({ id: oids.next("t"), x: 0, y, w: TW, h: L, text: tx(label), font: FONT_TEXT, sizePt: sc.micro, color: DERIVED.bronze, align: "center", uppercase: true, letterSpacingEm: 0.26, weightNum: 500 }));
    y += 1.6 * L;
    opening.push(proseBlock(oids.next("p"), TW * 0.06, y, ttl));
    y += ttl.heightMm + 1.1 * L;
    opening.push(rule({ id: oids.next("r"), x: TW / 2 - 4, y, w: 8, color: PALETTE.champagne, stroke: 0.35 }));
    y += 1.2 * L;
    if (ep && c.epigraph) {
      opening.push(proseBlock(oids.next("p"), TW * 0.14, y, ep));
      y += ep.heightMm;
      if (c.epigraph.source) opening.push(lineText({ id: oids.next("t"), x: 0, y: y + 0.4 * L, w: TW, h: L, text: tx(c.epigraph.source), font: FONT_TEXT, sizePt: sc.micro, color: DERIVED.graphite, align: "center", uppercase: true, letterSpacingEm: 0.18 }));
    }
    const pages = paginateFlow(units, {
      capacity: (p, fig) => (p === 0 ? g.lines - sink : g.lines) - (fig ? figureLines : 0),
      isFigure: (f) => f.type === "illustration" && f.mode === "figure",
      canSplitParagraph: (f) => f.type === "illustration",
    });
    return { index: i, conclusion, title: c.title, label, units, items, measured, pages, sink, opening, figureLines };
  });

  // --- 2. Séquence des pages -------------------------------------------------------------
  const seq: PageDesc[] = [{ t: "cover" }];
  const interior = () => seq.length - 1; // pages intérieures déjà placées
  const print = opts.mode === "print";
  const toRecto = () => {
    if (print && interior() % 2 === 1) seq.push({ t: "blank" });
  };
  seq.push({ t: "half_title" });
  if (print) seq.push({ t: "blank" });
  seq.push({ t: "title" }, { t: "colophon" });
  if (m.dedication) {
    toRecto();
    seq.push({ t: "dedication" });
  }
  // L'épigraphe occupe le verso qui suit la dédicace (plutôt qu'une page blanche)
  if (m.epigraph) seq.push({ t: "epigraph" });
  // Sommaire : une ligne de la grille par entrée, espacées d'une ligne
  const perPage = Math.max(4, Math.floor((g.lines - 7) / 2));
  toRecto();
  for (let k = 0; k * perPage < plans.length; k++) seq.push({ t: "contents", index: k, entries: plans.slice(k * perPage, (k + 1) * perPage).map((p) => p.index) });
  const chapterFolio = new Map<number, number>();
  for (const p of plans) {
    toRecto();
    chapterFolio.set(p.index, interior() + 1);
    p.pages.forEach((fp, k) => {
      seq.push({ t: "flow", chapter: p.index, page: k });
      for (const el of fp.floatsAfter) seq.push({ t: "float", chapter: p.index, el });
    });
  }
  if (print && interior() % 2 === 1) seq.push({ t: "blank" });
  seq.push({ t: "back_cover" });

  // --- 3. Pages -----------------------------------------------------------------------------
  const cctx: CoverCtx = { g, sc, m, T, ids, labels, date };
  const direction = coverDirection(m.cover.direction, m.collection);
  const pages: BuiltPage[] = [];
  const stats: ComposeStats = { interiorPages: seq.length - 2, blankPages: seq.filter((d) => d.t === "blank").length, chapters: [], paragraphs: 0, lines: 0, hyphenatedLines: 0, maxConsecutiveHyphens: 0, shortPages: [] };

  seq.forEach((d, index) => {
    const folio = d.t === "cover" || d.t === "back_cover" ? undefined : index;
    const side: "recto" | "verso" = folio !== undefined && folio % 2 === 0 ? "verso" : "recto";
    // En numérique, colonne centrée ; à l'impression, petit fond côté reliure
    const x0 = print ? textLeft(g, side) : (g.widthMm - TW) / 2;
    // Couvertures : zone de sécurité de façonnage (8 mm depuis la coupe), pas la colonne de texte
    const safe = folio === undefined ? { top: 8, right: 8, bottom: 8, left: 8 } : print ? safeArea(g, side) : { top: g.top, right: x0, bottom: bottomMargin(g), left: x0 };
    const page = (template: string, blocks: Block[], o: { background?: string; sparse?: boolean; blank?: boolean; chapterEnd?: boolean; chapter?: number; showFolio?: boolean; runningHead?: string } = {}): BuiltPage => {
      const all = [...blocks];
      if (o.runningHead && folio !== undefined) all.push(lineText({ id: ids.next("rh"), x: x0, y: g.top - 2.3 * L, w: TW, h: L, text: tx(o.runningHead), font: FONT_TEXT, sizePt: sc.micro, color: DERIVED.graphite, align: "center", uppercase: true, letterSpacingEm: 0.2, weightNum: 450 }));
      if (o.showFolio && folio !== undefined) all.push(lineText({ id: ids.next("f"), x: x0, y: g.top + textHeight(g) + (bottomMargin(g) - L) * 0.42, w: TW, h: L, text: String(folio), role: "pageNumber", font: FONT_TEXT, sizePt: sc.caption, color: DERIVED.graphite, align: "center", features: '"onum" 1, "pnum" 1' }));
      return {
        templateKey: `ed_${template}`,
        layout: {
          widthMm: g.widthMm,
          heightMm: g.heightMm,
          background: o.background ?? PALETTE.ivory,
          showPageNumber: false,
          blocks: all,
          editorial: { template, folio, side: folio !== undefined ? side : undefined, lang, intentionalBlank: o.blank || undefined, sparse: o.sparse || undefined, chapterEnd: o.chapterEnd || undefined, chapter: o.chapter, safe },
        },
      };
    };
    // Décale horizontalement des blocs construits pour une colonne commençant à 0
    const shift = (blocks: Block[]) => blocks.map((b) => ({ ...b, x: b.x + x0 }));

    switch (d.t) {
      case "cover": {
        const f = direction.front(cctx);
        pages.push(page("cover", f.blocks, { background: f.background, sparse: true }));
        return;
      }
      case "back_cover": {
        const b = direction.back(cctx);
        pages.push(page("back_cover", b.blocks, { background: b.background, sparse: true }));
        return;
      }
      case "blank":
        pages.push(page("blank", [], { blank: true, sparse: true }));
        return;
      case "half_title": {
        const t = T.text("half.title", { font: FONT_TEXT, sizePt: sc.caption * 1.05, leadingMm: L, align: "center", color: PALETTE.ink, lang, uppercase: true, letterSpacingEm: 0.3, weightNum: 500, balance: true }, TW * 0.8, m.title);
        const y = g.top + Math.round(textHeight(g) * 0.3 / L) * L;
        pages.push(page("half_title", shift([proseBlock(ids.next("p"), TW * 0.1, y, t), rule({ id: ids.next("r"), x: TW / 2 - 4, y: y + t.heightMm + L, w: 8, color: PALETTE.champagne, stroke: 0.35 })]), { sparse: true }));
        return;
      }
      case "title": {
        const b: Block[] = [];
        b.push(lineText({ id: ids.next("t"), x: 0, y: g.top + L, w: TW, h: L, text: tx(COLLECTION_NAMES[m.collection][lang]), font: FONT_TEXT, sizePt: sc.micro, color: DERIVED.graphite, align: "center", uppercase: true, letterSpacingEm: 0.3, weightNum: 500 }));
        const t = T.text("title.main", { font: FONT_DISPLAY, sizePt: sc.h1, leadingMm: round2(mm(sc.h1) * 1.06), align: "center", color: PALETTE.ink, lang, weightNum: 300, balance: true }, TW, m.title);
        let y = g.top + Math.round(textHeight(g) * 0.2 / L) * L;
        b.push(proseBlock(ids.next("p"), 0, y, t));
        y += t.heightMm + 0.8 * L;
        if (m.subtitle) {
          const s = T.text("title.sub", { font: FONT_DISPLAY, sizePt: sc.lead * 1.3, leadingMm: round2(mm(sc.lead * 1.3) * 1.25), align: "center", color: PALETTE.ink, lang, italic: true, balance: true }, TW * 0.86, m.subtitle);
          b.push(proseBlock(ids.next("p"), TW * 0.07, y, s));
          y += s.heightMm;
        }
        y += 2 * L;
        b.push(rule({ id: ids.next("r"), x: TW / 2 - 7, y, w: 14, color: PALETTE.champagne, stroke: 0.35 }));
        y += 2 * L;
        if (m.recipient) {
          b.push(lineText({ id: ids.next("t"), x: 0, y, w: TW, h: L, text: tx(labels.writtenFor), font: FONT_TEXT, sizePt: sc.micro, color: DERIVED.graphite, align: "center", uppercase: true, letterSpacingEm: 0.26 }));
          b.push(lineText({ id: ids.next("t"), x: 0, y: y + L, w: TW, h: mm(sc.h3 * 1.25) * 1.5, text: tx(m.recipient), font: FONT_DISPLAY, sizePt: sc.h3 * 1.25, color: PALETTE.ink, align: "center", italic: true }));
          y += L + mm(sc.h3 * 1.25) * 1.5 + 0.5 * L;
        }
        if (m.author) b.push(lineText({ id: ids.next("t"), x: 0, y, w: TW, h: L, text: tx(m.author), font: FONT_TEXT, sizePt: sc.body, color: DERIVED.graphite, align: "center", italic: true }));
        const by = g.top + textHeight(g) - L;
        b.push(lineText({ id: ids.next("t"), x: 0, y: by, w: TW, h: L, text: labels.imprint, font: FONT_TEXT, sizePt: sc.micro, color: PALETTE.ink, align: "center", uppercase: true, letterSpacingEm: 0.34, weightNum: 500 }));
        pages.push(page("title", shift(b), { sparse: true }));
        return;
      }
      case "colophon": {
        const lines = [labels.colophon({ recipient: m.recipient, date, edition: m.edition.number }), m.edition.note ?? ""].filter(Boolean).join("\n");
        const t = T.text("colophon", { font: FONT_TEXT, sizePt: sc.caption, leadingMm: round2(L * 0.82), align: "left", color: DERIVED.graphite, lang }, TW * 0.78, lines, { gapLines: 1 });
        pages.push(page("colophon", shift([proseBlock(ids.next("p"), 0, g.top + textHeight(g) - t.heightMm, t)]), { sparse: true }));
        return;
      }
      case "dedication": {
        const dd = m.dedication!;
        const size = sc.lead * 1.3;
        const t = T.text("dedication", { font: FONT_DISPLAY, sizePt: size, leadingMm: round2(mm(size) * 1.42), align: "center", color: PALETTE.ink, lang, italic: true, balance: true }, TW * 0.78, dd.text, { gapLines: 1 });
        const y = g.top + Math.round(textHeight(g) * 0.26 / L) * L;
        const b: Block[] = [proseBlock(ids.next("p"), TW * 0.11, y, t)];
        if (dd.signature) b.push(lineText({ id: ids.next("t"), x: 0, y: y + t.heightMm + L, w: TW, h: L, text: tx(dd.signature), font: FONT_TEXT, sizePt: sc.micro, color: DERIVED.graphite, align: "center", uppercase: true, letterSpacingEm: 0.22 }));
        pages.push(page("dedication", shift(b), { sparse: true }));
        return;
      }
      case "epigraph": {
        const e = m.epigraph!;
        pages.push(page("epigraph", shift(quoteBlocks(`epigraph.book`, e.text, e.source)), { sparse: true }));
        return;
      }
      case "contents": {
        const b: Block[] = [];
        if (d.index === 0) b.push(lineText({ id: ids.next("t"), x: 0, y: g.top + L, w: TW, h: 2.4 * L, text: labels.contents, role: "title", font: FONT_DISPLAY, sizePt: sc.h2 * 0.8, color: PALETTE.ink, align: "left", weightNum: 300, lineHeight: 1.1 }));
        let y = g.top + 6 * L;
        for (const ci of d.entries) {
          const p = plans[ci];
          const numW = 9;
          const pageW = 12;
          const t = T.text(`toc.${ci}`, { font: FONT_TEXT, sizePt: sc.body, leadingMm: L, align: "left", color: PALETTE.ink, lang }, TW - numW - pageW - 4, p.title);
          b.push(lineText({ id: ids.next("t"), x: 0, y, w: numW, h: L, text: p.conclusion ? "" : String(p.index + 1), font: FONT_TEXT, sizePt: sc.body, color: DERIVED.bronze, align: "left", features: '"onum" 1' }));
          b.push(proseBlock(ids.next("p"), numW, y, t));
          b.push(lineText({ id: ids.next("t"), x: TW - pageW, y: y + (t.lines - 1) * L, w: pageW, h: L, text: String(chapterFolio.get(ci) ?? ""), font: FONT_TEXT, sizePt: sc.body, color: DERIVED.graphite, align: "right", features: '"onum" 1, "pnum" 1' }));
          y += (t.lines + 1) * L;
        }
        pages.push(page("contents", shift(b), { sparse: true, showFolio: true }));
        return;
      }
      case "flow": {
        const p = plans[d.chapter];
        const fp = p.pages[d.page];
        const last = d.page === p.pages.length - 1;
        const b: Block[] = [];
        let y = g.top;
        if (d.page === 0) {
          b.push(...p.opening);
          y = g.top + p.sink * L;
          stats.chapters.push({ title: p.title, folio: folio!, pages: p.pages.length });
        }
        if (fp.figure) {
          const h = (p.figureLines - 2) * L;
          b.push(...illustrationArt(m.collection, ids, { x: 0, y, w: TW, h }, fp.figure.type === "illustration" ? fp.figure.src : undefined, fp.figure.type === "illustration" ? fp.figure.alt : ""));
          const cap = fp.figure.type === "illustration" ? fp.figure.caption : undefined;
          if (cap) b.push(lineText({ id: ids.next("t"), x: 0, y: y + h + 0.15 * L, w: TW, h: L, text: tx(cap), font: FONT_TEXT, sizePt: sc.caption, color: DERIVED.graphite, align: "center", italic: true }));
          y += p.figureLines * L;
        }
        const items = fragmentItems(p, fp);
        stats.paragraphs += fp.fragments.length;
        stats.lines += fp.used;
        if (!last && fp.capacity - fp.used > 0) stats.shortPages.push({ folio: folio!, missing: fp.capacity - fp.used });
        b.push({ id: ids.next("prose"), type: "prose", items, lang, fontFamily: body.font, fontSizePt: body.sizePt, leadingMm: L, indentEm: 1, align: "justify", hyphenate: true, color: body.color, x: 0, y, w: TW, h: fp.capacity * L + 0.6, style: {}, editable: false });
        const template = d.page === 0 ? (p.conclusion ? "conclusion" : "chapter_opening") : fp.figure ? "text_figure" : "text";
        const runningHead = d.page === 0 ? undefined : side === "verso" ? m.title : p.title;
        pages.push(page(template, shift(b), { chapterEnd: last, chapter: p.index, showFolio: true, runningHead }));
        return;
      }
      case "float": {
        pages.push(floatPage(d.el, d.chapter));
        return;
      }
    }

    function quoteBlocks(key: string, text: string, source?: string): Block[] {
      const size = sc.h3 * 1.3;
      const q = T.text(key, { font: FONT_DISPLAY, sizePt: size, leadingMm: round2(mm(size) * 1.32), align: "center", color: PALETTE.ink, lang, italic: true, weightNum: 300, balance: true }, TW * 0.84, text);
      const total = q.heightMm + (source ? 2.2 * L : 0);
      const y = g.top + textHeight(g) * 0.45 - total / 2;
      const out: Block[] = [rule({ id: ids.next("r"), x: TW / 2 - 5, y: y - 2 * L, w: 10, color: PALETTE.champagne, stroke: 0.35 }), proseBlock(ids.next("p"), TW * 0.08, y, q)];
      if (source) out.push(lineText({ id: ids.next("t"), x: 0, y: y + q.heightMm + 1.2 * L, w: TW, h: L, text: tx(source), font: FONT_TEXT, sizePt: sc.micro, color: DERIVED.graphite, align: "center", uppercase: true, letterSpacingEm: 0.22 }));
      return out;
    }

    function headerBlocks(label: string, key: string, titleText: string, prompt: string): { blocks: Block[]; y: number } {
      const out: Block[] = [lineText({ id: ids.next("t"), x: 0, y: g.top, w: TW, h: L, text: tx(label), font: FONT_TEXT, sizePt: sc.micro, color: DERIVED.bronze, align: "left", uppercase: true, letterSpacingEm: 0.26, weightNum: 500 })];
      const t = T.text(`${key}.title`, { font: FONT_DISPLAY, sizePt: sc.h3 * 1.35, leadingMm: round2(mm(sc.h3 * 1.35) * 1.12), align: "left", color: PALETTE.ink, lang, weightNum: 350, balance: true }, TW, titleText);
      let y = g.top + 1.4 * L;
      out.push(proseBlock(ids.next("p"), 0, y, t));
      y += t.heightMm + 0.8 * L;
      const pr = T.text(`${key}.prompt`, { font: FONT_TEXT, sizePt: g.bodyPt, leadingMm: L, align: "left", color: PALETTE.ink, lang, italic: true, hyphenate: true }, TW * 0.92, prompt);
      out.push(proseBlock(ids.next("p"), 0, y, pr));
      y += pr.heightMm;
      // Retour sur la grille de lignes
      y = g.top + Math.ceil((y - g.top) / L + 1) * L;
      return { blocks: out, y };
    }

    function writingLines(from: number, to: number, out: Block[], opts: { first?: string } = {}) {
      let k = 0;
      for (let y = from + 2 * L; y <= to + 0.01; y += 2 * L, k++) {
        out.push(rule({ id: ids.next("r"), x: 0, y, w: TW, color: PALETTE.stone, stroke: 0.2 }));
        if (k === 0 && opts.first) out.push(lineText({ id: ids.next("t"), x: 0, y: y - 1.15 * L, w: TW, h: L, text: opts.first, font: FONT_TEXT, sizePt: g.bodyPt, color: PALETTE.ink, align: "left", italic: true }));
      }
    }

    function floatPage(el: FloatEl, chapter: number): BuiltPage {
      const bottom = g.top + textHeight(g);
      if (el.type === "citation") return page("quote", shift(quoteBlocks(`${el.key}.citation`, el.text, el.source)), { sparse: true, chapter });
      if (el.type === "illustration") {
        // Pleine page à fond perdu ; la légende reste dans la zone de sécurité
        const blocks = illustrationArt(m.collection, ids, { x: 0, y: 0, w: g.widthMm, h: g.heightMm }, el.src, el.alt);
        if (el.caption) blocks.push(lineText({ id: ids.next("t"), x: x0, y: bottom + (bottomMargin(g) - L) * 0.42, w: TW, h: L, text: tx(el.caption), font: FONT_TEXT, sizePt: sc.caption, color: onArtColor(m.collection, Boolean(el.src)), align: "center", italic: true }));
        return page("illustration", blocks, { sparse: true, chapter });
      }
      if (el.type === "activity") {
        const { blocks, y } = headerBlocks(labels.activity, el.key, el.title, el.prompt);
        let cy = y;
        if (el.kind === "checklist") {
          el.items.forEach((item, k) => {
            const t = T.text(`${el.key}.item${k}`, { font: FONT_TEXT, sizePt: g.bodyPt, leadingMm: L, align: "left", color: PALETTE.ink, lang }, TW - 8, item);
            blocks.push(rect({ id: ids.next("s"), x: 0, y: cy + L * 0.5 - 1.7, w: 3.4, h: 3.4, color: "transparent", border: PALETTE.stone, stroke: 0.25 }));
            blocks.push(proseBlock(ids.next("p"), 8, cy, t));
            cy += (t.lines + 1) * L;
          });
        }
        writingLines(cy - L, bottom, blocks, { first: el.kind === "letter" ? tx(`${labels.dear} …,`) : undefined });
        return page("activity", shift(blocks), { chapter, showFolio: true });
      }
      // Souvenir : cadre photo, champs, lignes
      const { blocks, y } = headerBlocks(labels.memory, el.key, el.title, el.prompt);
      let cy = y;
      if (el.kind !== "lines") {
        const h = Math.round((textHeight(g) * (el.kind === "photo" ? 0.5 : 0.36)) / L) * L;
        blocks.push(rect({ id: ids.next("s"), x: 0, y: cy, w: TW, h, color: PALETTE.white, border: PALETTE.stone, stroke: 0.25 }));
        blocks.push(rect({ id: ids.next("s"), x: 2.2, y: cy + 2.2, w: TW - 4.4, h: h - 4.4, color: "transparent", border: PALETTE.stone, stroke: 0.15, opacity: 0.7 }));
        blocks.push(lineText({ id: ids.next("t"), x: 0, y: cy + h / 2 - L / 2, w: TW, h: L, text: tx(labels.photo), font: FONT_TEXT, sizePt: sc.micro, color: DERIVED.graphite, align: "center", uppercase: true, letterSpacingEm: 0.26 }));
        cy += h + L;
      }
      for (const f of el.fields) {
        const lw = 22;
        blocks.push(lineText({ id: ids.next("t"), x: 0, y: cy + 0.9 * L, w: lw, h: L, text: tx(f), font: FONT_TEXT, sizePt: sc.micro, color: DERIVED.graphite, align: "left", uppercase: true, letterSpacingEm: 0.2 }));
        blocks.push(rule({ id: ids.next("r"), x: lw, y: cy + 2 * L, w: TW - lw, color: PALETTE.stone, stroke: 0.2 }));
        cy += 2 * L;
      }
      writingLines(cy, bottom, blocks);
      return page("memory", shift(blocks), { chapter, showFolio: true });
    }
  });

  // Statistiques de césure (échelles de césures : plus de 3 lignes consécutives à éviter)
  for (const p of plans)
    for (const ml of p.measured) {
      if (!ml) continue;
      let run = 0;
      for (const h of ml.hyphen) {
        if (h) {
          stats.hyphenatedLines++;
          run++;
          stats.maxConsecutiveHyphens = Math.max(stats.maxConsecutiveHyphens, run);
        } else run = 0;
      }
    }

  return { title: m.title, lang, pages, theme: unwrittenTheme(g), grid: g, pageFormat: g.pageFormat, expectations: m.personalization, stats };
}

const round2 = (x: number) => Math.round(x * 100) / 100;

// ---------------------------------------------------------------------------
// Flux d'un chapitre
// ---------------------------------------------------------------------------

/** Transforme les blocs d'un chapitre en unités de flux et éléments de prose de base. */
export function flowUnits(blocks: ChapterBlock[], lang: EditorialLang, keyPrefix: string, signature?: string): { units: FlowUnit<FloatEl>[]; items: (ProseItem | null)[] } {
  const units: FlowUnit<FloatEl>[] = [];
  const items: (ProseItem | null)[] = [];
  let prev: "start" | "p" | "quote" | "subhead" | "break" = "start";
  let firstPara = true;
  let floats = 0;
  const push = (kind: FlowUnit["kind"], item: ProseItem | null, float?: FloatEl) => {
    units.push({ kind, lines: kind === "break" ? 2 : 0, spaceBefore: item?.spaceBefore, float });
    items.push(item);
  };
  for (const b of blocks) {
    switch (b.type) {
      case "p": {
        let runs: ProseRun[] = parseInline(b.text, lang);
        if (firstPara) runs = leadInRuns(runs, 3);
        push("p", { kind: "p", runs, indent: prev === "p", spaceBefore: prev === "quote" ? 1 : undefined });
        firstPara = false;
        prev = "p";
        break;
      }
      case "quote": {
        const runs = parseInline(b.text, lang);
        if (b.source) runs.push({ t: ` — ${typeset(b.source, lang)}`, sc: true });
        push("quote", { kind: "quote", runs, spaceBefore: prev === "start" ? undefined : 1 });
        prev = "quote";
        break;
      }
      case "subhead":
        push("subhead", { kind: "subhead", runs: parseInline(b.text, lang), spaceBefore: prev === "start" ? undefined : 1 });
        prev = "subhead";
        break;
      case "break":
        push("break", { kind: "break", runs: [] });
        prev = "break";
        break;
      default:
        push("float", null, { ...b, key: `${keyPrefix}.f${floats++}` } as FloatEl);
    }
  }
  if (signature) push("p", { kind: "p", runs: [{ t: typeset(signature, lang), i: true }], align: "right", spaceBefore: 1 });
  return { units, items };
}

/** Fragments d'une page → éléments de prose (texte découpé aux débuts de ligne mesurés). */
function fragmentItems(p: ChapterPlan, fp: FlowPage<FloatEl>): ProseItem[] {
  return fp.fragments.map((f) => {
    const base = p.items[f.unit]!;
    const ml = p.measured[f.unit];
    const u = p.units[f.unit];
    if (u.kind === "break" || !ml) return { ...base, lines: f.to - f.from, spaceBefore: f.spaceBefore || undefined };
    return sliceItem(base, ml, f.from, f.to, f.spaceBefore);
  });
}

/** Découpe un paragraphe mesuré entre les lignes [from, to). */
export function sliceItem(base: ProseItem, ml: MeasuredLines, from: number, to: number, spaceBefore = 0): ProseItem {
  const n = ml.starts.length;
  const text = runsText(base.runs);
  const start = from === 0 ? 0 : ml.starts[from];
  const end = to >= n ? text.length : ml.starts[to];
  const runs = sliceRuns(base.runs, start, end);
  // Espace de fin de ligne retirée ; trait d'union ajouté si la coupure était une césure
  while (runs.length && /^ *$/.test(runs[runs.length - 1].t)) runs.pop();
  if (runs.length) {
    const last = runs[runs.length - 1];
    runs[runs.length - 1] = { ...last, t: last.t.replace(/ +$/, "") + (to < n && ml.hyphen[to - 1] ? "‐" : "") };
  }
  return {
    ...base,
    runs,
    lines: to - from,
    indent: from === 0 ? base.indent : undefined,
    continued: from > 0 || undefined,
    continues: to < n || undefined,
    spaceBefore: spaceBefore || undefined,
  };
}

/** Utilitaire de test et de diagnostic : texte de chaque page de prose. */
export function proseText(page: BuiltPage): string {
  return page.layout.blocks
    .filter((b): b is Extract<Block, { type: "prose" }> => b.type === "prose")
    .map((b) => b.items.map((it) => runsText(it.runs)).join("\n"))
    .join("\n");
}

export type { MeasuredText, Labels, TypeScale };
