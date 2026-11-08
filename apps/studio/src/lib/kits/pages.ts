/**
 * Gabarits de pages des kits (chasse au trésor, lutins farceurs). Ils produisent les
 * mêmes blocs positionnés en mm que le moteur des livres d'activités : l'aperçu,
 * l'éditeur et l'export PDF fonctionnent sans changement.
 */
import type { Block, PageLayout } from "../schemas/layout";
import type { BuildContext, BuiltPage } from "../layout/engine";
import { newId } from "../utils";
import type { PranksKit, TreasureHunt } from "./schemas";

export interface KitImage {
  src?: string;
  isDemo: boolean;
  illustrationId?: string;
}
export type KitImages = Record<string, KitImage | undefined>;

function page(ctx: BuildContext, templateKey: string, background?: string): BuiltPage {
  const layout: PageLayout = { widthMm: ctx.widthMm, heightMm: ctx.heightMm, showPageNumber: true, background, blocks: [] };
  return { templateKey, layout };
}

function text(o: { text: string; x: number; y: number; w: number; h: number; role?: "title" | "subtitle" | "heading" | "body" | "caption" | "label"; pt?: number; align?: "left" | "center" | "right" | "justify"; weight?: "normal" | "bold"; color?: string; background?: string; padding?: number; radius?: number; border?: string; lineHeight?: number; font?: string }): Block {
  return {
    id: newId("t"), type: "text", role: o.role ?? "body", text: o.text, x: o.x, y: o.y, w: o.w, h: o.h, editable: true,
    style: { fontSizePt: o.pt, align: o.align, weight: o.weight, color: o.color, background: o.background, padding: o.padding, radius: o.radius, borderColor: o.border, lineHeight: o.lineHeight, fontFamily: o.font },
  };
}

function shape(o: { x: number; y: number; w: number; h: number; color: string; shape?: "rect" | "band" | "circle"; radius?: number; border?: string }): Block {
  return { id: newId("s"), type: "shape", shape: o.shape ?? "rect", color: o.color, x: o.x, y: o.y, w: o.w, h: o.h, editable: true, style: { radius: o.radius, borderColor: o.border } };
}

function image(o: { x: number; y: number; w: number; h: number; img?: KitImage; alt: string; fit?: "contain" | "cover"; radius?: number }): Block {
  return { id: newId("i"), type: "image", role: "decoration", illustrationId: o.img?.illustrationId, src: o.img?.src, alt: o.alt, caption: "", isDemo: o.img?.isDemo ?? false, fit: o.fit ?? "cover", x: o.x, y: o.y, w: o.w, h: o.h, editable: true, style: { radius: o.radius } };
}

function list(o: { items: string[]; title?: string; x: number; y: number; w: number; h: number; pt?: number }): Block {
  return { id: newId("l"), type: "list", role: "bullets", items: o.items, title: o.title, x: o.x, y: o.y, w: o.w, h: o.h, editable: true, style: { fontSizePt: o.pt } };
}

const CREAM = "#FFF9F0";
const PAPER = "#F7E9CF";

/** Grille de N cartes par page (2 colonnes). */
function grid(ctx: BuildContext, rows: number) {
  const m = ctx.theme.marginMm;
  const gap = 6;
  const w = (ctx.widthMm - 2 * m - gap) / 2;
  const h = (ctx.heightMm - 2 * m - 10 - gap * (rows - 1)) / rows;
  return Array.from({ length: rows * 2 }, (_, i) => ({ x: m + (i % 2) * (w + gap), y: m + 6 + Math.floor(i / 2) * (h + gap), w, h }));
}

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

/** Lettre pleine page (lettre de la Capitaine, lettre d'arrivée du lutin…). */
export function buildLetterPage(ctx: BuildContext, o: { title: string; body: string; signature?: string; img?: KitImage; templateKey?: string }): BuiltPage {
  const p = page(ctx, o.templateKey ?? "kit_letter", CREAM);
  const m = ctx.theme.marginMm;
  const w = ctx.widthMm - 2 * m;
  const imgH = o.img?.src ? ctx.heightMm * 0.36 : 0;
  if (imgH) p.layout.blocks.push(image({ x: m, y: m, w, h: imgH, img: o.img, alt: o.title, radius: 4 }));
  const top = m + (imgH ? imgH + 6 : 4);
  p.layout.blocks.push(shape({ x: m, y: top, w, h: ctx.heightMm - top - m - 8, color: PAPER, radius: 5, border: "#D9B98A" }));
  p.layout.blocks.push(text({ text: o.title, x: m + 8, y: top + 6, w: w - 16, h: 12, role: "title", pt: 20, color: ctx.theme.colorPrimary, weight: "bold" }));
  p.layout.blocks.push(text({ text: o.body, x: m + 8, y: top + 20, w: w - 16, h: ctx.heightMm - top - m - 48, pt: 12, lineHeight: 1.55 }));
  if (o.signature) p.layout.blocks.push(text({ text: o.signature, x: m + 8, y: ctx.heightMm - m - 30, w: w - 16, h: 10, pt: 14, align: "right", weight: "bold", color: ctx.theme.colorPrimary }));
  return p;
}

/** Cartes énigmes version texte : 4 par page, numéro, texte et indice de secours. */
export function buildRiddleTextPages(ctx: BuildContext, riddles: TreasureHunt["enigmes"], heroName: string): BuiltPage[] {
  return chunk(riddles, 4).map((group) => {
    const p = page(ctx, "kit_riddle_text");
    p.layout.blocks.push(text({ text: "Cartes énigmes · version texte · à découper", x: ctx.theme.marginMm, y: ctx.theme.marginMm - 6, w: ctx.widthMm - 2 * ctx.theme.marginMm, h: 5, pt: 7, align: "center", color: "#8a7a63", role: "caption" }));
    grid(ctx, 2).slice(0, group.length).forEach((cell, i) => {
      const r = group[i];
      p.layout.blocks.push(shape({ x: cell.x, y: cell.y, w: cell.w, h: cell.h, color: PAPER, radius: 5, border: "#C9A66B" }));
      p.layout.blocks.push(shape({ x: cell.x + cell.w / 2 - 7, y: cell.y + 5, w: 14, h: 14, color: ctx.theme.colorSecondary, shape: "circle" }));
      p.layout.blocks.push(text({ text: String(r.numero), x: cell.x + cell.w / 2 - 7, y: cell.y + 7.5, w: 14, h: 9, pt: 16, align: "center", weight: "bold", color: "#ffffff" }));
      p.layout.blocks.push(text({ text: heroName ? `Énigme de ${heroName}` : "Énigme", x: cell.x + 4, y: cell.y + 22, w: cell.w - 8, h: 8, pt: 11, align: "center", weight: "bold", color: ctx.theme.colorPrimary }));
      p.layout.blocks.push(text({ text: r.texte, x: cell.x + 6, y: cell.y + 34, w: cell.w - 12, h: cell.h - 56, pt: 11.5, align: "center", lineHeight: 1.5 }));
      if (r.indice_secours) p.layout.blocks.push(text({ text: r.indice_secours, x: cell.x + 6, y: cell.y + cell.h - 16, w: cell.w - 12, h: 10, pt: 7.5, align: "center", color: "#6b7280", role: "caption" }));
    });
    return p;
  });
}

/** Cartes énigmes version images : 4 par page, illustration de la cachette + numéro. */
export function buildRiddleImagePages(ctx: BuildContext, riddles: TreasureHunt["enigmes"], images: KitImages): BuiltPage[] {
  return chunk(riddles, 4).map((group) => {
    const p = page(ctx, "kit_riddle_image");
    p.layout.blocks.push(text({ text: "Cartes énigmes · version images · à découper", x: ctx.theme.marginMm, y: ctx.theme.marginMm - 6, w: ctx.widthMm - 2 * ctx.theme.marginMm, h: 5, pt: 7, align: "center", color: "#8a7a63", role: "caption" }));
    grid(ctx, 2).slice(0, group.length).forEach((cell, i) => {
      const r = group[i];
      const img = images[`enigme-image-${r.numero}`];
      p.layout.blocks.push(shape({ x: cell.x, y: cell.y, w: cell.w, h: cell.h, color: PAPER, radius: 5, border: "#C9A66B" }));
      p.layout.blocks.push(image({ x: cell.x + 3, y: cell.y + 3, w: cell.w - 6, h: cell.h - 6, img, alt: r.image_description || `Cachette : ${r.cachette}`, radius: 4 }));
      p.layout.blocks.push(shape({ x: cell.x + 6, y: cell.y + 6, w: 13, h: 13, color: ctx.theme.colorSecondary, shape: "circle" }));
      p.layout.blocks.push(text({ text: String(r.numero), x: cell.x + 6, y: cell.y + 8, w: 13, h: 9, pt: 14, align: "center", weight: "bold", color: "#ffffff" }));
    });
    return p;
  });
}

/** Carte au trésor pleine page découpée en 10 morceaux (grille 2 × 5 numérotée). */
export function buildTreasureMapPage(ctx: BuildContext, o: { title: string; instruction: string; img?: KitImage; pieces?: number }): BuiltPage {
  const p = page(ctx, "kit_map");
  const m = ctx.theme.marginMm;
  const w = ctx.widthMm - 2 * m;
  p.layout.blocks.push(text({ text: o.instruction || "Avant de découper : écrivez la cachette du trésor dans le cadre sous le X, puis découpez en suivant les pointillés.", x: m, y: m - 4, w, h: 10, pt: 8, color: "#6b7280", role: "caption" }));
  const top = m + 8;
  const h = ctx.heightMm - top - m - 10;
  p.layout.blocks.push(image({ x: m, y: top, w, h, img: o.img, alt: o.title || "Carte au trésor", fit: "cover", radius: 3 }));
  const pieces = o.pieces ?? 10;
  const cols = 2;
  const rows = Math.ceil(pieces / cols);
  for (let i = 0; i < pieces; i++) {
    const cx = m + (i % cols) * (w / cols) + 3;
    const cy = top + Math.floor(i / cols) * (h / rows) + 3;
    p.layout.blocks.push(shape({ x: cx, y: cy, w: 7, h: 7, color: "#ffffff", shape: "circle", border: ctx.theme.colorSecondary }));
    p.layout.blocks.push(text({ text: String(i + 1), x: cx, y: cy + 1, w: 7, h: 5, pt: 7, align: "center", weight: "bold", color: ctx.theme.colorSecondary }));
  }
  // Pointillés de découpe (fines bandes)
  for (let c = 1; c < cols; c++) p.layout.blocks.push(shape({ x: m + (c * w) / cols - 0.5, y: top, w: 1, h, color: "#ffffff99" }));
  for (let r = 1; r < rows; r++) p.layout.blocks.push(shape({ x: m, y: top + (r * h) / rows - 0.5, w, h: 1, color: "#ffffff99" }));
  return p;
}

/** Défis : 6 par page (2 × 3). */
export function buildChallengesPage(ctx: BuildContext, challenges: TreasureHunt["defis"], label = "Défi"): BuiltPage[] {
  return chunk(challenges, 6).map((group) => {
    const p = page(ctx, "kit_challenges");
    p.layout.blocks.push(text({ text: `${label}s · à découper et glisser entre deux énigmes`, x: ctx.theme.marginMm, y: ctx.theme.marginMm - 6, w: ctx.widthMm - 2 * ctx.theme.marginMm, h: 5, pt: 7, align: "center", color: "#8a7a63", role: "caption" }));
    grid(ctx, 3).slice(0, group.length).forEach((cell, i) => {
      const d = group[i];
      p.layout.blocks.push(shape({ x: cell.x, y: cell.y, w: cell.w, h: cell.h, color: "#ffffff", radius: 4, border: "#9ca3af" }));
      p.layout.blocks.push(text({ text: label.toUpperCase(), x: cell.x + cell.w / 2 - 15, y: cell.y + 5, w: 30, h: 6, pt: 7, align: "center", weight: "bold", color: "#ffffff", background: ctx.theme.colorAccent, radius: 3 }));
      p.layout.blocks.push(text({ text: d.titre, x: cell.x + 4, y: cell.y + 14, w: cell.w - 8, h: 9, pt: 13, align: "center", weight: "bold", color: ctx.theme.colorPrimary }));
      p.layout.blocks.push(text({ text: d.consigne, x: cell.x + 5, y: cell.y + 26, w: cell.w - 10, h: cell.h - 30, pt: 10, align: "center" }));
    });
    return p;
  });
}

/** Diplômes / certificats : 2 par page. */
export function buildDiplomaPage(ctx: BuildContext, o: { title: string; body: string; img?: KitImage }): BuiltPage {
  const p = page(ctx, "kit_diploma");
  const m = ctx.theme.marginMm;
  const w = ctx.widthMm - 2 * m;
  const h = (ctx.heightMm - 2 * m - 8) / 2;
  for (let i = 0; i < 2; i++) {
    const y = m + i * (h + 8);
    p.layout.blocks.push(shape({ x: m, y, w, h, color: PAPER, radius: 6, border: "#C9A66B" }));
    // Cadre portrait (≈ 2:3 à moins de 25 %) : l'illustration portrait n'est pas rognée
    const iw = Math.min(w * 0.38, (h - 6) * 0.6);
    if (o.img?.src) p.layout.blocks.push(image({ x: m + 3, y: y + 3, w: iw, h: h - 6, img: o.img, alt: o.title, radius: 4 }));
    const tx = m + (o.img?.src ? iw + 8 : 10);
    const tw = w - (o.img?.src ? iw + 14 : 20);
    p.layout.blocks.push(text({ text: o.title || "Diplôme", x: tx, y: y + 10, w: tw, h: 12, pt: 20, align: "center", weight: "bold", color: ctx.theme.colorSecondary, role: "title" }));
    p.layout.blocks.push(text({ text: o.body.replace(/…|\.\.\./g, "______________________"), x: tx, y: y + 26, w: tw, h: h - 52, pt: 11, align: "center", lineHeight: 1.6 }));
    p.layout.blocks.push(text({ text: "Date : ____________", x: tx, y: y + h - 20, w: tw / 2, h: 8, pt: 9, color: "#6b7280" }));
    p.layout.blocks.push(text({ text: "Signature : ____________", x: tx + tw / 2, y: y + h - 20, w: tw / 2, h: 8, pt: 9, color: "#6b7280", align: "right" }));
  }
  return p;
}

/** Invitations : 2 par page, texte et champs à compléter. */
export function buildInvitationPage(ctx: BuildContext, o: { title: string; body: string; img?: KitImage }): BuiltPage {
  const p = page(ctx, "kit_invitation");
  const m = ctx.theme.marginMm;
  const w = ctx.widthMm - 2 * m;
  const h = (ctx.heightMm - 2 * m - 8) / 2;
  for (let i = 0; i < 2; i++) {
    const y = m + i * (h + 8);
    p.layout.blocks.push(shape({ x: m, y, w, h, color: "#EAF6FD", radius: 6, border: "#A9D8F5" }));
    if (o.img?.src) p.layout.blocks.push(image({ x: m + 3, y: y + 3, w: w * 0.45, h: h - 6, img: o.img, alt: o.title, radius: 4 }));
    const tx = m + (o.img?.src ? w * 0.5 : 10);
    const tw = w - (o.img?.src ? w * 0.5 + 6 : 20);
    p.layout.blocks.push(text({ text: o.title || "Invitation", x: tx, y: y + 8, w: tw, h: 10, pt: 16, weight: "bold", color: ctx.theme.colorSecondary, role: "title" }));
    p.layout.blocks.push(text({ text: `${o.body}\n\nRendez-vous le ______ à ____ h\nau ______________________\nRéponds avant le ________`, x: tx, y: y + 20, w: tw, h: h - 26, pt: 10, lineHeight: 1.6, background: "#ffffffcc", padding: 3, radius: 3 }));
  }
  return p;
}

/** Guide de l'organisateur / des parents : flux de sections en listes sur 1 à 2 pages. */
export function buildGuidePages(ctx: BuildContext, title: string, sections: Array<{ title: string; items: string[] }>, img?: KitImage): BuiltPage[] {
  const m = ctx.theme.marginMm;
  const w = ctx.widthMm - 2 * m;
  const pages: BuiltPage[] = [];
  let p = page(ctx, "kit_guide");
  pages.push(p);
  let y = m;
  if (img?.src) {
    // Bandeau au format paysage (3:2 à moins de 25 %), centré
    const ih = 58;
    const iw = Math.min(w, ih * 1.6);
    p.layout.blocks.push(image({ x: m + (w - iw) / 2, y, w: iw, h: ih, img, alt: title, radius: 4 }));
    y += ih + 5;
  }
  p.layout.blocks.push(text({ text: title, x: m, y, w, h: 12, pt: 20, weight: "bold", color: ctx.theme.colorPrimary, role: "title" }));
  y += 16;
  const colW = (w - 8) / 2;
  let col = 0;
  let colY = [y, y];
  for (const s of sections.filter((x) => x.items.length)) {
    const lineH = 5.2;
    const h = 8 + s.items.reduce((acc, it) => acc + Math.max(1, Math.ceil(it.length / 48)) * lineH, 0);
    col = colY[0] <= colY[1] ? 0 : 1;
    if (colY[col] + h > ctx.heightMm - m - 8) {
      p = page(ctx, "kit_guide");
      pages.push(p);
      colY = [m, m];
      col = 0;
    }
    p.layout.blocks.push(list({ title: s.title, items: s.items, x: m + col * (colW + 8), y: colY[col], w: colW, h, pt: 9.5 }));
    colY[col] += h + 5;
  }
  return pages;
}

/** Idée de farce / d'activité : une page par idée. */
export function buildIdeaPage(ctx: BuildContext, idea: PranksKit["idees"][number], img?: KitImage): BuiltPage {
  const p = page(ctx, "kit_idea", CREAM);
  const m = ctx.theme.marginMm;
  const w = ctx.widthMm - 2 * m;
  p.layout.blocks.push(shape({ x: m, y: m, w: 18, h: 18, color: ctx.theme.colorSecondary, shape: "circle" }));
  p.layout.blocks.push(text({ text: String(idea.numero), x: m, y: m + 4, w: 18, h: 10, pt: 18, align: "center", weight: "bold", color: "#ffffff" }));
  p.layout.blocks.push(text({ text: idea.titre, x: m + 24, y: m + 1, w: w - 24, h: 12, pt: 20, weight: "bold", color: ctx.theme.colorPrimary, role: "title" }));
  p.layout.blocks.push(text({ text: [idea.resume, [`${idea.temps_minutes} min`, ["Très facile", "Facile", "Grand jeu"][Math.min(2, Math.max(0, idea.difficulte - 1))], idea.age_conseille ? `${idea.age_conseille.replace("+", "")} ans et +` : ""].filter(Boolean).join(" · ")].filter(Boolean).join("\n"), x: m + 24, y: m + 13, w: w - 24, h: 14, pt: 10, color: "#4b5563" }));
  const imgY = m + 32;
  const imgH = ctx.heightMm * 0.3;
  // Cadre paysage (3:2 à moins de 25 %), centré
  const imgW = Math.min(w, imgH * 1.6);
  p.layout.blocks.push(image({ x: m + (w - imgW) / 2, y: imgY, w: imgW, h: imgH, img, alt: idea.illustration_description || idea.titre, radius: 5 }));
  const y = imgY + imgH + 6;
  const colW = (w - 8) / 2;
  const bottomH = ctx.heightMm - y - m - 40;
  p.layout.blocks.push(list({ title: "Matériel", items: idea.materiel.length ? idea.materiel : ["Rien de spécial"], x: m, y, w: colW, h: bottomH, pt: 10 }));
  p.layout.blocks.push(list({ title: "Préparation", items: idea.preparation, x: m + colW + 8, y, w: colW, h: bottomH, pt: 10 }));
  if (idea.message_du_lutin) p.layout.blocks.push(text({ text: `Mot à laisser : « ${idea.message_du_lutin} »`, x: m, y: ctx.heightMm - m - 34, w, h: 18, pt: 11, background: PAPER, padding: 4, radius: 4, weight: "bold" }));
  if (idea.variante_sans_materiel) p.layout.blocks.push(text({ text: `Sans matériel : ${idea.variante_sans_materiel}`, x: m, y: ctx.heightMm - m - 14, w, h: 9, pt: 9, color: "#6b7280" }));
  return p;
}

/** Calendrier 24 cases (à cocher) + idées de réserve. */
export function buildCalendarPage(ctx: BuildContext, ideas: PranksKit["idees"], reserve: PranksKit["idees_reserve"]): BuiltPage {
  const p = page(ctx, "kit_calendar");
  const m = ctx.theme.marginMm;
  const w = ctx.widthMm - 2 * m;
  p.layout.blocks.push(text({ text: "Mon calendrier de farces", x: m, y: m, w, h: 12, pt: 20, weight: "bold", align: "center", color: ctx.theme.colorPrimary, role: "title" }));
  const cols = 4;
  const rows = 6;
  const gap = 3;
  const cw = (w - gap * (cols - 1)) / cols;
  const top = m + 16;
  const ch = (ctx.heightMm * 0.62 - gap * (rows - 1)) / rows;
  for (let d = 0; d < 24; d++) {
    const x = m + (d % cols) * (cw + gap);
    const y = top + Math.floor(d / cols) * (ch + gap);
    p.layout.blocks.push(shape({ x, y, w: cw, h: ch, color: d % 2 ? "#FDECEC" : "#EEF6EC", radius: 3, border: "#d1d5db" }));
    p.layout.blocks.push(text({ text: String(d + 1), x: x + 2, y: y + 1.5, w: 10, h: 7, pt: 12, weight: "bold", color: ctx.theme.colorSecondary }));
    p.layout.blocks.push(text({ text: "☐  idée n° ___", x: x + 2, y: y + ch - 8, w: cw - 4, h: 6, pt: 7.5, color: "#6b7280" }));
  }
  const ry = top + rows * (ch + gap) + 4;
  const items = reserve.length ? reserve.map((r) => `${r.titre}${r.resume ? ` : ${r.resume}` : ""}`) : ideas.slice(0, 6).map((i) => i.titre);
  p.layout.blocks.push(list({ title: "Idées de réserve", items, x: m, y: ry, w, h: ctx.heightMm - ry - m - 6, pt: 9 }));
  return p;
}

/** Petits mots à découper : 10 par page (2 × 5). */
export function buildNotesPage(ctx: BuildContext, notes: string[], signature: string): BuiltPage {
  const p = page(ctx, "kit_notes");
  grid(ctx, 5).slice(0, Math.min(10, notes.length)).forEach((cell, i) => {
    p.layout.blocks.push(shape({ x: cell.x, y: cell.y, w: cell.w, h: cell.h, color: i % 2 ? "#FFF4E6" : "#EEF6EC", radius: 4, border: "#d1d5db" }));
    p.layout.blocks.push(text({ text: notes[i], x: cell.x + 4, y: cell.y + 4, w: cell.w - 8, h: cell.h - 14, pt: 10.5, align: "center" }));
    if (signature) p.layout.blocks.push(text({ text: `— ${signature}`, x: cell.x + 4, y: cell.y + cell.h - 9, w: cell.w - 8, h: 6, pt: 8.5, align: "right", weight: "bold", color: ctx.theme.colorSecondary }));
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
