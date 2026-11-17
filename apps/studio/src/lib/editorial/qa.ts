/**
 * Contrôle qualité éditorial, exécuté sur le rendu Chromium réel (route d'impression ou rendu
 * autonome) : on relève dans la page ce que le lecteur verra, puis on l'analyse.
 *
 *  - `collectQaSnapshot` s'exécute dans le navigateur (sans dépendance) ;
 *  - `analyzeQa` est une fonction pure (testable sans navigateur) ;
 *  - `runEditorialQa` enchaîne les deux sur une page Playwright.
 *
 * Défauts relevés (sévérité « critical » bloquante, « warning » à revoir) :
 * pages vides ou presque vides, grands espaces involontaires, débordements, textes réduits
 * automatiquement, blocs hors page ou hors zone de sécurité, veuves et orphelines restantes,
 * divergence entre composition et rendu, pagination continue (folios, recto/verso, chapitres sur
 * page impaire), contraste WCAG du texte sur son fond, texte sur image, polices non chargées,
 * données de personnalisation absentes.
 */
import type { Page } from "playwright-core";
import { composite, contrastRatio, parseColor, requiredContrast, type Rgba } from "./palette";

export type QaSeverity = "critical" | "warning";

export interface QaDefect {
  code: string;
  severity: QaSeverity;
  /** Index de la page dans le document (0 = couverture) */
  pageIndex?: number;
  folio?: number;
  /** Gabarit de la page (moteur éditorial) */
  template?: string;
  blockId?: string;
  message: string;
}

export interface QaReport {
  ok: boolean;
  pages: number;
  critical: number;
  warnings: number;
  defects: QaDefect[];
  /** Pages où chaque donnée de personnalisation a été trouvée */
  personalization: { text: string; pages: number[] }[];
}

export interface QaOptions {
  /** Chaînes de personnalisation à retrouver (prénoms, lieux, dates…) */
  expect?: string[];
  /** Mode impression : chapitres sur page impaire, nombre pair de pages intérieures */
  mode?: "print" | "digital";
  /** Part minimale de la hauteur utile occupée par une page non aérée */
  minFill?: number;
  /** Plus grand espace vertical vide admis (part de la hauteur utile) */
  maxGap?: number;
}

type Box = { x: number; y: number; w: number; h: number };

export interface QaBlock {
  id: string;
  type: string;
  rect: Box;
  /** Étendue réelle du texte (encre), en mm, relative à la page */
  ink?: Box;
  text: string;
  color?: string;
  ownBackground?: string;
  /** Couleur de fond d'une forme ou d'une image */
  fill?: string;
  border?: boolean;
  opacity: number;
  fontSizePt?: number;
  fontWeight?: number;
  fontFamily?: string;
  fontLoaded?: boolean;
  overflowPx: number;
  autofitScale?: number;
  hasImage?: boolean;
  role?: string;
  prose?: { kind: string; expected?: number; actual: number; continued: boolean; continues: boolean }[];
}

export interface QaPage {
  index: number;
  template?: string;
  folio?: number;
  side?: string;
  blank: boolean;
  sparse: boolean;
  chapterEnd: boolean;
  safe?: [number, number, number, number];
  widthMm: number;
  heightMm: number;
  background: string;
  blocks: QaBlock[];
}

export interface QaSnapshot {
  pages: QaPage[];
  fontErrors: string[];
}

// ---------------------------------------------------------------------------
// Collecte (navigateur)
// ---------------------------------------------------------------------------

/** À exécuter dans la page (page.evaluate). Autonome : n'utilise aucun import. */
export function collectQaSnapshot(): QaSnapshot {
  const pxPerMm = 96 / 25.4;
  const pages: QaPage[] = [];
  const firstFamily = (ff: string) => ff.split(",")[0].trim().replace(/^["']|["']$/g, "");
  const transparent = (c: string) => !c || c === "transparent" || /rgba\([^)]*,\s*0\)$/.test(c);
  document.querySelectorAll<HTMLElement>("[data-page-index]").forEach((pg) => {
    const pr = pg.getBoundingClientRect();
    const rel = (r: DOMRect | { left: number; top: number; width: number; height: number }) => ({ x: (r.left - pr.left) / pxPerMm, y: (r.top - pr.top) / pxPerMm, w: r.width / pxPerMm, h: r.height / pxPerMm });
    const safeAttr = pg.dataset.edSafe?.split(" ").map(Number);
    const blocks: QaBlock[] = [];
    pg.querySelectorAll<HTMLElement>(":scope > [data-block-id]").forEach((el) => {
      const type = el.dataset.blockType ?? "text";
      const inner = el.querySelector<HTMLElement>("[data-measure]") ?? el;
      const cs = getComputedStyle(inner);
      const wcs = getComputedStyle(el);
      const b: QaBlock = { id: el.dataset.blockId!, type, rect: rel(el.getBoundingClientRect()), text: "", opacity: parseFloat(wcs.opacity) || 1, overflowPx: 0 };
      if (type === "shape") {
        b.fill = transparent(wcs.backgroundColor) ? undefined : wcs.backgroundColor;
        const line = el.firstElementChild as HTMLElement | null;
        if (line) b.fill = getComputedStyle(line).backgroundColor;
        b.border = parseFloat(wcs.borderTopWidth) > 0 && !transparent(wcs.borderTopColor);
      } else if (type === "image") {
        b.hasImage = Boolean(el.querySelector("img"));
        b.fill = cs.backgroundColor;
      } else {
        b.text = (inner.textContent ?? "").trim();
        b.color = cs.color;
        // Fond propre au bloc : premier fond opaque entre le texte et le cadre du bloc
        for (let n: HTMLElement | null = inner; n && n !== pg; n = n.parentElement) {
          const bg = getComputedStyle(n).backgroundColor;
          if (!transparent(bg)) {
            b.ownBackground = bg;
            break;
          }
          if (n === el) break;
        }
        b.fontSizePt = parseFloat(cs.fontSize) * 0.75;
        b.fontWeight = parseInt(cs.fontWeight, 10) || 400;
        b.fontFamily = firstFamily(cs.fontFamily);
        b.fontLoaded = document.fonts.check(`${cs.fontStyle === "italic" ? "italic " : ""}${b.fontWeight} 12px "${b.fontFamily}"`);
        b.overflowPx = Math.max(0, inner.scrollHeight - el.clientHeight);
        if (inner.dataset.autofitScale) b.autofitScale = parseFloat(inner.dataset.autofitScale);
        if (b.text) {
          // Encre réelle : rectangles des seuls nœuds texte (pas les boîtes des paragraphes)
          const rects: DOMRect[] = [];
          const walker = document.createTreeWalker(inner, NodeFilter.SHOW_TEXT);
          for (let n = walker.nextNode(); n; n = walker.nextNode()) {
            if (!(n as Text).data.trim()) continue;
            const range = document.createRange();
            range.selectNodeContents(n);
            for (const r of Array.from(range.getClientRects())) if (r.width > 0 && r.height > 0) rects.push(r);
          }
          if (rects.length) {
            const l = Math.min(...rects.map((r) => r.left));
            const t = Math.min(...rects.map((r) => r.top));
            const r = Math.max(...rects.map((r) => r.right));
            const bt = Math.max(...rects.map((r) => r.bottom));
            b.ink = rel({ left: l, top: t, width: r - l, height: bt - t });
          }
        }
        if (type === "prose") {
          const lead = parseFloat(cs.lineHeight) || 16;
          b.prose = Array.from(inner.querySelectorAll<HTMLElement>("[data-prose-item]")).map((it) => {
            const range = document.createRange();
            range.selectNodeContents(it);
            const tops: number[] = [];
            Array.from(range.getClientRects())
              .filter((r) => r.width > 0)
              .forEach((r) => {
                if (!tops.some((t) => Math.abs(t - r.top) < lead / 2)) tops.push(r.top);
              });
            return { kind: it.dataset.kind ?? "p", expected: it.dataset.lines ? Number(it.dataset.lines) : undefined, actual: tops.length, continued: it.hasAttribute("data-continued"), continues: it.hasAttribute("data-continues") };
          });
        }
      }
      blocks.push(b);
    });
    // Blocs textes « numéro de page » : rôle porté par le bloc (attribut absent) — repéré par le contenu
    pages.push({
      index: Number(pg.dataset.pageIndex),
      template: pg.dataset.edTemplate,
      folio: pg.dataset.edFolio !== undefined ? Number(pg.dataset.edFolio) : undefined,
      side: pg.dataset.edSide,
      blank: pg.hasAttribute("data-ed-blank"),
      sparse: pg.hasAttribute("data-ed-sparse"),
      chapterEnd: pg.hasAttribute("data-ed-chapter-end"),
      safe: safeAttr && safeAttr.length === 4 ? (safeAttr as [number, number, number, number]) : undefined,
      widthMm: pr.width / pxPerMm,
      heightMm: pr.height / pxPerMm,
      background: getComputedStyle(pg).backgroundColor,
      blocks,
    });
  });
  const fontErrors: string[] = [];
  document.fonts.forEach((f) => {
    if (f.status === "error") fontErrors.push(`${f.family} ${f.style} ${f.weight}`);
  });
  return { pages, fontErrors };
}

// ---------------------------------------------------------------------------
// Analyse (pure)
// ---------------------------------------------------------------------------

const TEXT_TYPES = new Set(["text", "prose", "list", "toc", "step", "badges"]);

function center(b: Box) {
  return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
}
function contains(b: Box, p: { x: number; y: number }) {
  return p.x >= b.x - 0.01 && p.x <= b.x + b.w + 0.01 && p.y >= b.y - 0.01 && p.y <= b.y + b.h + 0.01;
}

/** Fond effectif sous un texte : fond propre, sinon forme ou image sous-jacente, sinon la page. */
function effectiveBackground(page: QaPage, k: number): { color: Rgba | null; overImage: boolean } {
  const b = page.blocks[k];
  const pageBg = parseColor(page.background) ?? { r: 255, g: 255, b: 255, a: 1 };
  let bg: Rgba = pageBg.a < 1 ? composite(pageBg, { r: 255, g: 255, b: 255, a: 1 }) : pageBg;
  const at = center(b.ink ?? b.rect);
  let overImage = false;
  for (let j = 0; j < k; j++) {
    const u = page.blocks[j];
    if (!contains(u.rect, at)) continue;
    if (u.type === "image" && u.hasImage) {
      overImage = true;
      continue;
    }
    if (u.type === "shape" && u.fill && u.rect.h > 1.5 && u.rect.w > 1.5) {
      const f = parseColor(u.fill);
      if (f && f.a > 0) {
        bg = composite({ ...f, a: f.a * u.opacity }, bg);
        overImage = false;
      }
    }
  }
  const own = parseColor(b.ownBackground);
  if (own && own.a > 0) bg = composite(own, bg);
  return { color: bg, overImage };
}

export function analyzeQa(snap: QaSnapshot, opts: QaOptions = {}): QaReport {
  const defects: QaDefect[] = [];
  const minFill = opts.minFill ?? 0.25;
  const maxGap = opts.maxGap ?? 0.38;
  const add = (d: QaDefect) => defects.push(d);

  for (const f of snap.fontErrors) add({ code: "FONT_ERROR", severity: "critical", message: `Police non chargée : ${f}` });

  for (const page of snap.pages) {
    const at = { pageIndex: page.index, folio: page.folio, template: page.template };
    const visible = page.blocks.filter((b) => (TEXT_TYPES.has(b.type) && b.text) || (b.type === "image") || (b.type === "shape" && (b.fill || b.border)));
    // --- Pages vides
    if (visible.length === 0 && !page.blank) add({ ...at, code: "EMPTY_PAGE", severity: "critical", message: "Page vide non prévue" });

    // --- Débordements, réduction automatique, hors page, hors zone de sécurité, polices, contraste
    const safe = page.safe ?? (page.template === "cover" || page.template === "back_cover" ? [8, 8, 8, 8] : undefined);
    page.blocks.forEach((b, k) => {
      const where = { ...at, blockId: b.id };
      const r = b.rect;
      if (r.x < -0.6 || r.y < -0.6 || r.x + r.w > page.widthMm + 0.6 || r.y + r.h > page.heightMm + 0.6) add({ ...where, code: "OUT_OF_PAGE", severity: "critical", message: `Bloc hors de la page (${r.x.toFixed(1)}, ${r.y.toFixed(1)}, ${r.w.toFixed(1)} × ${r.h.toFixed(1)} mm)` });
      if (!TEXT_TYPES.has(b.type) || !b.text) return;
      if (b.overflowPx > 1) add({ ...where, code: "OVERFLOW", severity: "critical", message: `Texte qui déborde de son cadre (${(b.overflowPx / (96 / 25.4)).toFixed(1)} mm) : « ${b.text.slice(0, 40)}… »` });
      if (b.autofitScale !== undefined && b.autofitScale < 1) add({ ...where, code: "AUTOFIT", severity: "warning", message: `Texte réduit automatiquement à ${Math.round(b.autofitScale * 100)} % pour tenir dans son cadre` });
      if (b.fontLoaded === false) add({ ...where, code: "FONT_FALLBACK", severity: "critical", message: `Police « ${b.fontFamily} » non chargée : rendu avec une police de remplacement` });
      if (safe && b.ink) {
        // Horizontalement : dans la colonne de texte ; verticalement : titres courants et folios
        // vivent dans les marges, mais jamais à moins de 6 mm de la coupe
        const [, ri, , l] = safe;
        const tol = 0.8;
        if (b.ink.x < l - tol || b.ink.x + b.ink.w > page.widthMm - ri + tol || b.ink.y < 6 || b.ink.y + b.ink.h > page.heightMm - 6) add({ ...where, code: "OUTSIDE_SAFE", severity: "warning", message: "Texte hors de la zone de sécurité (marges)" });
      }
      // Contraste
      const { color: bg, overImage } = effectiveBackground(page, k);
      const fg0 = parseColor(b.color);
      if (overImage) add({ ...where, code: "TEXT_ON_IMAGE", severity: "warning", message: "Texte posé sur une image : contraste à vérifier visuellement" });
      else if (fg0 && bg) {
        const fg = b.opacity < 1 ? composite({ ...fg0, a: fg0.a * b.opacity }, bg) : fg0;
        const ratio = contrastRatio(fg, bg);
        const need = requiredContrast(b.fontSizePt ?? 10, b.fontWeight ?? 400);
        if (ratio + 1e-6 < need) add({ ...where, code: "CONTRAST", severity: "critical", message: `Contraste insuffisant ${ratio.toFixed(2)}:1 (minimum ${need}:1, WCAG AA) : « ${b.text.slice(0, 30)} »` });
      }
      // Veuves, orphelines, divergence de composition
      for (const it of b.prose ?? []) {
        if (it.kind === "break") continue;
        if (it.expected !== undefined && it.expected !== it.actual) add({ ...where, code: "LINES_MISMATCH", severity: "critical", message: `Composition divergente : ${it.actual} ligne(s) rendue(s) pour ${it.expected} mesurée(s)` });
        if (it.continued && it.actual < 2) add({ ...where, code: "WIDOW", severity: "critical", message: "Veuve : ligne isolée en haut de page" });
        if (it.continues && it.actual < 2) add({ ...where, code: "ORPHAN", severity: "critical", message: "Orpheline : ligne isolée en bas de page" });
      }
    });

    // --- Remplissage et grands espaces (pages non aérées par nature)
    if (!page.blank && !page.sparse && visible.length > 0) {
      const [t, , bo] = page.safe ?? [0, 0, 0, 0];
      const top = t;
      const bottom = page.heightMm - bo;
      const height = Math.max(1, bottom - top);
      const spans = visible
        // Une ligne d'écriture (filet) occupe l'interligne au-dessus d'elle : espace à remplir, pas un vide
        .map((b) => (TEXT_TYPES.has(b.type) ? b.ink : b.type === "shape" && b.rect.h <= 1.5 && b.rect.w > 20 ? { ...b.rect, y: b.rect.y - 11, h: b.rect.h + 11 } : b.rect))
        .filter((x): x is Box => Boolean(x))
        .map((x) => [Math.max(top, x.y), Math.min(bottom, x.y + x.h)] as [number, number])
        .filter(([a, z]) => z > a)
        .sort((p, q) => p[0] - q[0]);
      let covered = 0;
      let gap = 0;
      let cursor = top;
      for (const [a, z] of spans) {
        if (a > cursor) gap = Math.max(gap, a - cursor);
        if (z > cursor) {
          covered += z - Math.max(a, cursor);
          cursor = z;
        }
      }
      if (!page.chapterEnd) gap = Math.max(gap, bottom - cursor);
      const fill = covered / height;
      if (page.chapterEnd) {
        const lines = page.blocks.flatMap((b) => b.prose ?? []).reduce((s, it) => s + it.actual, 0);
        if (lines > 0 && lines < 3 && page.template === "text") add({ ...at, code: "SHORT_CHAPTER_END", severity: "warning", message: `Fin de chapitre de ${lines} ligne(s) seulement sur sa page` });
      } else if (fill < minFill) add({ ...at, code: "NEAR_EMPTY", severity: "warning", message: `Page presque vide : ${Math.round(fill * 100)} % de la hauteur utile occupée` });
      if (gap / height > maxGap) add({ ...at, code: "LARGE_GAP", severity: "warning", message: `Grand espace vide involontaire : ${Math.round(gap)} mm (${Math.round((gap / height) * 100)} % de la hauteur utile)` });
    }
  }

  // --- Pagination continue
  const interior = snap.pages.filter((p) => p.folio !== undefined);
  if (interior.length > 0) {
    interior.forEach((p, k) => {
      if (k > 0 && p.folio !== interior[k - 1].folio! + 1) add({ pageIndex: p.index, folio: p.folio, code: "FOLIO_SEQUENCE", severity: "critical", message: `Pagination discontinue : page ${p.folio} après la page ${interior[k - 1].folio}` });
      const expectedSide = p.folio! % 2 === 1 ? "recto" : "verso";
      if (p.side && p.side !== expectedSide) add({ pageIndex: p.index, folio: p.folio, code: "FOLIO_SIDE", severity: "critical", message: `Page ${p.folio} composée en ${p.side} au lieu de ${expectedSide}` });
      const shown = p.blocks.find((b) => b.type === "text" && /^\d+$/.test(b.text) && b.rect.y > p.heightMm * 0.85);
      if (shown && Number(shown.text) !== p.folio) add({ pageIndex: p.index, folio: p.folio, code: "FOLIO_TEXT", severity: "critical", message: `Folio imprimé ${shown.text} au lieu de ${p.folio}` });
      if (opts.mode === "print" && (p.template === "chapter_opening" || p.template === "conclusion") && p.folio! % 2 === 0) add({ pageIndex: p.index, folio: p.folio, code: "CHAPTER_VERSO", severity: "critical", message: "Ouverture de chapitre sur une page paire (verso) en mode impression" });
    });
    if (interior[0].folio !== 1) add({ pageIndex: interior[0].index, folio: interior[0].folio, code: "FOLIO_START", severity: "warning", message: `La pagination commence à ${interior[0].folio}` });
    if (opts.mode === "print" && interior.length % 2 === 1) add({ code: "ODD_PAGE_COUNT", severity: "warning", message: `Nombre impair de pages intérieures (${interior.length}) pour l'impression` });
  }

  // --- Personnalisation
  const norm = (s: string) =>
    s
      .normalize("NFKC")
      .replace(/[   ]/g, " ")
      .replace(/[‘’]/g, "'")
      .replace(/[“”«»]/g, '"')
      .replace(/\s+/g, " ")
      .toLowerCase();
  const pageTexts = snap.pages.map((p) => norm(p.blocks.map((b) => b.text).join(" ")));
  const all = norm(snap.pages.map((p) => p.blocks.map((b) => b.text).join(" ")).join(" ").replace(/‐\s*/g, ""));
  const personalization = (opts.expect ?? []).map((text) => {
    const n = norm(text);
    const pages = snap.pages.filter((_, k) => pageTexts[k].replace(/‐\s*/g, "").includes(n)).map((p) => p.index);
    if (!all.includes(n)) add({ code: "PERSONALIZATION_MISSING", severity: "critical", message: `Donnée de personnalisation absente du livre : « ${text} »` });
    return { text, pages };
  });

  const critical = defects.filter((d) => d.severity === "critical").length;
  return { ok: critical === 0, pages: snap.pages.length, critical, warnings: defects.length - critical, defects, personalization };
}

/** Contrôle qualité d'une page Playwright déjà chargée (polices et images prêtes). */
export async function runEditorialQa(page: Page, opts: QaOptions = {}): Promise<QaReport> {
  await page.evaluate(() => document.fonts.ready);
  // Les transpileurs (tsx, esbuild) peuvent insérer un utilitaire __name dans les fonctions sérialisées
  await page.evaluate("window.__name = window.__name || ((f) => f)");
  const snap = await page.evaluate(collectQaSnapshot);
  return analyzeQa(snap, opts);
}
