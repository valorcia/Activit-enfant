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
import { tint, type KitImage, type KitImages } from "./pages";

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
  return { id: newId("i"), type: "image", role: "decoration", illustrationId: o.img?.illustrationId, src: o.img?.src, alt: o.alt, caption: "", isDemo: o.img?.isDemo ?? false, fit: "cover", x: o.x, y: o.y, w: o.w, h: o.h, editable: true, style: { radius: 7 } };
}
function bullets(o: { items: string[]; title?: string; x: number; y: number; w: number; h: number; pt: number; role?: "bullets" | "materials" | "warnings"; background?: string }): Block {
  return { id: newId("l"), type: "list", role: o.role ?? "bullets", items: o.items, title: o.title, x: o.x, y: o.y, w: o.w, h: o.h, editable: true, style: { fontSizePt: o.pt, background: o.background, padding: o.background ? LIST_PAD : undefined, radius: o.background ? 6 : undefined } };
}

const INK = "#1F2937";
const MUTED = "#64748B";
const LIST_PAD = 4.5;

/** Flux vertical multi-pages. */
class Flow {
  pages: BuiltPage[] = [];
  y = 0;
  readonly m: number;
  readonly w: number;
  readonly bottom: number;
  /** Rappel de rubrique en haut des pages de suite. */
  running = "";
  constructor(private ctx: BuildContext, private templateKey: string, private background = "#ffffff") {
    this.m = ctx.theme.marginMm;
    this.w = ctx.widthMm - 2 * this.m;
    this.bottom = ctx.heightMm - this.m - 8;
    this.newPage();
  }
  private get soft() {
    return tint(this.ctx.theme.colorPrimary, 0.045);
  }
  /** En-tête de rubrique : étiquette, grand titre, trait de couleur, pastilles d'infos. */
  header(eyebrow: string, title: string, pills: string[] = []) {
    const t = this.ctx.theme;
    this.running = eyebrow;
    this.blocks.push(txt({ text: eyebrow.toUpperCase(), x: this.m, y: this.y - 2, w: this.w, h: 6, pt: 8.5, weight: "bold", color: t.colorSecondary, role: "label" }));
    this.y += 4.5;
    const th = estimateTextHeightMm(title, this.w, 22, 1.12) + 2;
    this.blocks.push(txt({ text: title, x: this.m, y: this.y, w: this.w, h: th, pt: 22, weight: "bold", color: INK, role: "title", lineHeight: 1.12 }));
    this.y += th + 1;
    this.blocks.push(rect({ x: this.m, y: this.y, w: 18, h: 1.6, color: t.colorSecondary, radius: 1 }));
    this.y += 6;
    if (pills.length) {
      let x = this.m;
      for (const p of pills.filter(Boolean)) {
        const pw = Math.min(this.w, Math.max(22, p.length * 2.25 + 10));
        if (x + pw > this.m + this.w) { x = this.m; this.y += 10; }
        this.blocks.push(txt({ text: p, x, y: this.y, w: pw, h: 8, pt: 9.5, align: "center", weight: "bold", background: tint(t.colorSecondary, 0.13), padding: 1.4, radius: 4, color: INK }));
        x += pw + 3;
      }
      this.y += 12;
    }
  }
  get blocks() {
    return this.pages[this.pages.length - 1].layout.blocks;
  }
  newPage(templateKey = this.templateKey) {
    const layout: PageLayout = { widthMm: this.ctx.widthMm, heightMm: this.ctx.heightMm, showPageNumber: true, background: this.background, blocks: [] };
    this.pages.push({ templateKey, layout });
    this.y = this.m;
    if (this.running && this.pages.length > 1) {
      layout.blocks.push(txt({ text: `${this.running.toUpperCase()} · SUITE`, x: this.m, y: this.m - 2, w: this.w, h: 6, pt: 8, weight: "bold", color: MUTED, role: "label" }));
      this.y += 6;
    }
  }
  /** Réserve `h` mm ; change de page si nécessaire (sauf en haut de page). */
  need(h: number) {
    if (this.y + h > this.bottom && this.y > this.m + 1) this.newPage();
  }
  heading(text: string, pt = 15, color = this.ctx.theme.colorPrimary) {
    const h = estimateTextHeightMm(text, this.w, pt, 1.2) + 2;
    this.need(h + 18);
    this.y += 1;
    this.blocks.push(txt({ text, x: this.m, y: this.y, w: this.w, h, pt, weight: "bold", color, role: "heading", lineHeight: 1.2 }));
    this.y += h + 2.5;
  }
  para(text: string, pt = this.ctx.theme.baseFontPt, opts: { color?: string } = {}) {
    if (!text.trim()) return;
    for (const chunk of splitLong(text, pt, this.w, this.bottom - this.m - 4)) {
      const h = estimateTextHeightMm(chunk, this.w, pt, 1.5) + 2;
      this.need(h);
      this.blocks.push(txt({ text: chunk, x: this.m, y: this.y, w: this.w, h, pt, lineHeight: 1.5, color: opts.color ?? INK }));
      this.y += h + 3;
    }
  }
  /** Liste dans une carte teintée (titre, puces, cases ☐ pour le matériel). */
  list(title: string | undefined, items: string[], pt = this.ctx.theme.baseFontPt, role: "bullets" | "materials" | "warnings" = "bullets") {
    if (!items.length) return;
    const bg = role === "warnings" ? WARN_PANEL : this.soft;
    const hOf = (xs: string[]) => listHeight(xs, this.w, pt, LIST_PAD) + 1;
    let rest = items;
    while (rest.length) {
      let n = rest.length;
      while (n > 1 && hOf(rest.slice(0, n)) > this.bottom - this.m - 8) n--;
      const part = rest.slice(0, n);
      const h = hOf(part);
      this.need(h);
      this.blocks.push(bullets({ items: part, title, x: this.m, y: this.y, w: this.w, h, pt, role, background: bg }));
      this.y += h + 5;
      rest = rest.slice(n);
    }
  }
  /** Deux listes côte à côte (ingrédients / matériel à gauche, étapes à droite) si elles tiennent. */
  twoLists(a: { title: string; items: string[]; role?: "bullets" | "materials" }, b: { title: string; items: string[]; role?: "bullets" | "materials" }, pt = this.ctx.theme.baseFontPt) {
    const gap = 6;
    const wl = (this.w - gap) * 0.42;
    const wr = this.w - gap - wl;
    const ha = a.items.length ? listHeight(a.items, wl, pt, LIST_PAD) + 1 : 0;
    const hb = b.items.length ? listHeight(b.items, wr, pt, LIST_PAD) + 1 : 0;
    const h = Math.max(ha, hb);
    if (!a.items.length || !b.items.length || h > this.bottom - this.m - 8) {
      this.list(a.title, a.items, pt, a.role);
      this.list(b.title, b.items, pt, b.role);
      return;
    }
    this.need(h);
    this.blocks.push(bullets({ items: a.items, title: a.title, x: this.m, y: this.y, w: wl, h, pt, role: a.role, background: this.soft }));
    this.blocks.push(bullets({ items: b.items, title: b.title, x: this.m + wl + gap, y: this.y, w: wr, h, pt, role: b.role, background: this.soft }));
    this.y += h + 5;
  }
  /** Encadré coloré (conseil, attention, astuce…). */
  box(label: string, body: string, color: string, panel: string) {
    if (!body.trim()) return;
    const pt = this.ctx.theme.baseFontPt;
    const bh = estimateTextHeightMm(body, this.w - 14, pt, 1.45);
    const h = bh + 16;
    this.need(h);
    this.blocks.push(rect({ x: this.m, y: this.y, w: this.w, h, color: panel, radius: 6 }));
    this.blocks.push(rect({ x: this.m, y: this.y, w: 2.4, h, color, radius: 1.2 }));
    this.blocks.push(txt({ text: label.toUpperCase(), x: this.m + 8, y: this.y + 3.5, w: this.w - 13, h: 6, pt: 8.5, weight: "bold", color }));
    this.blocks.push(txt({ text: body, x: this.m + 8, y: this.y + 10, w: this.w - 13, h: bh + 2, pt, lineHeight: 1.45, color: INK }));
    this.y += h + 5;
  }
  /** Tableau simple (en-tête + lignes) en blocs texte. */
  table(title: string, cols: string[], rows: string[][]) {
    if (!cols.length || !rows.length) return;
    const pt = Math.max(8, this.ctx.theme.baseFontPt - 1.5);
    const cw = this.w / cols.length;
    const rowH = (cells: string[]) => Math.max(...cells.map((c) => estimateTextHeightMm(c || " ", cw - 4, pt, 1.35))) + 4;
    if (title) {
      this.need(8 + rowH(cols) + rowH(rows[0] ?? cols));
      this.blocks.push(txt({ text: title, x: this.m, y: this.y, w: this.w, h: 6, pt: pt + 1, weight: "bold", color: this.ctx.theme.colorPrimary }));
      this.y += 7;
    }
    const drawRow = (cells: string[], header: boolean, i: number) => {
      const h = rowH(cells);
      this.need(h);
      this.blocks.push(rect({ x: this.m, y: this.y, w: this.w, h, color: header ? this.ctx.theme.colorPrimary : i % 2 ? "#ffffff" : this.soft, radius: header ? 3 : 0 }));
      cols.forEach((_, c) => {
        this.blocks.push(txt({ text: cells[c] ?? "", x: this.m + c * cw + 2.5, y: this.y + 2, w: cw - 5, h: h - 3, pt, weight: header || c === 0 ? "bold" : "normal", color: header ? "#ffffff" : INK, lineHeight: 1.35 }));
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
    // Cadre paysage (3:2 à moins de 25 %), centré : l'image n'est pas rognée en bandeau
    const w = Math.min(this.w, h * 1.6);
    this.blocks.push(img({ x: this.m + (this.w - w) / 2, y: this.y, w, h, img: image, alt }));
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
  intro.header("Introduction", "Ce que vous allez apprendre", g.auteur?.nom ? [`${g.auteur.nom}${g.auteur.expertise ? ` · ${g.auteur.expertise}` : ""}`] : []);
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
    f.header("Comprendre", g.probleme?.titre || "Comprendre le problème");
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
    f.header(`Chapitre ${c.numero}`, c.titre);
    if (c.resume) f.para(c.resume, t.baseFontPt + 1, { color: MUTED });
    f.image(images[`chapitre-${c.numero}`], c.illustration_description || c.titre, 0.24);
    f.para(c.contenu);
    if (c.etapes.length) f.list("Pas à pas", c.etapes.map((e, i) => `${i + 1}. ${e}`));
    if (c.tableau && c.tableau.colonnes.length) f.table(c.tableau.titre ?? "", c.tableau.colonnes, c.tableau.lignes);
    f.box("Conseil", c.conseil ?? "", t.colorSecondary, tint(t.colorSecondary, 0.1));
    f.box("Attention", c.attention ?? "", WARN, WARN_PANEL);
    pages.push(...f.pages);
  }

  // Annexes
  const a = new Flow(ctx, "guide_annex");
  a.header("À garder sous la main", "L'essentiel");
  if (g.erreurs.length) {
    a.heading("Les erreurs à éviter");
    a.table("", ["Erreur", "La bonne pratique"], g.erreurs.map((e) => [e.erreur, e.solution ?? ""]));
  }
  if (g.checklist?.items?.length) {
    a.heading(g.checklist.titre || "Checklist");
    a.list(undefined, g.checklist.items, t.baseFontPt, "materials"); // rendu avec des cases ☐
  }
  if (g.calendrier.length) {
    a.heading("Calendrier");
    a.table("", ["Période", "Actions"], g.calendrier.map((c) => [c.periode, c.actions.join(" · ")]));
  }
  if (g.faq.length) {
    a.heading("Questions fréquentes");
    for (const q of g.faq) {
      a.need(estimateTextHeightMm(q.question, a.w, t.baseFontPt, 1.5) + Math.min(40, estimateTextHeightMm(q.reponse, a.w, t.baseFontPt, 1.5)) + 8); // question et début de réponse sur la même page
      a.para(q.question, t.baseFontPt + 0.5, { color: t.colorPrimary });
      a.para(q.reponse);
    }
  }
  if (g.glossaire.length) {
    a.heading("Glossaire");
    a.list(undefined, g.glossaire.map((x) => `${x.terme} : ${x.definition}`));
  }
  if (g.securite.length) {
    a.heading("Sécurité", 15, WARN);
    a.list(undefined, g.securite, t.baseFontPt, "warnings");
  }
  if (a.pages[0].layout.blocks.length > 3) pages.push(...a.pages);
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
  intro.header("Avant de commencer", "En cuisine !");
  intro.para(r.introduction);
  if (r.conseils.length) intro.list("Nos conseils", r.conseils);
  intro.heading("Les recettes");
  intro.list(undefined, r.recettes.map((x) => `${x.numero}. ${x.titre}`));
  pages.push(...intro.pages);

  for (const x of r.recettes) {
    const f = new Flow(ctx, "recipe");
    f.header(`Recette ${x.numero}`, x.titre, [`${x.portions} pers.`, `Prép. ${x.temps_preparation_minutes} min`, x.temps_cuisson_minutes ? `Cuisson ${x.temps_cuisson_minutes} min` : "Sans cuisson", DIFFICULTY[Math.min(2, Math.max(0, x.difficulte - 1))]]);
    if (x.resume) f.para(x.resume, t.baseFontPt + 1, { color: MUTED });
    f.image(images[`recette-${x.numero}`], x.illustration_description || x.titre, 0.26);
    f.twoLists({ title: "Ingrédients", items: x.ingredients, role: "materials" }, { title: "Préparation", items: x.etapes.map((e, i) => `${i + 1}. ${e}`) });
    f.box("Astuce", x.astuce ?? "", t.colorSecondary, tint(t.colorSecondary, 0.1));
    if (x.allergenes.length) f.para(`Allergènes : ${x.allergenes.join(", ")}`, t.baseFontPt - 1.5, { color: MUTED });
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
  intro.header("Bienvenue au labo", s.personnage?.nom ? `Le mot de ${s.personnage.nom}` : "Bienvenue au labo !");
  intro.image(images["planche-personnage"], s.personnage?.nom || "Le personnage", 0.26);
  intro.para(s.introduction, t.baseFontPt + 1);
  if (s.securite_generale.length) intro.box("Les règles du labo", s.securite_generale.map((x) => `• ${x}`).join("\n"), WARN, WARN_PANEL);
  pages.push(...intro.pages);

  for (const e of s.experiences) {
    const f = new Flow(ctx, "science_experiment");
    f.header(`Expérience ${e.numero}`, e.titre, [`${e.duree_minutes} min`, DIFFICULTY[Math.min(2, Math.max(0, e.difficulte - 1))], e.age_conseille ? `Dès ${e.age_conseille.replace("+", "")} ans` : ""]);
    if (e.question) f.box("La question", e.question, t.colorSecondary, tint(t.colorSecondary, 0.1));
    f.image(images[`experience-${e.numero}`], e.illustration_description || e.titre, 0.24);
    f.twoLists({ title: "Matériel", items: e.materiel.length ? e.materiel : ["Rien de spécial"], role: "materials" }, { title: "Étapes", items: e.etapes.map((x, i) => `${i + 1}. ${x}`) });
    f.box("Que s'est-il passé ?", e.explication, t.colorPrimary, tint(t.colorPrimary, 0.06));
    f.box("Pour aller plus loin", e.pour_aller_plus_loin ?? "", t.colorAccent, tint(t.colorAccent, 0.1));
    if (e.securite.length) f.box("Sécurité", e.securite.map((x) => `• ${x}`).join("\n"), WARN, WARN_PANEL);
    pages.push(...f.pages);
  }
  return pages;
}
