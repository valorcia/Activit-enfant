/**
 * Rendu d'un bloc de texte composé (moteur éditorial UNWRITTEN).
 *
 * Ce composant est volontairement sans état ni effet : il est utilisé à l'identique
 *  - par PageRenderer (aperçu, éditeur, impression PDF) ;
 *  - par la mesure dans Chromium (src/lib/editorial/measure.ts), via react-dom/server.
 * Les coupures de lignes mesurées sont donc celles qui seront imprimées. Toutes les
 * propriétés qui influencent la composition sont posées explicitement ici (aucune
 * dépendance à la feuille de style globale), pour que la mesure et le rendu concordent.
 *
 * Écrit sans JSX (createElement) pour être importable tel quel par les scripts Node.
 */
import { createElement as h, type CSSProperties, type ReactElement } from "react";
import type { ProseBlock, ProseItem, ProseRun } from "@/lib/schemas/layout";

export interface ProseViewProps {
  block: Pick<ProseBlock, "items" | "lang" | "fontFamily" | "fontSizePt" | "leadingMm" | "indentEm" | "align" | "hyphenate" | "color"> & { style?: ProseBlock["style"] };
  /** Couleur des ornements (séparateurs de scène) */
  accent?: string;
  /** Mesure : hauteur libre, aucun masquage du débordement */
  measure?: boolean;
}

/** Réglages typographiques communs à tout texte composé. */
export function proseContainerStyle(b: ProseViewProps["block"], measure = false): CSSProperties {
  const st = b.style ?? {};
  return {
    fontFamily: `"${b.fontFamily}", Georgia, serif`,
    fontSize: `${b.fontSizePt}pt`,
    lineHeight: `${b.leadingMm}mm`,
    color: b.color,
    textAlign: b.align,
    hyphens: b.hyphenate ? "auto" : "manual",
    WebkitHyphens: b.hyphenate ? "auto" : "manual",
    // Pas de coupure avant 3 lettres ni de mot de moins de 6 lettres coupé
    ...({ hyphenateLimitChars: "6 3 3", WebkitHyphenateLimitChars: "6 3 3" } as CSSProperties),
    fontKerning: "normal",
    fontVariantLigatures: "common-ligatures",
    fontVariantNumeric: "oldstyle-nums proportional-nums",
    fontOpticalSizing: "auto",
    fontSynthesis: "small-caps",
    fontWeight: st.weightNum ?? 400,
    fontStyle: st.italic ? "italic" : "normal",
    letterSpacing: st.letterSpacingEm !== undefined ? `${st.letterSpacingEm}em` : "normal",
    wordSpacing: "normal",
    textTransform: st.uppercase ? "uppercase" : "none",
    textRendering: "optimizeLegibility",
    whiteSpace: "normal",
    ...(st.balance ? { textWrap: "balance" } : {}),
    overflowWrap: "break-word",
    wordBreak: "normal",
    boxSizing: "border-box",
    margin: 0,
    padding: 0,
    width: "100%",
    height: measure ? "auto" : "100%",
    overflow: measure ? "visible" : "hidden",
  };
}

function itemStyle(it: ProseItem, b: ProseViewProps["block"]): CSSProperties {
  const L = b.leadingMm;
  const st: CSSProperties = {
    margin: 0,
    padding: 0,
    marginTop: it.spaceBefore ? `${it.spaceBefore * L}mm` : 0,
    marginBottom: it.spaceAfter ? `${it.spaceAfter * L}mm` : 0,
    textIndent: it.kind === "p" && it.indent && !it.continued ? `${b.indentEm}em` : 0,
    textAlignLast: it.continues ? "justify" : "auto",
  };
  if (it.align) {
    st.textAlign = it.align;
    st.textAlignLast = it.align;
  }
  if (it.kind === "quote") {
    st.fontStyle = "italic";
    st.marginLeft = "2em";
    st.marginRight = "2em";
  } else if (it.kind === "subhead") {
    st.textAlign = "center";
    st.textAlignLast = "center";
    st.fontVariantCaps = "all-small-caps";
    st.letterSpacing = "0.12em";
    st.hyphens = "manual";
    st.WebkitHyphens = "manual";
  } else if (it.kind === "break") {
    st.textAlign = "center";
    st.textAlignLast = "center";
    st.height = `${2 * L}mm`;
    st.lineHeight = `${2 * L}mm`;
  }
  return st;
}

function runView(r: ProseRun, i: number): ReactElement | string {
  if (!r.i && !r.sc) return h("span", { key: i }, r.t);
  const st: CSSProperties = {};
  if (r.i) st.fontStyle = "italic";
  if (r.sc) {
    st.fontVariantCaps = "all-small-caps";
    st.letterSpacing = "0.07em";
  }
  return h("span", { key: i, style: st }, r.t);
}

/** Ornement de changement de scène : trois points champagne, centrés sur deux lignes. */
function ornament(accent: string): ReactElement {
  const dot: CSSProperties = { display: "inline-block", width: "1mm", height: "1mm", borderRadius: "50%", background: accent, margin: "0 1.6mm", verticalAlign: "middle" };
  return h("span", { "aria-hidden": true, style: { display: "inline-block", lineHeight: 0, verticalAlign: "middle" } }, h("span", { style: dot }), h("span", { style: dot }), h("span", { style: dot }));
}

export function ProseView({ block, accent = "#C5A77B", measure = false }: ProseViewProps): ReactElement {
  return h(
    "div",
    { lang: block.lang, "data-prose": "", "data-measure": "", style: proseContainerStyle(block, measure) },
    block.items.map((it, k) =>
      h(
        it.kind === "subhead" ? "h3" : "p",
        {
          key: k,
          "data-prose-item": k,
          "data-kind": it.kind,
          "data-lines": it.lines,
          "data-continued": it.continued ? "" : undefined,
          "data-continues": it.continues ? "" : undefined,
          style: { ...itemStyle(it, block), fontSize: "inherit", fontWeight: "inherit" },
        },
        it.kind === "break" ? ornament(accent) : it.runs.map(runView),
      ),
    ),
  );
}
