/**
 * Gabarits de pages des kits (chasse au trésor, lutins farceurs). Ils produisent les
 * mêmes blocs positionnés en mm que le moteur des livres d'activités : l'aperçu,
 * l'éditeur et l'export PDF fonctionnent sans changement.
 *
 * Style « moderne » : pages blanches aérées, en-tête (étiquette de rubrique, grand
 * titre, trait de couleur), cartes arrondies teintées dans les couleurs de l'univers,
 * pastilles numérotées, lignes de découpe en pointillés gris clair.
 */
import type { Block, PageLayout } from "../schemas/layout";
import type { BuildContext, BuiltPage } from "../layout/engine";
import { listHeight } from "../layout/engine";
import { newId } from "../utils";
import type { PranksKit, QuickStart, TreasureHunt } from "./schemas";

export interface KitImage {
  src?: string;
  isDemo: boolean;
  illustrationId?: string;
}
export type KitImages = Record<string, KitImage | undefined>;

type TextRole = "title" | "subtitle" | "heading" | "body" | "caption" | "label";

function page(ctx: BuildContext, templateKey: string, background = "#ffffff"): BuiltPage {
  const layout: PageLayout = { widthMm: ctx.widthMm, heightMm: ctx.heightMm, showPageNumber: true, background, blocks: [] };
  return { templateKey, layout };
}

function text(o: { text: string; x: number; y: number; w: number; h: number; role?: TextRole; pt?: number; align?: "left" | "center" | "right" | "justify"; weight?: "normal" | "bold"; color?: string; background?: string; padding?: number; radius?: number; border?: string; lineHeight?: number; font?: string }): Block {
  return {
    id: newId("t"), type: "text", role: o.role ?? "body", text: o.text, x: o.x, y: o.y, w: o.w, h: o.h, editable: true,
    style: { fontSizePt: o.pt, align: o.align, weight: o.weight, color: o.color, background: o.background, padding: o.padding, radius: o.radius, borderColor: o.border, lineHeight: o.lineHeight, fontFamily: o.font },
  };
}

function shape(o: { x: number; y: number; w: number; h: number; color: string; shape?: "rect" | "band" | "circle"; radius?: number; border?: string; dashed?: boolean }): Block {
  return { id: newId("s"), type: "shape", shape: o.shape ?? "rect", color: o.color, x: o.x, y: o.y, w: o.w, h: o.h, editable: true, style: { radius: o.radius, borderColor: o.border, borderStyle: o.dashed ? "dashed" : undefined } };
}

function image(o: { x: number; y: number; w: number; h: number; img?: KitImage; alt: string; fit?: "contain" | "cover"; radius?: number }): Block {
  return { id: newId("i"), type: "image", role: "decoration", illustrationId: o.img?.illustrationId, src: o.img?.src, alt: o.alt, caption: "", isDemo: o.img?.isDemo ?? false, fit: o.fit ?? "cover", x: o.x, y: o.y, w: o.w, h: o.h, editable: true, style: { radius: o.radius } };
}

function list(o: { items: string[]; title?: string; x: number; y: number; w: number; h: number; pt?: number; background?: string; padding?: number; radius?: number }): Block {
  return { id: newId("l"), type: "list", role: "bullets", items: o.items, title: o.title, x: o.x, y: o.y, w: o.w, h: o.h, editable: true, style: { fontSizePt: o.pt, background: o.background, padding: o.padding, radius: o.radius } };
}

// ---------------------------------------------------------------------------
// Système visuel
// ---------------------------------------------------------------------------

const INK = "#1F2937";
const MUTED = "#64748B";
const CUT = "#CBD5E1";

/** Couleur du thème avec transparence (aplats doux), ex. tint("#1e3a8a", 0.08). */
export function tint(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.slice(0, 6);
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return hex;
  return `#${full}${Math.round(Math.max(0, Math.min(1, alpha)) * 255).toString(16).padStart(2, "0")}`;
}

function palette(ctx: BuildContext) {
  const t = ctx.theme;
  return { primary: t.colorPrimary, accent: t.colorSecondary, soft: tint(t.colorPrimary, 0.06), softer: tint(t.colorPrimary, 0.035), accentSoft: tint(t.colorSecondary, 0.12) };
}

/** En-tête de page : étiquette de rubrique, grand titre, trait de couleur. Renvoie le y de départ du contenu. */
function header(ctx: BuildContext, p: BuiltPage, o: { eyebrow: string; title?: string; note?: string; align?: "left" | "center" }): number {
  const c = palette(ctx);
  const m = ctx.theme.marginMm;
  const w = ctx.widthMm - 2 * m;
  const align = o.align ?? "left";
  let y = m - 2;
  p.layout.blocks.push(text({ text: o.eyebrow.toUpperCase(), x: m, y, w, h: 6, pt: 8.5, weight: "bold", color: c.accent, align, role: "label" }));
  y += 6.5;
  if (o.title) {
    const long = o.title.length > 34;
    p.layout.blocks.push(text({ text: o.title, x: m, y, w, h: long ? 20 : 12, pt: long ? 19 : 24, weight: "bold", color: INK, align, role: "title", lineHeight: 1.1 }));
    y += long ? 21 : 13;
  }
  p.layout.blocks.push(shape({ x: align === "center" ? m + w / 2 - 9 : m, y: y + 0.5, w: 18, h: 1.6, color: c.accent, radius: 1 }));
  y += 5;
  if (o.note) {
    p.layout.blocks.push(text({ text: o.note, x: m, y, w, h: 6, pt: 9.5, color: MUTED, align }));
    y += 8;
  }
  return y + 2;
}

/** Pastille numérotée (cercle plein couleur d'accent). */
function badge(ctx: BuildContext, p: BuiltPage, n: number | string, x: number, y: number, size = 13) {
  p.layout.blocks.push(shape({ x, y, w: size, h: size, color: ctx.theme.colorSecondary, shape: "circle" }));
  const pt = size * 1.05;
  const lineMm = pt * 0.3528 * 1.15;
  p.layout.blocks.push(text({ text: String(n), x, y: y + (size - lineMm) / 2 - 0.3, w: size, h: Math.max(1, lineMm + 0.6), pt, align: "center", weight: "bold", color: "#ffffff", lineHeight: 1.15 }));
}

/** Grille de cartes sur 2 colonnes sous l'en-tête. */
function grid(ctx: BuildContext, rows: number, top: number) {
  const m = ctx.theme.marginMm;
  const gap = 6;
  const w = (ctx.widthMm - 2 * m - gap) / 2;
  const h = (ctx.heightMm - top - m - 8 - gap * (rows - 1)) / rows;
  return Array.from({ length: rows * 2 }, (_, i) => ({ x: m + (i % 2) * (w + gap), y: top + Math.floor(i / 2) * (h + gap), w, h }));
}

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

/**
 * « Comment ça marche ? » : première page intérieure, lisible en une minute.
 * Âge et durée en pastilles, 3 étapes numérotées en gros, matériel à cocher, une astuce.
 */
export function buildQuickStartPage(ctx: BuildContext, q: NonNullable<QuickStart>, img?: KitImage): BuiltPage | null {
  const steps = (q.etapes ?? []).filter(Boolean).slice(0, 4);
  const materials = (q.materiel ?? []).filter(Boolean).slice(0, 8);
  if (steps.length < 2 && !materials.length) return null;
  const c = palette(ctx);
  const p = page(ctx, "kit_quickstart");
  const m = ctx.theme.marginMm;
  const w = ctx.widthMm - 2 * m;
  let y = header(ctx, p, { eyebrow: "Avant de commencer", title: q.titre || "Comment ça marche ?", note: q.accroche || undefined });
  const pills = [q.age ? `${q.age}` : "", q.duree ? `${q.duree}` : ""].filter(Boolean);
  if (pills.length) {
    let x = m;
    for (const t of pills) {
      const pw = Math.max(26, t.length * 2.4 + 12);
      p.layout.blocks.push(text({ text: t, x, y, w: pw, h: 8.5, pt: 10.5, align: "center", weight: "bold", background: c.accentSoft, padding: 1.5, radius: 4.25, color: INK }));
      x += pw + 4;
    }
    y += 14;
  }
  if (steps.length) {
    const stepH = steps.length > 3 ? 22 : 25;
    steps.forEach((st, i) => {
      p.layout.blocks.push(shape({ x: m, y, w, h: stepH - 4, color: c.soft, radius: 6 }));
      badge(ctx, p, i + 1, m + 5, y + (stepH - 4) / 2 - 7, 14);
      p.layout.blocks.push(text({ text: st, x: m + 25, y: y + (st.length > 60 ? 3 : 6.5), w: w - 30, h: stepH - 10, pt: 14.5, lineHeight: 1.35, color: INK }));
      y += stepH;
    });
    y += 4;
  }
  if (materials.length) {
    const twoCols = materials.every((it) => it.length <= 30);
    const colW = twoCols ? (w - 16) / 2 : w - 12;
    const perLine = twoCols ? 30 : 66;
    const cols = twoCols ? [materials.slice(0, Math.ceil(materials.length / 2)), materials.slice(Math.ceil(materials.length / 2))] : [materials];
    const lines = (col: string[]) => col.reduce((n, it) => n + Math.max(1, Math.ceil((it.length + 3) / perLine)), 0);
    const h = Math.max(...cols.map(lines)) * 8.4 + 4;
    p.layout.blocks.push(shape({ x: m, y, w, h: h + 18, color: "#ffffff", radius: 6, border: tint(ctx.theme.colorPrimary, 0.18) }));
    p.layout.blocks.push(text({ text: "Ce qu'il faut", x: m + 6, y: y + 4, w: w - 12, h: 8, pt: 13, weight: "bold", color: c.primary, role: "heading" }));
    cols.forEach((col, ci) => {
      if (col.length) p.layout.blocks.push(text({ text: col.map((it) => `☐  ${it}`).join("\n"), x: m + 6 + ci * (colW + 4), y: y + 13, w: colW, h, pt: 13, lineHeight: 1.6, color: INK }));
    });
    y += h + 24;
  }
  if (q.astuce && y < ctx.heightMm - m - 28) {
    p.layout.blocks.push(shape({ x: m, y, w, h: 16, color: c.accentSoft, radius: 6 }));
    p.layout.blocks.push(shape({ x: m, y, w: 2.2, h: 16, color: c.accent, radius: 1 }));
    p.layout.blocks.push(text({ text: `Bon à savoir : ${q.astuce}`, x: m + 7, y: y + 3.5, w: w - 12, h: 10, pt: 12, weight: "bold", color: INK }));
    y += 22;
  }
  // Place restante : le personnage du kit, pour une page accueillante plutôt qu'un grand vide
  const room = ctx.heightMm - m - 10 - y;
  if (img?.src && room > 55) {
    const ih = Math.min(room, 95);
    const iw = Math.min(w, ih * 1.5);
    p.layout.blocks.push(image({ x: m + (w - iw) / 2, y: y + (room - ih) / 2, w: iw, h: ih, img, alt: "Les personnages du kit", fit: "contain", radius: 6 }));
  }
  return p;
}

/** Lettre pleine page (lettre de la Capitaine, lettre d'arrivée du lutin…). */
export function buildLetterPage(ctx: BuildContext, o: { title: string; body: string; signature?: string; img?: KitImage; templateKey?: string }): BuiltPage {
  const c = palette(ctx);
  const p = page(ctx, o.templateKey ?? "kit_letter");
  const m = ctx.theme.marginMm;
  const w = ctx.widthMm - 2 * m;
  let y = header(ctx, p, { eyebrow: "Une lettre pour toi", title: o.title });
  if (o.img?.src) {
    const ih = ctx.heightMm * 0.32;
    p.layout.blocks.push(image({ x: m, y, w, h: ih, img: o.img, alt: o.title, radius: 7 }));
    y += ih + 6;
  }
  const bottom = ctx.heightMm - m - 10;
  p.layout.blocks.push(shape({ x: m, y, w, h: bottom - y, color: c.softer, radius: 7 }));
  p.layout.blocks.push(text({ text: "“", x: m + 6, y: y + 1, w: 16, h: 22, pt: 44, lineHeight: 1, weight: "bold", color: tint(ctx.theme.colorSecondary, 0.55) }));
  p.layout.blocks.push(text({ text: o.body, x: m + 10, y: y + 14, w: w - 20, h: bottom - y - (o.signature ? 34 : 20), pt: 13.5, lineHeight: 1.6, color: INK }));
  if (o.signature) p.layout.blocks.push(text({ text: `— ${o.signature}`, x: m + 10, y: bottom - 18, w: w - 20, h: 10, pt: 15, align: "right", weight: "bold", color: c.primary }));
  return p;
}

/** Cartes énigmes version texte : 4 par page, numéro, texte et indice de secours. */
export function buildRiddleTextPages(ctx: BuildContext, riddles: TreasureHunt["enigmes"], heroName: string): BuiltPage[] {
  const c = palette(ctx);
  return chunk(riddles, 4).map((group) => {
    const p = page(ctx, "kit_riddle_text");
    const top = header(ctx, p, { eyebrow: "Énigmes · version texte", note: "✂  Découpez les cartes en suivant les pointillés." });
    grid(ctx, 2, top).slice(0, group.length).forEach((cell, i) => {
      const r = group[i];
      p.layout.blocks.push(shape({ x: cell.x, y: cell.y, w: cell.w, h: cell.h, color: "#ffffff", radius: 7, border: CUT, dashed: true }));
      p.layout.blocks.push(shape({ x: cell.x + 3, y: cell.y + 3, w: cell.w - 6, h: 22, color: c.soft, radius: 5 }));
      badge(ctx, p, r.numero, cell.x + 7, cell.y + 7.5, 13);
      p.layout.blocks.push(text({ text: heroName ? `Énigme de ${heroName}` : "Énigme", x: cell.x + 24, y: cell.y + 10, w: cell.w - 28, h: 8, pt: 10.5, weight: "bold", color: c.primary }));
      p.layout.blocks.push(text({ text: r.texte, x: cell.x + 7, y: cell.y + 32, w: cell.w - 14, h: cell.h - 54, pt: 15, align: "center", lineHeight: 1.45, color: INK }));
      if (r.indice_secours) p.layout.blocks.push(text({ text: `Indice : ${r.indice_secours}`, x: cell.x + 6, y: cell.y + cell.h - 17, w: cell.w - 12, h: 12, pt: 8.5, align: "center", color: MUTED, background: c.softer, padding: 1.8, radius: 4 }));
    });
    return p;
  });
}

/** Cartes énigmes version images : 4 par page, illustration de la cachette + numéro. */
export function buildRiddleImagePages(ctx: BuildContext, riddles: TreasureHunt["enigmes"], images: KitImages): BuiltPage[] {
  return chunk(riddles, 4).map((group) => {
    const p = page(ctx, "kit_riddle_image");
    const top = header(ctx, p, { eyebrow: "Énigmes · version images", note: "✂  Pour les plus petits : l'image montre la cachette." });
    grid(ctx, 2, top).slice(0, group.length).forEach((cell, i) => {
      const r = group[i];
      const img = images[`enigme-image-${r.numero}`];
      p.layout.blocks.push(shape({ x: cell.x, y: cell.y, w: cell.w, h: cell.h, color: "#ffffff", radius: 7, border: CUT, dashed: true }));
      p.layout.blocks.push(image({ x: cell.x + 3.5, y: cell.y + 3.5, w: cell.w - 7, h: cell.h - 7, img, alt: r.image_description || `Cachette : ${r.cachette}`, radius: 5 }));
      p.layout.blocks.push(shape({ x: cell.x + 6, y: cell.y + 6, w: 15, h: 15, color: "#ffffff", shape: "circle" }));
      badge(ctx, p, r.numero, cell.x + 7, cell.y + 7, 13);
    });
    return p;
  });
}

/** Carte au trésor pleine page découpée en morceaux numérotés. */
export function buildTreasureMapPage(ctx: BuildContext, o: { title: string; instruction: string; img?: KitImage; pieces?: number }): BuiltPage {
  const p = page(ctx, "kit_map");
  const m = ctx.theme.marginMm;
  const w = ctx.widthMm - 2 * m;
  const top = header(ctx, p, { eyebrow: "La carte au trésor", title: o.title || undefined, note: o.instruction || "Avant de découper : écrivez la cachette du trésor sous le X, puis découpez en suivant les lignes." });
  const h = ctx.heightMm - top - m - 10;
  p.layout.blocks.push(image({ x: m, y: top, w, h, img: o.img, alt: o.title || "Carte au trésor", fit: "cover", radius: 6 }));
  const pieces = o.pieces ?? 10;
  const cols = 2;
  const rows = Math.ceil(pieces / cols);
  for (let i = 0; i < pieces; i++) {
    const cx = m + (i % cols) * (w / cols) + 3;
    const cy = top + Math.floor(i / cols) * (h / rows) + 3;
    p.layout.blocks.push(shape({ x: cx, y: cy, w: 8, h: 8, color: "#ffffff", shape: "circle", border: ctx.theme.colorSecondary }));
    p.layout.blocks.push(text({ text: String(i + 1), x: cx, y: cy + 1.4, w: 8, h: 5, pt: 8, align: "center", weight: "bold", color: ctx.theme.colorSecondary }));
  }
  // Lignes de découpe (fines bandes claires)
  for (let col = 1; col < cols; col++) p.layout.blocks.push(shape({ x: m + (col * w) / cols - 0.5, y: top, w: 1, h, color: "#ffffffcc" }));
  for (let r = 1; r < rows; r++) p.layout.blocks.push(shape({ x: m, y: top + (r * h) / rows - 0.5, w, h: 1, color: "#ffffffcc" }));
  return p;
}

/** Défis : 6 par page (2 × 3). */
export function buildChallengesPage(ctx: BuildContext, challenges: TreasureHunt["defis"], label = "Défi"): BuiltPage[] {
  const c = palette(ctx);
  return chunk(challenges, 6).map((group) => {
    const p = page(ctx, "kit_challenges");
    const top = header(ctx, p, { eyebrow: `${label}s`, note: "✂  À découper et glisser entre deux énigmes." });
    grid(ctx, 3, top).slice(0, group.length).forEach((cell, i) => {
      const d = group[i];
      p.layout.blocks.push(shape({ x: cell.x, y: cell.y, w: cell.w, h: cell.h, color: c.softer, radius: 7, border: CUT, dashed: true }));
      p.layout.blocks.push(text({ text: label.toUpperCase(), x: cell.x + 6, y: cell.y + 6, w: 24, h: 6.5, pt: 7.5, align: "center", weight: "bold", color: "#ffffff", background: ctx.theme.colorAccent, radius: 3.25 }));
      p.layout.blocks.push(text({ text: d.titre, x: cell.x + 6, y: cell.y + 15, w: cell.w - 12, h: 10, pt: 14, weight: "bold", color: INK }));
      p.layout.blocks.push(text({ text: d.consigne, x: cell.x + 6, y: cell.y + 27, w: cell.w - 12, h: cell.h - 31, pt: 11, lineHeight: 1.4, color: INK }));
    });
    return p;
  });
}

/** Diplômes / certificats : 2 par page. */
export function buildDiplomaPage(ctx: BuildContext, o: { title: string; body: string; img?: KitImage }): BuiltPage {
  const c = palette(ctx);
  const p = page(ctx, "kit_diploma");
  const m = ctx.theme.marginMm;
  const w = ctx.widthMm - 2 * m;
  const h = (ctx.heightMm - 2 * m - 10) / 2;
  for (let i = 0; i < 2; i++) {
    const y = m + i * (h + 10);
    // Cadre épais aux couleurs de l'univers, intérieur blanc
    p.layout.blocks.push(shape({ x: m, y, w, h, color: c.primary, radius: 8 }));
    p.layout.blocks.push(shape({ x: m + 3, y: y + 3, w: w - 6, h: h - 6, color: "#ffffff", radius: 6 }));
    const iw = Math.min(w * 0.36, (h - 14) * 0.6);
    if (o.img?.src) p.layout.blocks.push(image({ x: m + 8, y: y + 8, w: iw, h: h - 16, img: o.img, alt: o.title, radius: 5 }));
    const tx = m + (o.img?.src ? iw + 14 : 12);
    const tw = w - (o.img?.src ? iw + 22 : 24);
    p.layout.blocks.push(text({ text: "DIPLÔME", x: tx, y: y + 10, w: tw, h: 6, pt: 9, align: "center", weight: "bold", color: c.accent, role: "label" }));
    p.layout.blocks.push(text({ text: o.title || "Diplôme", x: tx, y: y + 17, w: tw, h: 14, pt: 20, align: "center", weight: "bold", color: INK, role: "title", lineHeight: 1.1 }));
    p.layout.blocks.push(text({ text: o.body.replace(/…|\.\.\./g, "______________________"), x: tx, y: y + 34, w: tw, h: h - 60, pt: 12, align: "center", lineHeight: 1.6, color: INK }));
    p.layout.blocks.push(text({ text: "Date : ____________", x: tx, y: y + h - 20, w: tw / 2, h: 8, pt: 9.5, color: MUTED }));
    p.layout.blocks.push(text({ text: "Signature : ____________", x: tx + tw / 2, y: y + h - 20, w: tw / 2, h: 8, pt: 9.5, color: MUTED, align: "right" }));
  }
  return p;
}

/** Invitations : 2 par page, texte et champs à compléter. */
export function buildInvitationPage(ctx: BuildContext, o: { title: string; body: string; img?: KitImage }): BuiltPage {
  const c = palette(ctx);
  const p = page(ctx, "kit_invitation");
  const m = ctx.theme.marginMm;
  const w = ctx.widthMm - 2 * m;
  const h = (ctx.heightMm - 2 * m - 10) / 2;
  for (let i = 0; i < 2; i++) {
    const y = m + i * (h + 10);
    p.layout.blocks.push(shape({ x: m, y, w, h, color: c.accentSoft, radius: 8, border: CUT, dashed: true }));
    if (o.img?.src) p.layout.blocks.push(image({ x: m + 5, y: y + 5, w: w * 0.44, h: h - 10, img: o.img, alt: o.title, radius: 6 }));
    const tx = m + (o.img?.src ? w * 0.49 : 10);
    const tw = w - (o.img?.src ? w * 0.49 + 7 : 20);
    p.layout.blocks.push(text({ text: "INVITATION", x: tx, y: y + 8, w: tw, h: 6, pt: 9, weight: "bold", color: c.accent, role: "label" }));
    p.layout.blocks.push(text({ text: o.title || "Invitation", x: tx, y: y + 15, w: tw, h: 12, pt: 17, weight: "bold", color: INK, role: "title", lineHeight: 1.1 }));
    p.layout.blocks.push(text({ text: `${o.body}\n\nLe ______ à ____ h\nAdresse : ______________\nRéponds avant le ________`, x: tx, y: y + 30, w: tw, h: h - 36, pt: 10.5, lineHeight: 1.6, background: "#ffffff", padding: 4, radius: 5, color: INK }));
  }
  return p;
}

/** Guide de l'organisateur / des parents : sections en cartes sur 1 à 2 pages. */
export function buildGuidePages(ctx: BuildContext, title: string, sections: Array<{ title: string; items: string[] }>, img?: KitImage): BuiltPage[] {
  const c = palette(ctx);
  const m = ctx.theme.marginMm;
  const w = ctx.widthMm - 2 * m;
  const pages: BuiltPage[] = [];
  let p = page(ctx, "kit_guide");
  pages.push(p);
  let y = header(ctx, p, { eyebrow: "Pour les parents", title });
  if (img?.src) {
    // Bandeau au format paysage (3:2 à moins de 25 %), centré
    const ih = 52;
    const iw = Math.min(w, ih * 1.6);
    p.layout.blocks.push(image({ x: m + (w - iw) / 2, y, w: iw, h: ih, img, alt: title, radius: 6 }));
    y += ih + 6;
  }
  const colW = (w - 6) / 2;
  let colY = [y, y];
  const limit = ctx.heightMm - m - 8;
  for (const s of sections.filter((x) => x.items.length)) {
    // Hauteur estimée par le même calcul que les autres listes (police 11 pt, marge intérieure 4,5 mm)
    const h = listHeight(s.items, colW, 11, 4.5) + 3;
    let col = colY[0] <= colY[1] ? 0 : 1;
    // La colonne la plus courte déborde : on essaie l'autre avant d'ouvrir une page
    if (colY[col] + h > limit && colY[1 - col] + h <= limit) col = 1 - col;
    if (colY[col] + h > limit) {
      p = page(ctx, "kit_guide");
      pages.push(p);
      const top = header(ctx, p, { eyebrow: "Pour les parents", title: `${title} (suite)` });
      colY = [top, top];
      col = 0;
    }
    p.layout.blocks.push(list({ title: s.title, items: s.items, x: m + col * (colW + 6), y: colY[col], w: colW, h, pt: 11, background: c.softer, padding: 4.5, radius: 6 }));
    colY[col] += h + 5;
  }
  return pages;
}

/** Idée de farce / d'activité : une page par idée. */
export function buildIdeaPage(ctx: BuildContext, idea: PranksKit["idees"][number], img?: KitImage): BuiltPage {
  const c = palette(ctx);
  const p = page(ctx, "kit_idea");
  const m = ctx.theme.marginMm;
  const w = ctx.widthMm - 2 * m;
  const meta = [`${idea.temps_minutes} min`, ["Très facile", "Facile", "Grand jeu"][Math.min(2, Math.max(0, idea.difficulte - 1))], idea.age_conseille ? `${idea.age_conseille.replace("+", "")} ans et +` : ""].filter(Boolean);
  let y = header(ctx, p, { eyebrow: `Idée n° ${idea.numero}`, title: idea.titre, note: idea.resume || undefined });
  let x = m;
  for (const t of meta) {
    const pw = Math.max(22, t.length * 2.3 + 10);
    p.layout.blocks.push(text({ text: t, x, y, w: pw, h: 8, pt: 9.5, align: "center", weight: "bold", background: c.accentSoft, padding: 1.4, radius: 4, color: INK }));
    x += pw + 3;
  }
  y += 12;
  const imgH = ctx.heightMm * 0.28;
  const imgW = Math.min(w, imgH * 1.6);
  p.layout.blocks.push(image({ x: m + (w - imgW) / 2, y, w: imgW, h: imgH, img, alt: idea.illustration_description || idea.titre, radius: 7 }));
  y += imgH + 6;
  const colW = (w - 6) / 2;
  const notes = (idea.message_du_lutin ? 22 : 0) + (idea.variante_sans_materiel ? 12 : 0);
  const bottomH = ctx.heightMm - y - m - 12 - notes;
  p.layout.blocks.push(list({ title: "Matériel", items: idea.materiel.length ? idea.materiel : ["Rien de spécial"], x: m, y, w: colW, h: bottomH, pt: 11.5, background: c.softer, padding: 4.5, radius: 6 }));
  p.layout.blocks.push(list({ title: "Préparation", items: idea.preparation, x: m + colW + 6, y, w: colW, h: bottomH, pt: 11.5, background: c.softer, padding: 4.5, radius: 6 }));
  let ny = y + bottomH + 4;
  if (idea.message_du_lutin) {
    p.layout.blocks.push(shape({ x: m, y: ny, w, h: 18, color: c.accentSoft, radius: 6 }));
    p.layout.blocks.push(shape({ x: m, y: ny, w: 2.2, h: 18, color: c.accent, radius: 1 }));
    p.layout.blocks.push(text({ text: `Mot à laisser : « ${idea.message_du_lutin} »`, x: m + 7, y: ny + 3, w: w - 12, h: 12, pt: 11.5, weight: "bold", color: INK }));
    ny += 22;
  }
  if (idea.variante_sans_materiel) p.layout.blocks.push(text({ text: `Sans matériel : ${idea.variante_sans_materiel}`, x: m, y: ny, w, h: 9, pt: 9.5, color: MUTED }));
  return p;
}

/** Calendrier 24 cases (à cocher) + idées de réserve. */
export function buildCalendarPage(ctx: BuildContext, ideas: PranksKit["idees"], reserve: PranksKit["idees_reserve"]): BuiltPage {
  const c = palette(ctx);
  const p = page(ctx, "kit_calendar");
  const m = ctx.theme.marginMm;
  const w = ctx.widthMm - 2 * m;
  const top = header(ctx, p, { eyebrow: "Mon calendrier", title: "Une idée par jour", note: "Cochez la case et notez le numéro de l'idée choisie." });
  const cols = 4;
  const rows = 6;
  const gap = 3;
  const cw = (w - gap * (cols - 1)) / cols;
  const ch = (ctx.heightMm * 0.56 - gap * (rows - 1)) / rows;
  for (let d = 0; d < 24; d++) {
    const x = m + (d % cols) * (cw + gap);
    const y = top + Math.floor(d / cols) * (ch + gap);
    p.layout.blocks.push(shape({ x, y, w: cw, h: ch, color: d % 2 ? c.soft : c.accentSoft, radius: 5 }));
    p.layout.blocks.push(text({ text: String(d + 1), x: x + 3, y: y + 2, w: 12, h: 8, pt: 14, weight: "bold", color: c.primary }));
    p.layout.blocks.push(text({ text: "☐  idée n° ___", x: x + 3, y: y + ch - 8, w: cw - 6, h: 6, pt: 8, color: MUTED }));
  }
  const ry = top + rows * (ch + gap) + 4;
  const items = reserve.length ? reserve.map((r) => `${r.titre}${r.resume ? ` : ${r.resume}` : ""}`) : ideas.slice(0, 6).map((i) => i.titre);
  p.layout.blocks.push(list({ title: "Idées de réserve", items, x: m, y: ry, w, h: ctx.heightMm - ry - m - 8, pt: 10, background: c.softer, padding: 4.5, radius: 6 }));
  return p;
}

/** Petits mots à découper : 10 par page (2 × 5). */
export function buildNotesPage(ctx: BuildContext, notes: string[], signature: string): BuiltPage {
  const c = palette(ctx);
  const p = page(ctx, "kit_notes");
  const top = header(ctx, p, { eyebrow: "Petits mots à découper", note: "✂  À glisser à côté de chaque surprise." });
  grid(ctx, 5, top).slice(0, Math.min(10, notes.length)).forEach((cell, i) => {
    p.layout.blocks.push(shape({ x: cell.x, y: cell.y, w: cell.w, h: cell.h, color: i % 2 ? c.softer : c.accentSoft, radius: 6, border: CUT, dashed: true }));
    p.layout.blocks.push(text({ text: notes[i], x: cell.x + 5, y: cell.y + 4, w: cell.w - 10, h: cell.h - 14, pt: 12, align: "center", color: INK }));
    if (signature) p.layout.blocks.push(text({ text: `— ${signature}`, x: cell.x + 4, y: cell.y + cell.h - 9, w: cell.w - 8, h: 6, pt: 9, align: "right", weight: "bold", color: c.accent }));
  });
  return p;
}

/** Pages intérieures d'une chasse au trésor (dans l'ordre du kit). */
export function buildTreasureHuntPages(ctx: BuildContext, kit: TreasureHunt, images: KitImages, opts: { challengeLabel?: string } = {}): BuiltPage[] {
  const hero = kit.personnage?.nom ?? "";
  const g = kit.guide ?? {};
  const pages: BuiltPage[] = [];
  pages.push(
    ...buildGuidePages(ctx, "Guide de l'organisateur", [
      { title: "Matériel", items: g.materiel ?? [] },
      { title: "Préparation (20 minutes)", items: g.preparation ?? [] },
      { title: "Plan des cachettes", items: (g.cachettes ?? []).map((c) => `Carte ${c.carte} : ${c.cachette}${c.variante ? ` (variante : ${c.variante})` : ""}`) },
      { title: "Déroulé", items: g.deroule ?? [] },
      { title: "Adapter le jeu", items: g.adaptations ?? [] },
      { title: "Sécurité", items: g.securite ?? [] },
    ], images["planche-personnage"]),
  );
  pages.push(buildLetterPage(ctx, { title: hero ? `Message de ${hero}` : "La lettre", body: kit.lettre, signature: hero, img: images["lettre"] }));
  pages.push(...buildRiddleTextPages(ctx, kit.enigmes, hero));
  pages.push(...buildRiddleImagePages(ctx, kit.enigmes, images));
  pages.push(buildTreasureMapPage(ctx, { title: kit.carte?.titre ?? "", instruction: kit.carte?.consigne_parent ?? "", img: images["carte"], pieces: Math.min(10, Math.max(2, kit.enigmes.length)) }));
  if (kit.defis.length) pages.push(...buildChallengesPage(ctx, kit.defis, opts.challengeLabel ?? "Défi"));
  pages.push(buildDiplomaPage(ctx, { title: kit.diplome?.titre ?? "Diplôme", body: kit.diplome?.texte ?? "", img: images["diplome"] }));
  if (kit.invitation?.texte) pages.push(buildInvitationPage(ctx, { title: kit.invitation.titre ?? "Invitation", body: kit.invitation.texte, img: images["invitation"] }));
  return pages;
}

/** Pages intérieures d'un kit d'idées (lutins farceurs, activités de Noël). */
export function buildPranksPages(ctx: BuildContext, kit: PranksKit, images: KitImages): BuiltPage[] {
  const hero = kit.personnages[0]?.nom ?? "";
  const pages: BuiltPage[] = [];
  pages.push(buildLetterPage(ctx, { title: hero ? `${hero} est arrivé !` : "Lettre d'arrivée", body: kit.lettre_arrivee, signature: hero, img: images["lettre-arrivee"] }));
  for (const idea of kit.idees) pages.push(buildIdeaPage(ctx, idea, images[`idee-${idea.numero}`]));
  pages.push(buildCalendarPage(ctx, kit.idees, kit.idees_reserve));
  if (kit.mots_du_lutin.length) pages.push(buildNotesPage(ctx, kit.mots_du_lutin, hero));
  if (kit.lettre_depart) pages.push(buildLetterPage(ctx, { title: hero ? `Au revoir de ${hero}` : "Lettre de départ", body: kit.lettre_depart, signature: hero, img: images["lettre-depart"] }));
  pages.push(buildDiplomaPage(ctx, { title: kit.certificat?.titre ?? "Certificat", body: kit.certificat?.texte ?? "", img: images["certificat"] }));
  const gp = kit.guide_parents ?? {};
  pages.push(...buildGuidePages(ctx, "Guide des parents", [
    { title: "Introduire le lutin", items: gp.introduire ?? [] },
    { title: "Un soir d'oubli ?", items: gp.oubli ? [gp.oubli] : [] },
    { title: "Organisation", items: gp.organisation ?? [] },
    { title: "Sécurité", items: gp.securite ?? [] },
  ], images["planche-personnages"]));
  return pages;
}
