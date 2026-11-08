/**
 * Gabarits de pages des univers « adultes » et éducatifs : guide pratique, livre de recettes,
 * fiches d'expériences scientifiques. Même principe que `pages.ts` : des blocs positionnés en mm,
 * compatibles avec l'aperçu, l'éditeur et l'export PDF. La mise en page est un flux vertical :
 * chaque élément mesure sa hauteur estimée et passe à la page suivante s'il ne tient plus.
 */
import type { Block, PageLayout } from "../schemas/layout";
import type { BuildContext, BuiltPage } from "../layout/engine";
import { listHeight } from "../layout/engine";
import { estimateTextHeightMm } from "../layout/formats";
import { newId } from "../utils";
import type { Guide, Recipes, Science } from "./schemas";
import type { KitImage, KitImages } from "./pages";

type Role = "title" | "subtitle" | "heading" | "body" | "caption" | "label";

function txt(o: { text: string; x: number; y: number; w: number; h: number; role?: Role; pt?: number; align?: "left" | "center" | "right" | "justify"; weight?: "normal" | "bold"; color?: string; background?: string; padding?: number; radius?: number; border?: string; lineHeight?: number }): Block {
  return {
    id: newId("t"), type: "text", role: o.role ?? "body", text: o.text, x: o.x, y: o.y, w: o.w, h: o.h, editable: true,
    style: { fontSizePt: o.pt, align: o.align, weight: o.weight, color: o.color, background: o.background, padding: o.padding, radius: o.radius, borderColor: o.border, lineHeight: o.lineHeight },
  };
}
function rect(o: { x: number; y: number; w: number; h: number; color: string; radius?: number; border?: string; shape?: "rect" | "circle" }): Block {
  return { id: newId("s"), type: "shape", shape: o.shape ?? "rect", color: o.color, x: o.x, y: o.y, w: o.w, h: o.h, editable: true, style: { radius: o.radius, borderColor: o.border } };
}
function img(o: { x: number; y: number; w: number; h: number; img?: KitImage; alt: string }): Block {
  return { id: newId("i"), type: "image", role: "decoration", illustrationId: o.img?.illustrationId, src: o.img?.src, alt: o.alt, caption: "", isDemo: o.img?.isDemo ?? false, fit: "cover", x: o.x, y: o.y, w: o.w, h: o.h, editable: true, style: { radius: 4 } };
}
function bullets(o: { items: string[]; title?: string; x: number; y: number; w: number; h: number; pt: number; role?: "bullets" | "materials" | "warnings" }): Block {
  return { id: newId("l"), type: "list", role: o.role ?? "bullets", items: o.items, title: o.title, x: o.x, y: o.y, w: o.w, h: o.h, editable: true, style: { fontSizePt: o.pt } };
}

/** Flux vertical multi-pages. */
class Flow {
  pages: BuiltPage[] = [];
  y = 0;
  readonly m: number;
  readonly w: number;
  readonly bottom: number;
  constructor(private ctx: BuildContext, private templateKey: string, private background?: string) {
    this.m = ctx.theme.marginMm;
    this.w = ctx.widthMm - 2 * this.m;
    this.bottom = ctx.heightMm - this.m - 8;
    this.newPage();
  }
  get blocks() {
    return this.pages[this.pages.length - 1].layout.blocks;
  }
  newPage(templateKey = this.templateKey) {
    const layout: PageLayout = { widthMm: this.ctx.widthMm, heightMm: this.ctx.heightMm, showPageNumber: true, background: this.background, blocks: [] };
    this.pages.push({ templateKey, layout });
    this.y = this.m;
  }
  /** Réserve `h` mm ; change de page si nécessaire (sauf en haut de page). */
  need(h: number) {
    if (this.y + h > this.bottom && this.y > this.m + 1) this.newPage();
  }
  heading(text: string, pt = 17, color = this.ctx.theme.colorPrimary) {
    const h = estimateTextHeightMm(text, this.w, pt, 1.2) + 2;
    this.need(h + 18);
    this.blocks.push(txt({ text, x: this.m, y: this.y, w: this.w, h, pt, weight: "bold", color, role: "heading", lineHeight: 1.2 }));
    this.y += h + 3;
  }
  para(text: string, pt = this.ctx.theme.baseFontPt, opts: { color?: string } = {}) {
    if (!text.trim()) return;
    for (const chunk of splitLong(text, pt, this.w, this.bottom - this.m - 4)) {
      const h = estimateTextHeightMm(chunk, this.w, pt, 1.5) + 2;
      this.need(h);
      this.blocks.push(txt({ text: chunk, x: this.m, y: this.y, w: this.w, h, pt, lineHeight: 1.5, color: opts.color }));
      this.y += h + 3;
    }
  }
  list(title: string | undefined, items: string[], pt = this.ctx.theme.baseFontPt, role: "bullets" | "materials" | "warnings" = "bullets") {
    if (!items.length) return;
    let rest = items;
    while (rest.length) {
      let n = rest.length;
      while (n > 1 && listHeight(rest.slice(0, n), this.w, pt) > this.bottom - this.m) n--;
      const part = rest.slice(0, n);
      const h = listHeight(part, this.w, pt);
      this.need(h);
      this.blocks.push(bullets({ items: part, title, x: this.m, y: this.y, w: this.w, h, pt, role }));
      this.y += h + 4;
      rest = rest.slice(n);
    }
  }
  /** Encadré coloré (conseil, attention, astuce…). */
  box(label: string, body: string, color: string, panel: string) {
    if (!body.trim()) return;
    const pt = this.ctx.theme.baseFontPt;
    const bh = estimateTextHeightMm(body, this.w - 14, pt, 1.45);
    const h = bh + 16;
    this.need(h);
    this.blocks.push(rect({ x: this.m, y: this.y, w: this.w, h, color: panel, radius: 3, border: color }));
    this.blocks.push(rect({ x: this.m, y: this.y, w: 2.2, h, color }));
    this.blocks.push(txt({ text: label.toUpperCase(), x: this.m + 7, y: this.y + 3, w: this.w - 12, h: 6, pt: 8.5, weight: "bold", color }));
    this.blocks.push(txt({ text: body, x: this.m + 7, y: this.y + 10, w: this.w - 12, h: bh + 2, pt, lineHeight: 1.45 }));
    this.y += h + 4;
  }
  /** Tableau simple (en-tête + lignes) en blocs texte. */
  table(title: string, cols: string[], rows: string[][]) {
    if (!cols.length || !rows.length) return;
    const pt = Math.max(8, this.ctx.theme.baseFontPt - 1.5);
    const cw = this.w / cols.length;
    const rowH = (cells: string[]) => Math.max(...cells.map((c) => estimateTextHeightMm(c || " ", cw - 4, pt, 1.35))) + 4;
    if (title) {
      this.need(8 + rowH(cols) + rowH(rows[0] ?? cols));
      this.blocks.push(txt({ text: title, x: this.m, y: this.y, w: this.w, h: 6, pt: pt + 0.5, weight: "bold", color: this.ctx.theme.colorPrimary }));
      this.y += 7;
    }
    const drawRow = (cells: string[], header: boolean, i: number) => {
      const h = rowH(cells);
      this.need(h);
      this.blocks.push(rect({ x: this.m, y: this.y, w: this.w, h, color: header ? this.ctx.theme.colorPrimary : i % 2 ? "#ffffff" : this.ctx.theme.colorPanel, border: "#d1d5db" }));
      cols.forEach((_, c) => {
        this.blocks.push(txt({ text: cells[c] ?? "", x: this.m + c * cw + 2, y: this.y + 2, w: cw - 4, h: h - 3, pt, weight: header ? "bold" : "normal", color: header ? "#ffffff" : undefined, lineHeight: 1.35 }));
      });
      this.y += h;
    };
    drawRow(cols, true, 0);
    rows.forEach((r, i) => drawRow(r, false, i));
    this.y += 5;
  }
  image(image: KitImage | undefined, alt: string, ratio = 0.28) {
    if (!image?.src) return;
    const h = this.ctx.heightMm * ratio;
    this.need(h + 4);
    this.blocks.push(img({ x: this.m, y: this.y, w: this.w, h, img: image, alt }));
    this.y += h + 5;
  }
  space(mm: number) {
    this.y += mm;
  }
}

/** Découpe un texte trop long pour une page en paragraphes successifs. */
function splitLong(text: string, pt: number, w: number, maxH: number): string[] {
  if (estimateTextHeightMm(text, w, pt, 1.5) <= maxH) return [text];
  const paras = text.split(/\n+/);
  const out: string[] = [];
  let cur = "";
  for (const p of paras) {
    const next = cur ? `${cur}\n${p}` : p;
    if (cur && estimateTextHeightMm(next, w, pt, 1.5) > maxH) {
      out.push(cur);
      cur = p;
    } else cur = next;
  }
  if (cur) out.push(cur);
  return out;
}

// ---------------------------------------------------------------------------
// Guide pratique
// ---------------------------------------------------------------------------

const WARN = "#B42318";
const WARN_PANEL = "#FEF3F2";

export function buildGuideBookPages(ctx: BuildContext, g: Guide, images: KitImages): BuiltPage[] {
  const t = ctx.theme;
  const pages: BuiltPage[] = [];

  // Introduction + sommaire
  const intro = new Flow(ctx, "guide_intro");
  intro.heading("Introduction", 20);
  if (g.auteur?.nom) intro.para(`${g.auteur.nom}${g.auteur.expertise ? ` — ${g.auteur.expertise}` : ""}`, t.baseFontPt - 1, { color: "#6b7280" });
  intro.para(g.introduction);
  intro.space(4);
  intro.heading("Sommaire", 15);
  intro.list(undefined, [
    ...(g.probleme?.texte || g.causes.length ? ["Comprendre le problème"] : []),
    ...(g.diagnostic.length ? ["Diagnostic express"] : []),
    ...g.chapitres.map((c) => `${c.numero}. ${c.titre}`),
    ...(g.erreurs.length ? ["Les erreurs à éviter"] : []),
    ...(g.checklist?.items?.length ? ["Checklist"] : []),
    ...(g.calendrier.length ? ["Calendrier"] : []),
    ...(g.faq.length ? ["Questions fréquentes"] : []),
    ...(g.glossaire.length ? ["Glossaire"] : []),
    ...(g.securite.length ? ["Sécurité"] : []),
  ]);
  pages.push(...intro.pages);

  // Problème, causes, diagnostic
  if (g.probleme?.texte || g.causes.length || g.diagnostic.length) {
    const f = new Flow(ctx, "guide_problem");
    f.heading(g.probleme?.titre || "Comprendre le problème", 20);
    f.image(images["guide-probleme"], g.probleme?.titre || "Le problème", 0.26);
    if (g.probleme?.texte) f.para(g.probleme.texte);
    if (g.causes.length) {
      f.heading("Les causes possibles", 14, t.colorSecondary);
      for (const c of g.causes) f.para(`${c.titre}${c.explication ? ` — ${c.explication}` : ""}`);
    }
    if (g.diagnostic.length) {
      f.heading("Diagnostic express", 14, t.colorSecondary);
      f.table("", ["Question", "Si oui", "Si non"], g.diagnostic.map((d) => [d.question, d.si_oui ?? "", d.si_non ?? ""]));
    }
    pages.push(...f.pages);
  }

  // Chapitres : chacun commence sur une nouvelle page
  for (const c of g.chapitres) {
    const f = new Flow(ctx, "guide_chapter");
    f.blocks.push(rect({ x: f.m, y: f.y, w: 16, h: 16, color: t.colorPrimary, radius: 3 }));
    f.blocks.push(txt({ text: String(c.numero), x: f.m, y: f.y + 3.5, w: 16, h: 9, pt: 16, align: "center", weight: "bold", color: "#ffffff" }));
    const titleH = estimateTextHeightMm(c.titre, f.w - 22, 18, 1.2) + 2;
    f.blocks.push(txt({ text: c.titre, x: f.m + 22, y: f.y, w: f.w - 22, h: Math.max(16, titleH), pt: 18, weight: "bold", color: t.colorPrimary, role: "title", lineHeight: 1.2 }));
    f.y += Math.max(16, titleH) + 4;
    if (c.resume) f.para(c.resume, t.baseFontPt, { color: "#4b5563" });
    f.image(images[`chapitre-${c.numero}`], c.illustration_description || c.titre, 0.24);
    f.para(c.contenu);
    if (c.etapes.length) f.list("Pas à pas", c.etapes.map((e, i) => `${i + 1}. ${e}`));
    if (c.tableau && c.tableau.colonnes.length) f.table(c.tableau.titre ?? "", c.tableau.colonnes, c.tableau.lignes);
    f.box("Conseil", c.conseil ?? "", t.colorSecondary, t.colorPanel);
    f.box("Attention", c.attention ?? "", WARN, WARN_PANEL);
    pages.push(...f.pages);
  }

  // Annexes
  const a = new Flow(ctx, "guide_annex");
  if (g.erreurs.length) {
    a.heading("Les erreurs à éviter", 17);
    a.table("", ["Erreur", "La bonne pratique"], g.erreurs.map((e) => [e.erreur, e.solution ?? ""]));
  }
  if (g.checklist?.items?.length) {
    a.heading(g.checklist.titre || "Checklist", 17);
    a.list(undefined, g.checklist.items, t.baseFontPt, "materials"); // rendu avec des cases ☐
  }
  if (g.calendrier.length) {
    a.heading("Calendrier", 17);
    a.table("", ["Période", "Actions"], g.calendrier.map((c) => [c.periode, c.actions.join(" · ")]));
  }
  if (g.faq.length) {
    a.heading("Questions fréquentes", 17);
    for (const q of g.faq) {
      a.need(estimateTextHeightMm(q.question, a.w, t.baseFontPt, 1.5) + Math.min(40, estimateTextHeightMm(q.reponse, a.w, t.baseFontPt, 1.5)) + 8); // question et début de réponse sur la même page
      a.para(`Q. ${q.question}`, t.baseFontPt, { color: t.colorPrimary });
      a.para(q.reponse);
    }
  }
  if (g.glossaire.length) {
    a.heading("Glossaire", 17);
    a.list(undefined, g.glossaire.map((x) => `${x.terme} : ${x.definition}`));
  }
  if (g.securite.length) {
    a.heading("Sécurité", 17, WARN);
    a.list(undefined, g.securite, t.baseFontPt, "warnings");
  }
  if (a.pages[0].layout.blocks.length) pages.push(...a.pages);
  return pages;
}

// ---------------------------------------------------------------------------
// Livre de recettes
// ---------------------------------------------------------------------------

const DIFFICULTY = ["Facile", "Intermédiaire", "Confirmé"];

export function buildRecipesBookPages(ctx: BuildContext, r: Recipes, images: KitImages): BuiltPage[] {
  const t = ctx.theme;
  const pages: BuiltPage[] = [];
  const intro = new Flow(ctx, "recipes_intro");
  intro.heading("Avant de commencer", 20);
  intro.para(r.introduction);
  if (r.conseils.length) intro.list("Nos conseils", r.conseils);
  intro.heading("Les recettes", 15);
  intro.list(undefined, r.recettes.map((x) => `${x.numero}. ${x.titre}`));
  pages.push(...intro.pages);

  for (const x of r.recettes) {
    const f = new Flow(ctx, "recipe");
    f.heading(x.titre, 20);
    const meta = [`${x.portions} portion${x.portions > 1 ? "s" : ""}`, `Préparation ${x.temps_preparation_minutes} min`, x.temps_cuisson_minutes ? `Cuisson ${x.temps_cuisson_minutes} min` : "Sans cuisson", DIFFICULTY[Math.min(2, Math.max(0, x.difficulte - 1))]].join(" · ");
    f.blocks.push(txt({ text: meta, x: f.m, y: f.y, w: f.w, h: 7, pt: 9.5, weight: "bold", color: t.colorSecondary }));
    f.y += 9;
    if (x.resume) f.para(x.resume, t.baseFontPt, { color: "#4b5563" });
    f.image(images[`recette-${x.numero}`], x.illustration_description || x.titre, 0.26);
    f.list("Ingrédients", x.ingredients, t.baseFontPt, "materials");
    f.list("Préparation", x.etapes.map((e, i) => `${i + 1}. ${e}`));
    f.box("Astuce", x.astuce ?? "", t.colorSecondary, t.colorPanel);
    if (x.allergenes.length) f.para(`Allergènes : ${x.allergenes.join(", ")}`, t.baseFontPt - 1.5, { color: "#6b7280" });
    pages.push(...f.pages);
  }
  return pages;
}

// ---------------------------------------------------------------------------
// Fiches d'expériences scientifiques
// ---------------------------------------------------------------------------

export function buildScienceBookPages(ctx: BuildContext, s: Science, images: KitImages): BuiltPage[] {
  const t = ctx.theme;
  const pages: BuiltPage[] = [];
  const intro = new Flow(ctx, "science_intro");
  intro.image(images["planche-personnage"], s.personnage?.nom || "Le personnage", 0.26);
  intro.heading(s.personnage?.nom ? `Le mot de ${s.personnage.nom}` : "Bienvenue au labo !", 20);
  intro.para(s.introduction, t.baseFontPt + 1);
  if (s.securite_generale.length) intro.box("Les règles du labo", s.securite_generale.map((x) => `• ${x}`).join("\n"), WARN, WARN_PANEL);
  pages.push(...intro.pages);

  for (const e of s.experiences) {
    const f = new Flow(ctx, "science_experiment");
    f.blocks.push(rect({ x: f.m, y: f.y, w: 16, h: 16, color: t.colorSecondary, shape: "circle" }));
    f.blocks.push(txt({ text: String(e.numero), x: f.m, y: f.y + 3.5, w: 16, h: 9, pt: 16, align: "center", weight: "bold", color: "#ffffff" }));
    f.blocks.push(txt({ text: e.titre, x: f.m + 22, y: f.y, w: f.w - 22, h: 16, pt: 18, weight: "bold", color: t.colorPrimary, role: "title" }));
    f.y += 19;
    f.para([e.question, [`${e.duree_minutes} min`, DIFFICULTY[Math.min(2, Math.max(0, e.difficulte - 1))], e.age_conseille ? `dès ${e.age_conseille.replace("+", "")} ans` : ""].filter(Boolean).join(" · ")].filter(Boolean).join("\n"), t.baseFontPt, { color: "#4b5563" });
    f.image(images[`experience-${e.numero}`], e.illustration_description || e.titre, 0.24);
    f.list("Matériel", e.materiel.length ? e.materiel : ["Rien de spécial"], t.baseFontPt, "materials");
    f.list("Étapes", e.etapes.map((x, i) => `${i + 1}. ${x}`));
    f.box("Que s'est-il passé ?", e.explication, t.colorPrimary, t.colorPanel);
    f.box("Pour aller plus loin", e.pour_aller_plus_loin ?? "", t.colorAccent, "#FFFBEB");
    if (e.securite.length) f.box("Sécurité", e.securite.map((x) => `• ${x}`).join("\n"), WARN, WARN_PANEL);
    pages.push(...f.pages);
  }
  return pages;
}
