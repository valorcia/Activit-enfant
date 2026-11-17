/**
 * Couvertures UNWRITTEN : trois directions artistiques par collection, composées uniquement
 * de typographie, de filets et d'aplats de la palette (aucun dégradé, aucune image inventée).
 * Description et intentions : docs/unwritten/DESIGN_SYSTEM_UNWRITTEN.md § 9.
 *
 * Chaque direction fournit la première et la quatrième de couverture, et l'aplat utilisé à
 * la place des illustrations tant qu'aucune illustration réelle n'est fournie.
 */
import type { Block } from "../schemas/layout";
import { circle, image, lineText, proseBlock, rect, rule, type Ids, type TextBank, type TextSpec } from "./blocks";
import { FONT_DISPLAY, FONT_TEXT } from "./fonts";
import type { EditorialGrid, TypeScale } from "./grid";
import { PT_TO_MM } from "./grid";
import type { Labels } from "./labels";
import type { CollectionKey, Manuscript } from "./manuscript";
import { DERIVED, PALETTE } from "./palette";
import { typeset } from "./typography";

export interface CoverCtx {
  g: EditorialGrid;
  sc: TypeScale;
  m: Manuscript;
  T: TextBank;
  ids: Ids;
  labels: Labels;
  date: string;
}

export interface CoverDirection {
  key: string;
  collection: CollectionKey;
  name: string;
  description: string;
  front(c: CoverCtx): { background: string; blocks: Block[] };
  back(c: CoverCtx): { background: string; blocks: Block[] };
}

export const COLLECTION_NAMES: Record<CollectionKey, { en: string; fr: string }> = {
  "secret-book": { en: "The Secret Book", fr: "The Secret Book" },
  "before-too-late": { en: "Before It's Too Late", fr: "Before It's Too Late" },
  "movie-of-my-life": { en: "The Movie of My Life", fr: "The Movie of My Life" },
};

const mm = (pt: number) => pt * PT_TO_MM;
const lead = (pt: number, k: number) => Math.round(mm(pt) * k * 100) / 100;
const tx = (c: CoverCtx, s: string) => typeset(s, c.m.lang);

function spec(c: CoverCtx, o: Partial<TextSpec> & { sizePt: number; color: string }): TextSpec {
  return { font: FONT_DISPLAY, leadingMm: lead(o.sizePt, 1.08), align: "center", lang: c.m.lang, balance: true, ...o };
}

/** Mention en capitales espacées (une ligne). */
function caps(c: CoverCtx, o: { text: string; x: number; y: number; w: number; color: string; size?: number; ls?: number; align?: "left" | "center" | "right" }): Block {
  const size = o.size ?? c.sc.micro;
  return lineText({ id: c.ids.next("t"), x: o.x, y: o.y, w: o.w, h: mm(size) * 1.6, text: tx(c, o.text), font: FONT_TEXT, sizePt: size, color: o.color, align: o.align ?? "center", uppercase: true, letterSpacingEm: o.ls ?? 0.28, weightNum: 500 });
}

function collectionName(c: CoverCtx) {
  return COLLECTION_NAMES[c.m.collection][c.m.lang];
}

function recipientLine(c: CoverCtx) {
  if (!c.m.recipient) return "";
  return c.m.lang === "fr" ? `pour ${c.m.recipient}` : `for ${c.m.recipient}`;
}

/** Titre de couverture mesuré, centré horizontalement ; `anchor` : haut ou bas du bloc. */
function title(c: CoverCtx, key: string, o: { y: number; anchor?: "top" | "bottom"; x?: number; w?: number; sizePt: number; color: string; italic?: boolean; weightNum?: number; align?: TextSpec["align"]; uppercase?: boolean; ls?: number; text?: string }) {
  const W = c.g.widthMm;
  const w = o.w ?? W * 0.8;
  const t = c.T.text(key, spec(c, { sizePt: o.sizePt, color: o.color, italic: o.italic, weightNum: o.weightNum ?? 300, align: o.align ?? "center", uppercase: o.uppercase, letterSpacingEm: o.ls }), w, o.text ?? c.m.title);
  const x = o.x ?? (W - w) / 2;
  const y = o.anchor === "bottom" ? o.y - t.heightMm : o.y;
  return { block: proseBlock(c.ids.next("p"), x, y, t), top: y, bottom: y + t.heightMm };
}

// ---------------------------------------------------------------------------
// Quatrième de couverture commune, déclinée en clair ou en sombre
// ---------------------------------------------------------------------------

function backCover(c: CoverCtx, o: { background: string; ink: string; soft: string; accent: string }): { background: string; blocks: Block[] } {
  const { widthMm: W, heightMm: H } = c.g;
  const blocks: Block[] = [];
  const w = W * 0.66;
  const blurb = c.T.text("back.blurb", { font: FONT_TEXT, sizePt: c.sc.body * 1.05, leadingMm: c.g.leadingMm * 1.05, align: "center", color: o.ink, lang: c.m.lang, hyphenate: false, balance: true }, w, c.m.backCover.blurb, { gapLines: 1 });
  const q = c.m.backCover.quote ? c.T.text("back.quote", spec(c, { sizePt: c.sc.lead * 1.15, color: o.ink, italic: true, weightNum: 300, leadingMm: lead(c.sc.lead * 1.15, 1.3) }), w, c.m.backCover.quote) : null;
  // Résumé, filet et citation forment un seul ensemble, centré à hauteur optique
  const total = blurb.heightMm + (q ? c.g.leadingMm * 3 + q.heightMm : 0);
  let y = Math.max(H * 0.18, H * 0.46 - total / 2);
  blocks.push(caps(c, { text: collectionName(c), x: 0, y: H * 0.1, w: W, color: o.soft }));
  blocks.push(proseBlock(c.ids.next("p"), (W - w) / 2, y, blurb));
  y += blurb.heightMm + c.g.leadingMm * 1.5;
  if (q) {
    blocks.push(rule({ id: c.ids.next("r"), x: W / 2 - 5, y, w: 10, color: o.accent, stroke: 0.3 }));
    y += c.g.leadingMm * 1.5;
    blocks.push(proseBlock(c.ids.next("p"), (W - w) / 2, y, q));
  }
  const rec = recipientLine(c);
  if (rec) blocks.push(lineText({ id: c.ids.next("t"), x: 0, y: H * 0.84, w: W, h: mm(c.sc.caption) * 1.6, text: tx(c, c.m.lang === "fr" ? `Édition personnelle ${rec}` : `A personal edition ${rec}`), font: FONT_TEXT, sizePt: c.sc.caption, color: o.soft, align: "center", italic: true }));
  blocks.push(caps(c, { text: c.labels.imprint, x: 0, y: H * 0.9, w: W, color: o.ink, ls: 0.34 }));
  return { background: o.background, blocks };
}

const darkBack = (c: CoverCtx) => backCover(c, { background: PALETTE.ink, ink: PALETTE.ivory, soft: PALETTE.stone, accent: PALETTE.champagne });
const lightBack = (c: CoverCtx) => backCover(c, { background: PALETTE.ivory, ink: PALETTE.ink, soft: DERIVED.graphite, accent: PALETTE.champagne });

/** Bloc illustration réelle ou aplat, pour une couverture. */
function coverArt(c: CoverCtx, area: { x: number; y: number; w: number; h: number }, fallback: () => Block[]): Block[] {
  const ill = c.m.cover.illustration;
  if (ill?.src) return [image({ id: c.ids.next("i"), ...area, src: ill.src, alt: ill.alt })];
  return fallback();
}

// ---------------------------------------------------------------------------
// The Secret Book
// ---------------------------------------------------------------------------

const secretSeal: CoverDirection = {
  key: "secret-seal",
  collection: "secret-book",
  name: "Le sceau",
  description: "Fond encre, double cercle champagne et monogramme en italique : un pli cacheté, la promesse d'un secret.",
  front(c) {
    const { widthMm: W, heightMm: H } = c.g;
    const d = W * 0.42;
    const cy = H * 0.37;
    const blocks: Block[] = [caps(c, { text: collectionName(c), x: 0, y: H * 0.095, w: W, color: PALETTE.champagne, ls: 0.34 })];
    blocks.push(circle({ id: c.ids.next("c"), cx: W / 2, cy, d, color: "transparent", border: PALETTE.champagne, stroke: 0.35 }));
    blocks.push(circle({ id: c.ids.next("c"), cx: W / 2, cy, d: d - 3.2, color: "transparent", border: PALETTE.champagne, stroke: 0.15 }));
    const mono = c.m.cover.monogram ?? c.m.recipient?.[0] ?? c.m.title[0];
    const monoPt = Math.min(90, (d * 0.56) / PT_TO_MM);
    blocks.push(lineText({ id: c.ids.next("t"), x: W / 2 - d / 2, y: cy - d / 2, w: d, h: d, text: mono, font: FONT_DISPLAY, sizePt: monoPt, color: PALETTE.champagne, align: "center", italic: true, weightNum: 300, lineHeight: 1, valign: "middle", role: "title" }));
    const t = title(c, "cover.title", { y: cy + d / 2 + H * 0.075, sizePt: c.sc.display * 0.78, color: PALETTE.ivory, weightNum: 300 });
    blocks.push(t.block);
    const rec = recipientLine(c);
    if (rec) blocks.push(lineText({ id: c.ids.next("t"), x: 0, y: t.bottom + c.g.leadingMm * 0.8, w: W, h: mm(c.sc.lead * 1.3) * 1.5, text: rec, font: FONT_DISPLAY, sizePt: c.sc.lead * 1.3, color: PALETTE.champagne, align: "center", italic: true }));
    blocks.push(caps(c, { text: c.labels.imprint, x: 0, y: H * 0.9, w: W, color: PALETTE.stone, ls: 0.34 }));
    return { background: PALETTE.ink, blocks };
  },
  back: darkBack,
};

const secretEnvelope: CoverDirection = {
  key: "secret-envelope",
  collection: "secret-book",
  name: "L'enveloppe",
  description: "Ivoire, une enveloppe tracée au filet et fermée d'une pastille champagne : la lettre qu'on n'ouvre qu'une fois.",
  front(c) {
    const { widthMm: W, heightMm: H } = c.g;
    const m = W * 0.12;
    const ew = W - 2 * m;
    const eh = ew * 0.64;
    const ey = H * 0.17;
    const blocks: Block[] = [caps(c, { text: collectionName(c), x: 0, y: H * 0.085, w: W, color: DERIVED.graphite })];
    blocks.push(rect({ id: c.ids.next("s"), x: m, y: ey, w: ew, h: eh, color: PALETTE.white, border: PALETTE.stone, stroke: 0.3 }));
    // Rabat : deux filets obliques des coins supérieurs jusqu'au point de fermeture
    const px = W / 2;
    const py = ey + eh * 0.56;
    for (const sx of [m, W - m]) {
      const dx = px - sx;
      const dy = py - ey;
      const len = Math.hypot(dx, dy);
      const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
      blocks.push(rule({ id: c.ids.next("r"), x: (sx + px) / 2 - len / 2, y: (ey + py) / 2, w: len, color: PALETTE.stone, stroke: 0.3, rotateDeg: ang }));
    }
    const sd = W * 0.085;
    blocks.push(circle({ id: c.ids.next("c"), cx: px, cy: py, d: sd, color: PALETTE.champagne }));
    const mono = c.m.cover.monogram ?? c.m.recipient?.[0] ?? c.m.title[0];
    blocks.push(lineText({ id: c.ids.next("t"), x: px - sd / 2, y: py - sd / 2, w: sd, h: sd, text: mono, font: FONT_DISPLAY, sizePt: (sd * 0.62) / PT_TO_MM, color: PALETTE.ink, align: "center", italic: true, weightNum: 400, lineHeight: 1, valign: "middle", role: "title" }));
    const t = title(c, "cover.title", { y: ey + eh + H * 0.08, sizePt: c.sc.display * 0.74, color: PALETTE.ink, italic: true, weightNum: 300 });
    blocks.push(t.block);
    const rec = recipientLine(c);
    if (rec) blocks.push(lineText({ id: c.ids.next("t"), x: 0, y: t.bottom + c.g.leadingMm, w: W, h: mm(c.sc.body * 1.1) * 1.6, text: rec, font: FONT_TEXT, sizePt: c.sc.body * 1.1, color: DERIVED.graphite, align: "center", italic: true }));
    blocks.push(caps(c, { text: c.labels.imprint, x: 0, y: H * 0.9, w: W, color: PALETTE.ink, ls: 0.34 }));
    return { background: PALETTE.ivory, blocks };
  },
  back: lightBack,
};

const secretRedacted: CoverDirection = {
  key: "secret-redacted",
  collection: "secret-book",
  name: "Le caviardage",
  description: "Une page de texte noircie dont une seule ligne reste lisible : le prénom. Contemporain, graphique, sans ornement.",
  front(c) {
    const { widthMm: W, heightMm: H } = c.g;
    const m = W * 0.11;
    const blocks: Block[] = [];
    blocks.push(caps(c, { text: collectionName(c), x: m, y: H * 0.08, w: W - 2 * m, color: PALETTE.ink, align: "left", ls: 0.3 }));
    if (c.m.edition.number) blocks.push(lineText({ id: c.ids.next("t"), x: m, y: H * 0.08, w: W - 2 * m, h: mm(c.sc.micro) * 1.6, text: `N° ${c.m.edition.number}`, font: FONT_TEXT, sizePt: c.sc.micro, color: DERIVED.graphite, align: "right", letterSpacingEm: 0.16, features: '"onum" 1' }));
    blocks.push(rule({ id: c.ids.next("r"), x: m, y: H * 0.115, w: W - 2 * m, color: PALETTE.ink, stroke: 0.25 }));
    // Lignes caviardées (largeurs fixes, répétables) ; la 5e laisse voir le destinataire
    const widths = [1, 0.93, 0.97, 0.62, -1, 0.88, 1, 0.71, 0.95, 0.4];
    const lh = H * 0.034;
    let y = H * 0.17;
    const full = W - 2 * m;
    for (const k of widths) {
      if (k < 0) {
        const name = (c.m.recipient ?? c.m.title).toUpperCase();
        const nameW = full * 0.42;
        blocks.push(rect({ id: c.ids.next("s"), x: m, y: y + lh * 0.18, w: full * 0.22, h: lh * 0.62, color: PALETTE.ink }));
        blocks.push(lineText({ id: c.ids.next("t"), x: m + full * 0.25, y: y - lh * 0.05, w: nameW, h: lh, text: name, font: FONT_TEXT, sizePt: (lh * 0.5) / PT_TO_MM, color: DERIVED.bronze, align: "left", letterSpacingEm: 0.22, weightNum: 500, valign: "middle" }));
        blocks.push(rect({ id: c.ids.next("s"), x: m + full * 0.25 + nameW + 2, y: y + lh * 0.18, w: full - (full * 0.25 + nameW + 2), h: lh * 0.62, color: PALETTE.ink }));
      } else {
        blocks.push(rect({ id: c.ids.next("s"), x: m, y: y + lh * 0.18, w: full * k, h: lh * 0.62, color: PALETTE.ink }));
      }
      y += lh;
    }
    const t = title(c, "cover.title", { y: H * 0.83, anchor: "bottom", x: m, w: full, sizePt: c.sc.display * 0.82, color: PALETTE.ink, align: "left", weightNum: 300 });
    blocks.push(t.block);
    blocks.push(caps(c, { text: c.labels.imprint, x: m, y: H * 0.9, w: full, color: PALETTE.ink, align: "left", ls: 0.34 }));
    return { background: PALETTE.ivory, blocks };
  },
  back: lightBack,
};

// ---------------------------------------------------------------------------
// Before It's Too Late
// ---------------------------------------------------------------------------

const beforeHorizon: CoverDirection = {
  key: "before-horizon",
  collection: "before-too-late",
  name: "L'horizon",
  description: "Ciel ivoire, terre de pierre, une ligne d'horizon champagne : le temps qui reste, sans pathos.",
  front(c) {
    const { widthMm: W, heightMm: H } = c.g;
    const hy = H * 0.64;
    const blocks: Block[] = [];
    blocks.push(...coverArt(c, { x: 0, y: hy, w: W, h: H - hy }, () => [rect({ id: c.ids.next("s"), x: 0, y: hy, w: W, h: H - hy, color: PALETTE.stone })]));
    blocks.push(rule({ id: c.ids.next("r"), x: 0, y: hy, w: W, color: PALETTE.champagne, stroke: 0.6 }));
    blocks.push(caps(c, { text: c.m.subtitle ?? collectionName(c), x: 0, y: H * 0.09, w: W, color: DERIVED.graphite }));
    const t = title(c, "cover.title", { y: hy - H * 0.07, anchor: "bottom", sizePt: c.sc.display * 0.86, color: PALETTE.ink, weightNum: 300 });
    blocks.push(t.block);
    const rec = recipientLine(c);
    if (rec) blocks.push(lineText({ id: c.ids.next("t"), x: 0, y: hy + H * 0.07, w: W, h: mm(c.sc.lead * 1.35) * 1.5, text: rec, font: FONT_DISPLAY, sizePt: c.sc.lead * 1.35, color: PALETTE.ink, align: "center", italic: true }));
    blocks.push(caps(c, { text: c.labels.imprint, x: 0, y: H * 0.9, w: W, color: PALETTE.ink, ls: 0.34 }));
    return { background: PALETTE.ivory, blocks };
  },
  back: lightBack,
};

const beforeLetter: CoverDirection = {
  key: "before-letter",
  collection: "before-too-late",
  name: "La lettre",
  description: "Papier blanc, une date, « Chère maman, » et des lignes encore vides : une lettre commencée, à finir.",
  front(c) {
    const { widthMm: W, heightMm: H } = c.g;
    const m = W * 0.13;
    const blocks: Block[] = [];
    blocks.push(lineText({ id: c.ids.next("t"), x: m, y: H * 0.1, w: W - 2 * m, h: mm(c.sc.caption) * 1.6, text: c.date, font: FONT_TEXT, sizePt: c.sc.caption * 1.05, color: DERIVED.graphite, align: "right", italic: true }));
    const salutation = c.m.cover.kicker ?? `${c.labels.dear} ${c.m.recipient ?? ""},`;
    const s = title(c, "cover.salutation", { y: H * 0.2, x: m, w: W - 2 * m, sizePt: c.sc.display * 0.7, color: PALETTE.ink, italic: true, weightNum: 300, align: "left", text: salutation });
    blocks.push(s.block);
    const gap = H * 0.052;
    let y = s.bottom + gap * 1.2;
    for (let k = 0; k < 6; k++) {
      blocks.push(rule({ id: c.ids.next("r"), x: m, y, w: W - 2 * m, color: PALETTE.stone, stroke: 0.2 }));
      if (k === 0 && c.m.subtitle) blocks.push(lineText({ id: c.ids.next("t"), x: m, y: y - mm(c.sc.body * 1.15) * 1.45, w: W - 2 * m, h: mm(c.sc.body * 1.15) * 1.4, text: tx(c, c.m.subtitle), font: FONT_TEXT, sizePt: c.sc.body * 1.15, color: PALETTE.ink, align: "left", italic: true }));
      y += gap;
    }
    blocks.push(rule({ id: c.ids.next("r"), x: W / 2 - 6, y: H * 0.8, w: 12, color: PALETTE.champagne, stroke: 0.4 }));
    blocks.push(caps(c, { text: c.m.title, x: 0, y: H * 0.825, w: W, color: PALETTE.ink, size: c.sc.caption * 1.15, ls: 0.26 }));
    blocks.push(caps(c, { text: c.labels.imprint, x: 0, y: H * 0.9, w: W, color: DERIVED.graphite, ls: 0.34 }));
    return { background: PALETTE.white, blocks };
  },
  back: lightBack,
};

const beforeTimeline: CoverDirection = {
  key: "before-timeline",
  collection: "before-too-late",
  name: "La ligne de vie",
  description: "Fond encre, une ligne de temps champagne jalonnée d'années, ouverte sur aujourd'hui.",
  front(c) {
    const { widthMm: W, heightMm: H } = c.g;
    const blocks: Block[] = [caps(c, { text: collectionName(c), x: 0, y: H * 0.08, w: W, color: PALETTE.champagne, ls: 0.32 })];
    const marks = c.m.cover.marks.length ? c.m.cover.marks : ["", "", ""];
    const y0 = H * 0.16;
    const y1 = H * 0.56;
    blocks.push(rule({ id: c.ids.next("r"), x: W / 2, y: y0, w: 1, vertical: y1 - y0, color: PALETTE.champagne, stroke: 0.3 }));
    const step = (y1 - y0) / Math.max(1, marks.length - 1);
    const size = c.sc.caption * 1.1;
    marks.forEach((label, k) => {
      const y = y0 + k * step;
      const last = k === marks.length - 1;
      blocks.push(circle({ id: c.ids.next("c"), cx: W / 2, cy: y, d: last ? 3.4 : 2, color: last ? PALETTE.ink : PALETTE.champagne, border: last ? PALETTE.champagne : undefined, stroke: 0.35 }));
      const left = k % 2 === 0;
      blocks.push(lineText({ id: c.ids.next("t"), x: left ? W / 2 - 4 - 40 : W / 2 + 4, y: y - mm(size) * 0.8, w: 40, h: mm(size) * 1.6, text: tx(c, label), font: FONT_TEXT, sizePt: size, color: PALETTE.ivory, align: left ? "right" : "left", letterSpacingEm: 0.12, features: '"onum" 1, "pnum" 1' }));
    });
    const t = title(c, "cover.title", { y: H * 0.64, sizePt: c.sc.display * 0.8, color: PALETTE.ivory, weightNum: 300 });
    blocks.push(t.block);
    const rec = recipientLine(c);
    if (rec) blocks.push(lineText({ id: c.ids.next("t"), x: 0, y: t.bottom + c.g.leadingMm * 0.8, w: W, h: mm(c.sc.lead * 1.3) * 1.5, text: rec, font: FONT_DISPLAY, sizePt: c.sc.lead * 1.3, color: PALETTE.champagne, align: "center", italic: true }));
    blocks.push(caps(c, { text: c.labels.imprint, x: 0, y: H * 0.9, w: W, color: PALETTE.stone, ls: 0.34 }));
    return { background: PALETTE.ink, blocks };
  },
  back: darkBack,
};

// ---------------------------------------------------------------------------
// The Movie of My Life
// ---------------------------------------------------------------------------

const moviePoster: CoverDirection = {
  key: "movie-poster",
  collection: "movie-of-my-life",
  name: "L'affiche",
  description: "Affiche de cinéma sobre : cadre au format 2,39:1, titre en capitales fines, générique en pied de page.",
  front(c) {
    const { widthMm: W, heightMm: H } = c.g;
    const m = W * 0.1;
    const fw = W - 2 * m;
    const fh = fw / 2.39;
    const fy = H * 0.15;
    const blocks: Block[] = [caps(c, { text: c.m.lang === "fr" ? "UNWRITTEN présente" : "UNWRITTEN presents", x: 0, y: H * 0.075, w: W, color: PALETTE.stone, ls: 0.34 })];
    blocks.push(...coverArt(c, { x: m, y: fy, w: fw, h: fh }, () => artMovie(c.ids, { x: m, y: fy, w: fw, h: fh }, true)));
    const t = title(c, "cover.title", { y: fy + fh + H * 0.08, sizePt: c.sc.display * 0.72, color: PALETTE.ivory, weightNum: 300, uppercase: true, ls: 0.06, w: W * 0.84 });
    blocks.push(t.block);
    if (c.m.subtitle) blocks.push(lineText({ id: c.ids.next("t"), x: 0, y: t.bottom + c.g.leadingMm * 0.6, w: W, h: mm(c.sc.lead * 1.25) * 1.5, text: tx(c, c.m.subtitle), font: FONT_DISPLAY, sizePt: c.sc.lead * 1.25, color: PALETTE.champagne, align: "center", italic: true }));
    const credits = c.m.cover.marks.join("\n");
    if (credits) {
      const k = c.T.text("cover.credits", { font: FONT_TEXT, sizePt: c.sc.micro, leadingMm: lead(c.sc.micro, 1.7), align: "center", color: PALETTE.stone, lang: c.m.lang, uppercase: true, letterSpacingEm: 0.14 }, W * 0.78, credits);
      blocks.push(proseBlock(c.ids.next("p"), W * 0.11, H * 0.86 - k.heightMm, k));
    }
    blocks.push(caps(c, { text: c.labels.imprint, x: 0, y: H * 0.905, w: W, color: PALETTE.ivory, ls: 0.34 }));
    return { background: PALETTE.ink, blocks };
  },
  back: darkBack,
};

const movieTitleCard: CoverDirection = {
  key: "movie-title-card",
  collection: "movie-of-my-life",
  name: "Le carton-titre",
  description: "Bandes noires de cinémascope, carton ivoire au centre : le premier plan du film, titre en italique et années.",
  front(c) {
    const { widthMm: W, heightMm: H } = c.g;
    const band = H * 0.13;
    const blocks: Block[] = [rect({ id: c.ids.next("s"), x: 0, y: 0, w: W, h: band, color: PALETTE.ink }), rect({ id: c.ids.next("s"), x: 0, y: H - band, w: W, h: band, color: PALETTE.ink })];
    const rec = recipientLine(c);
    if (rec) blocks.push(lineText({ id: c.ids.next("t"), x: 0, y: band / 2 - mm(c.sc.lead * 1.2) * 0.75, w: W, h: mm(c.sc.lead * 1.2) * 1.5, text: rec, font: FONT_DISPLAY, sizePt: c.sc.lead * 1.2, color: PALETTE.champagne, align: "center", italic: true }));
    blocks.push(caps(c, { text: c.m.cover.kicker ?? collectionName(c), x: 0, y: H * 0.3, w: W, color: DERIVED.graphite, ls: 0.3 }));
    const t = title(c, "cover.title", { y: H * 0.36, sizePt: c.sc.display * 0.92, color: PALETTE.ink, italic: true, weightNum: 300, w: W * 0.82 });
    blocks.push(t.block);
    blocks.push(rule({ id: c.ids.next("r"), x: W / 2 - 6, y: t.bottom + c.g.leadingMm * 1.2, w: 12, color: PALETTE.champagne, stroke: 0.4 }));
    const years = c.m.cover.marks[0];
    if (years) blocks.push(caps(c, { text: years, x: 0, y: t.bottom + c.g.leadingMm * 2, w: W, color: DERIVED.bronze, size: c.sc.caption * 1.1, ls: 0.3 }));
    blocks.push(caps(c, { text: c.labels.imprint, x: 0, y: H - band / 2 - mm(c.sc.micro) * 0.8, w: W, color: PALETTE.stone, ls: 0.34 }));
    return { background: PALETTE.ivory, blocks };
  },
  back: darkBack,
};

const movieContact: CoverDirection = {
  key: "movie-contact-sheet",
  collection: "movie-of-my-life",
  name: "La planche-contact",
  description: "Douze photogrammes en attente de souvenirs, un seul cerclé de champagne : la vie comme une pellicule.",
  front(c) {
    const { widthMm: W, heightMm: H } = c.g;
    const m = W * 0.1;
    const cols = 3;
    const rows = 4;
    const gap = 2.4;
    const fw = (W - 2 * m - (cols - 1) * gap) / cols;
    const fh = fw * 0.68;
    const y0 = H * 0.09;
    const blocks: Block[] = [];
    const tones = [1, 0.55, 0.8, 0.4, 0.9, 0.65, 0.5, 1, 0.7, 0.85, 0.45, 0.6];
    for (let r = 0; r < rows; r++) {
      for (let k = 0; k < cols; k++) {
        const i = r * cols + k;
        const x = m + k * (fw + gap);
        const y = y0 + r * (fh + gap + 3.2);
        blocks.push(rect({ id: c.ids.next("s"), x, y, w: fw, h: fh, color: PALETTE.stone, opacity: tones[i] }));
        if (i === 7) blocks.push(rect({ id: c.ids.next("s"), x: x - 1.2, y: y - 1.2, w: fw + 2.4, h: fh + 2.4, color: "transparent", border: PALETTE.champagne, stroke: 0.5 }));
        blocks.push(lineText({ id: c.ids.next("t"), x, y: y + fh + 0.4, w: fw, h: 2.8, text: `${i + 1}A`, font: FONT_TEXT, sizePt: c.sc.micro * 0.85, color: DERIVED.graphite, align: "left", letterSpacingEm: 0.14, features: '"lnum" 1' }));
      }
    }
    const gridBottom = y0 + rows * (fh + gap + 3.2);
    const t = title(c, "cover.title", { y: gridBottom + H * 0.05, x: m, w: W - 2 * m, sizePt: c.sc.display * 0.8, color: PALETTE.ink, align: "left", weightNum: 300 });
    blocks.push(t.block);
    const years = c.m.cover.marks[0];
    const rec = recipientLine(c);
    const sub = [rec, years].filter(Boolean).join(" · ");
    if (sub) blocks.push(lineText({ id: c.ids.next("t"), x: m, y: t.bottom + c.g.leadingMm * 0.6, w: W - 2 * m, h: mm(c.sc.lead) * 1.6, text: tx(c, sub), font: FONT_DISPLAY, sizePt: c.sc.lead * 1.15, color: DERIVED.graphite, align: "left", italic: true }));
    blocks.push(caps(c, { text: c.labels.imprint, x: m, y: H * 0.92, w: W - 2 * m, color: PALETTE.ink, align: "left", ls: 0.34 }));
    return { background: PALETTE.ivory, blocks };
  },
  back: lightBack,
};

export const COVER_DIRECTIONS: CoverDirection[] = [secretSeal, secretEnvelope, secretRedacted, beforeHorizon, beforeLetter, beforeTimeline, moviePoster, movieTitleCard, movieContact];

export function coverDirection(key: string, collection: CollectionKey): CoverDirection {
  return COVER_DIRECTIONS.find((d) => d.key === key && d.collection === collection) ?? COVER_DIRECTIONS.find((d) => d.collection === collection)!;
}

// ---------------------------------------------------------------------------
// Aplats d'illustration (en attendant une illustration réelle)
// ---------------------------------------------------------------------------

export interface ArtArea {
  x: number;
  y: number;
  w: number;
  h: number;
}

function artSecret(ids: Ids, a: ArtArea): Block[] {
  const d = Math.min(a.w, a.h) * 0.42;
  return [
    rect({ id: ids.next("s"), ...a, color: PALETTE.ink }),
    circle({ id: ids.next("c"), cx: a.x + a.w * 0.5, cy: a.y + a.h * 0.46, d, color: "transparent", border: PALETTE.champagne, stroke: 0.3 }),
    circle({ id: ids.next("c"), cx: a.x + a.w * 0.5 + d * 0.62, cy: a.y + a.h * 0.46 - d * 0.48, d: 1.4, color: PALETTE.champagne }),
  ];
}

function artBefore(ids: Ids, a: ArtArea): Block[] {
  const hy = a.y + a.h * 0.62;
  const d = Math.min(a.w, a.h) * 0.2;
  return [
    rect({ id: ids.next("s"), x: a.x, y: a.y, w: a.w, h: hy - a.y, color: PALETTE.white }),
    rect({ id: ids.next("s"), x: a.x, y: hy, w: a.w, h: a.y + a.h - hy, color: PALETTE.stone }),
    circle({ id: ids.next("c"), cx: a.x + a.w * 0.68, cy: hy - d * 0.15, d, color: PALETTE.champagne }),
    rect({ id: ids.next("s"), x: a.x, y: hy, w: a.w, h: d * 0.5, color: PALETTE.stone }),
    rule({ id: ids.next("r"), x: a.x, y: hy, w: a.w, color: PALETTE.champagne, stroke: 0.5 }),
  ];
}

function artMovie(ids: Ids, a: ArtArea, bare = false): Block[] {
  const fw = a.w * (bare ? 1 : 0.84);
  const fh = Math.min(a.h * (bare ? 1 : 0.8), fw / 2.39);
  const fx = a.x + (a.w - fw) / 2;
  const fy = a.y + (a.h - fh) / 2;
  const out: Block[] = bare ? [] : [rect({ id: ids.next("s"), ...a, color: PALETTE.ink })];
  out.push(rect({ id: ids.next("s"), x: fx, y: fy, w: fw, h: fh, color: PALETTE.stone }));
  out.push(rect({ id: ids.next("s"), x: fx, y: fy + fh * 0.64, w: fw, h: fh * 0.36, color: PALETTE.ink, opacity: 0.55 }));
  out.push(circle({ id: ids.next("c"), cx: fx + fw * 0.3, cy: fy + fh * 0.64, d: fh * 0.22, color: PALETTE.ivory }));
  out.push(rect({ id: ids.next("s"), x: fx - 1.2, y: fy - 1.2, w: fw + 2.4, h: fh + 2.4, color: "transparent", border: PALETTE.champagne, stroke: 0.25 }));
  return out;
}

/** Aplat d'illustration propre à la collection ; ou l'illustration réelle si `src` est fourni. */
export function illustrationArt(collection: CollectionKey, ids: Ids, a: ArtArea, src?: string, alt = ""): Block[] {
  if (src) return [image({ id: ids.next("i"), ...a, src, alt })];
  if (collection === "secret-book") return artSecret(ids, a);
  if (collection === "before-too-late") return artBefore(ids, a);
  return artMovie(ids, a);
}

/** Couleur du texte posé sur l'aplat d'une collection (légendes des illustrations pleine page). */
export function onArtColor(collection: CollectionKey, hasImage: boolean): string {
  if (hasImage) return PALETTE.ivory;
  return collection === "before-too-late" ? PALETTE.ink : PALETTE.ivory;
}
