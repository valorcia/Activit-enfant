/**
 * Grilles de composition par format (marges intérieures et extérieures, colonne de texte,
 * ligne de base, échelle typographique). Valeurs justifiées dans
 * docs/unwritten/DESIGN_SYSTEM_UNWRITTEN.md § 5.
 *
 * Toutes les mesures sont en millimètres, les corps en points (1 pt = 0,3528 mm).
 * La hauteur de la colonne de texte est un multiple exact de l'interligne : chaque page
 * pleine contient `lines` lignes, alignées sur la même ligne de base de page en page.
 */

export const PT_TO_MM = 25.4 / 72;

export type EditorialFormatKey = "A5" | "A4" | "SQUARE" | "PORTRAIT_3_4";

export interface EditorialGrid {
  key: EditorialFormatKey;
  /** Clé de PAGE_FORMATS (src/lib/schemas/activity.ts) */
  pageFormat: string;
  label: string;
  widthMm: number;
  heightMm: number;
  top: number;
  inner: number;
  outer: number;
  /** Corps du texte courant (pt) */
  bodyPt: number;
  /** Interligne = pas de la ligne de base (mm) */
  leadingMm: number;
  /** Lignes d'une page pleine */
  lines: number;
  /** Colonnes de la grille de mise en page (illustrations, activités) */
  columns: number;
  gutterMm: number;
  /** Lignes laissées en tête des pages d'ouverture de chapitre (« descente ») */
  chapterSink: number;
}

function grid(g: Omit<EditorialGrid, never>): EditorialGrid {
  return g;
}

export const EDITORIAL_GRIDS: Record<EditorialFormatKey, EditorialGrid> = {
  A5: grid({ key: "A5", pageFormat: "A5_PORTRAIT", label: "A5 portrait", widthMm: 148, heightMm: 210, top: 18, inner: 19, outer: 16, bodyPt: 10.25, leadingMm: 4.8, lines: 35, columns: 6, gutterMm: 4, chapterSink: 13 }),
  A4: grid({ key: "A4", pageFormat: "A4_PORTRAIT", label: "A4 portrait", widthMm: 210, heightMm: 297, top: 26, inner: 28, outer: 40, bodyPt: 12, leadingMm: 5.9, lines: 40, columns: 6, gutterMm: 5, chapterSink: 13 }),
  SQUARE: grid({ key: "SQUARE", pageFormat: "SQUARE", label: "Carré 210 mm", widthMm: 210, heightMm: 210, top: 24, inner: 27, outer: 38, bodyPt: 12, leadingMm: 5.8, lines: 27, columns: 6, gutterMm: 5, chapterSink: 10 }),
  PORTRAIT_3_4: grid({ key: "PORTRAIT_3_4", pageFormat: "PORTRAIT_3_4", label: "Portrait 3:4", widthMm: 180, heightMm: 240, top: 21, inner: 22, outer: 27, bodyPt: 11, leadingMm: 5.3, lines: 36, columns: 6, gutterMm: 4.5, chapterSink: 12 }),
};

export function gridFor(key: EditorialFormatKey): EditorialGrid {
  return EDITORIAL_GRIDS[key];
}

export const textWidth = (g: EditorialGrid) => g.widthMm - g.inner - g.outer;
export const textHeight = (g: EditorialGrid) => g.lines * g.leadingMm;
export const bottomMargin = (g: EditorialGrid) => g.heightMm - g.top - textHeight(g);

/** Bord gauche de la colonne de texte selon la page (recto : petit fond à gauche). */
export function textLeft(g: EditorialGrid, side: "recto" | "verso"): number {
  return side === "recto" ? g.inner : g.outer;
}

/** Zone de sécurité (marges) d'une page. */
export function safeArea(g: EditorialGrid, side: "recto" | "verso") {
  return side === "recto" ? { top: g.top, right: g.outer, bottom: bottomMargin(g), left: g.inner } : { top: g.top, right: g.inner, bottom: bottomMargin(g), left: g.outer };
}

/** Largeur d'un empan de `n` colonnes de la grille. */
export function columnSpan(g: EditorialGrid, n: number): number {
  const col = (textWidth(g) - (g.columns - 1) * g.gutterMm) / g.columns;
  return n * col + (n - 1) * g.gutterMm;
}

/**
 * Échelle typographique (quarte juste, rapport 4:3), arrondie au quart de point.
 * Toutes les tailles dérivent du corps du texte courant.
 */
export function typeScale(g: EditorialGrid) {
  const q = (x: number) => Math.round(x * 4) / 4;
  const b = g.bodyPt;
  return {
    micro: q(b * 0.68), // titres courants, mentions en capitales espacées
    caption: q(b * 0.82), // folios, légendes, colophon
    body: b,
    lead: q(b * 1.2), // épigraphes, dédicace, chapeaux
    h3: q(b * 1.333), // intertitres de gabarit
    h2: q(b * 2.37), // titres de chapitre
    h1: q(b * 3.16), // page de titre
    display: q(b * 4.21), // couvertures
  };
}

export type TypeScale = ReturnType<typeof typeScale>;
