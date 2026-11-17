/**
 * Fabrique des blocs des gabarits éditoriaux et registre des textes à mesurer.
 *
 * Tout texte de plus d'une ligne (titres, consignes, citations, résumés) est un bloc « prose »
 * dont les lignes sont mesurées dans Chromium : sa hauteur réelle est connue avant la mise en
 * page, ce qui permet de centrer, d'empiler et d'aligner sur la grille sans estimation.
 */
import type { Block, ProseBlock, ProseItem, ProseRun } from "../schemas/layout";
import type { MeasureFlow, MeasuredLines } from "./measure";
import type { EditorialLang } from "./typography";
import { parseInline } from "./typography";
import { FONT_DISPLAY } from "./fonts";
import { PT_TO_MM } from "./grid";

export interface TextSpec {
  font: string;
  sizePt: number;
  leadingMm: number;
  align: ProseBlock["align"];
  color: string;
  lang: EditorialLang;
  hyphenate?: boolean;
  italic?: boolean;
  weightNum?: number;
  letterSpacingEm?: number;
  uppercase?: boolean;
  indentEm?: number;
  /** Lignes équilibrées (titres, citations) */
  balance?: boolean;
}

export interface MeasuredText {
  items: ProseItem[];
  /** Lignes occupées, espaces compris */
  lines: number;
  heightMm: number;
  spec: TextSpec;
  widthMm: number;
}

function flowBlock(spec: TextSpec, widthMm: number): MeasureFlow["block"] {
  return {
    lang: spec.lang,
    fontFamily: spec.font,
    fontSizePt: spec.sizePt,
    leadingMm: spec.leadingMm,
    indentEm: spec.indentEm ?? 1,
    align: spec.align,
    hyphenate: spec.hyphenate ?? false,
    color: spec.color,
    w: widthMm,
    style: { italic: spec.italic, weightNum: spec.weightNum, letterSpacingEm: spec.letterSpacingEm, uppercase: spec.uppercase, balance: spec.balance },
  };
}

/**
 * Registre des mesures. Première passe (`results` absent) : enregistre les demandes et renvoie
 * une ligne par élément. Seconde passe : renvoie les lignes mesurées.
 */
export class TextBank {
  readonly requests = new Map<string, MeasureFlow>();
  constructor(private readonly results?: Map<string, MeasuredLines[]>) {}

  get final(): boolean {
    return Boolean(this.results);
  }

  flow(key: string, spec: TextSpec, widthMm: number, items: ProseItem[]): MeasuredLines[] {
    this.requests.set(key, { block: flowBlock(spec, widthMm), items });
    const r = this.results?.get(key);
    if (this.results && !r) throw new Error(`Mesure manquante : ${key}`);
    return r ?? items.map(() => ({ starts: [0], hyphen: [false], heightMm: 0 }));
  }

  /** Texte de gabarit : un ou plusieurs paragraphes (séparés par « \n »), mesurés. */
  text(key: string, spec: TextSpec, widthMm: number, content: string | ProseRun[] | ProseItem[], opts: { gapLines?: number } = {}): MeasuredText {
    const items: ProseItem[] = typeof content === "string"
      ? content.split("\n").filter((x) => x.trim()).map((para, k) => ({ kind: "p" as const, runs: parseInline(para, spec.lang), spaceBefore: k > 0 ? opts.gapLines : undefined }))
      : content.length > 0 && "kind" in content[0]
        ? (content as ProseItem[])
        : [{ kind: "p" as const, runs: content as ProseRun[] }];
    const measured = this.flow(key, spec, widthMm, items);
    const withLines = items.map((it, k) => ({ ...it, lines: Math.max(1, measured[k]?.starts.length ?? 1) }));
    const lines = withLines.reduce((s, it) => s + (it.lines ?? 0) + (it.spaceBefore ?? 0), 0);
    return { items: withLines, lines, heightMm: lines * spec.leadingMm, spec, widthMm };
  }
}

/** Identifiants de blocs déterministes (reproductibilité des compositions). */
export class Ids {
  private n = 0;
  constructor(private readonly prefix: string) {}
  next(kind = "b") {
    return `${this.prefix}_${kind}${this.n++}`;
  }
}

/** Bloc prose d'un texte mesuré, placé à (x, y). */
export function proseBlock(id: string, x: number, y: number, t: MeasuredText): Block {
  return {
    id,
    type: "prose",
    items: t.items,
    lang: t.spec.lang,
    fontFamily: t.spec.font,
    fontSizePt: t.spec.sizePt,
    leadingMm: t.spec.leadingMm,
    indentEm: t.spec.indentEm ?? 1,
    align: t.spec.align,
    hyphenate: t.spec.hyphenate ?? false,
    color: t.spec.color,
    x,
    y,
    w: t.widthMm,
    // Marge sous la dernière ligne : arrondis de Chromium, et jambages des grands corps de titrage
    // (interlignage serré) qui débordent de la boîte de ligne
    h: Math.max(1, t.heightMm + Math.max(0.6, t.spec.sizePt * PT_TO_MM * 0.3)),
    style: { italic: t.spec.italic, weightNum: t.spec.weightNum, letterSpacingEm: t.spec.letterSpacingEm, uppercase: t.spec.uppercase, balance: t.spec.balance },
    editable: false,
  };
}

export interface LineTextOpts {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  font: string;
  sizePt: number;
  color: string;
  align?: "left" | "center" | "right";
  role?: "title" | "subtitle" | "heading" | "body" | "caption" | "label" | "pageNumber";
  italic?: boolean;
  weightNum?: number;
  letterSpacingEm?: number;
  uppercase?: boolean;
  lineHeight?: number;
  valign?: "top" | "middle" | "bottom";
  features?: string;
  lang?: string;
  rotateDeg?: number;
}

/** Texte court d'une ligne (mention, folio, titre courant) : bloc texte classique. */
export function lineText(o: LineTextOpts): Block {
  return {
    id: o.id,
    type: "text",
    role: o.role ?? "label",
    text: o.text,
    x: o.x,
    y: o.y,
    w: o.w,
    h: o.h,
    editable: false,
    style: {
      fontFamily: o.font,
      fontSizePt: o.sizePt,
      color: o.color,
      align: o.align ?? "left",
      // Par défaut, la ligne occupe toute la hauteur du cadre : le texte y est centré comme une
      // ligne de prose, ce qui aligne folios, numéros et titres sur la même ligne de base
      lineHeight: o.lineHeight ?? Math.min(2.5, Math.max(0.8, Math.round((o.h / (o.sizePt * (25.4 / 72))) * 100) / 100)),
      italic: o.italic,
      // Caractère de titrage : graisse légère par défaut (Fraunces est dense à 400)
      weightNum: o.weightNum ?? (o.font === FONT_DISPLAY ? 300 : 400),
      letterSpacingEm: o.letterSpacingEm,
      uppercase: o.uppercase,
      valign: o.valign,
      features: o.features,
      lang: o.lang,
      rotateDeg: o.rotateDeg,
    },
  };
}

export function rule(o: { id: string; x: number; y: number; w: number; color: string; stroke?: number; vertical?: number; rotateDeg?: number; opacity?: number }): Block {
  const vertical = o.vertical !== undefined;
  return {
    id: o.id,
    type: "shape",
    shape: "rule",
    color: o.color,
    x: vertical ? o.x - 0.5 : o.x,
    y: vertical ? o.y : o.y - 0.5,
    w: vertical ? 1 : Math.max(1, o.w),
    h: vertical ? Math.max(1, o.vertical!) : 1,
    editable: false,
    style: { strokeMm: o.stroke ?? 0.25, rotateDeg: o.rotateDeg, opacity: o.opacity },
  };
}

export function rect(o: { id: string; x: number; y: number; w: number; h: number; color: string; border?: string; stroke?: number; radius?: number; opacity?: number; rotateDeg?: number }): Block {
  return {
    id: o.id,
    type: "shape",
    shape: "rect",
    color: o.color,
    x: o.x,
    y: o.y,
    w: Math.max(1, o.w),
    h: Math.max(1, o.h),
    editable: false,
    style: { borderColor: o.border, strokeMm: o.stroke, radius: o.radius, opacity: o.opacity, rotateDeg: o.rotateDeg },
  };
}

export function circle(o: { id: string; cx: number; cy: number; d: number; color: string; border?: string; stroke?: number }): Block {
  return { id: o.id, type: "shape", shape: "circle", color: o.color, x: o.cx - o.d / 2, y: o.cy - o.d / 2, w: Math.max(1, o.d), h: Math.max(1, o.d), editable: false, style: { borderColor: o.border, strokeMm: o.stroke } };
}

export function image(o: { id: string; x: number; y: number; w: number; h: number; src: string; alt: string }): Block {
  return { id: o.id, type: "image", role: "final", src: o.src, alt: o.alt, caption: "", isDemo: false, fit: "cover", x: o.x, y: o.y, w: o.w, h: o.h, editable: false, style: {} };
}
