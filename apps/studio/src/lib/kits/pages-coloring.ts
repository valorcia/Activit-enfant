/**
 * Gabarits du cahier de coloriage : une page A4 portrait par dessin (dessin plein cadre sur
 * fond blanc, petit titre en pied), page « Ce cahier appartient à… », exemple colorié,
 * sommaire facultatif, diplôme « Artiste en herbe », page blanche au dos de chaque dessin
 * en recto-verso (les feutres ne traversent pas sur le dessin suivant).
 */
import type { Block, PageLayout } from "../schemas/layout";
import type { BuildContext, BuiltPage } from "../layout/engine";
import { newId } from "../utils";
import type { Coloring, ColoringOptions } from "./schemas";
import type { KitImages } from "./pages";
import { COLORING_SLOTS } from "./coloring";

function page(ctx: BuildContext, templateKey: string, showPageNumber = true): BuiltPage {
  const layout: PageLayout = { widthMm: ctx.widthMm, heightMm: ctx.heightMm, showPageNumber, background: "#FFFFFF", blocks: [] };
  return { templateKey, layout };
}

const t = (o: { text: string; x: number; y: number; w: number; h: number; pt: number; align?: "left" | "center" | "right"; weight?: "normal" | "bold"; color?: string; role?: "title" | "subtitle" | "heading" | "body" | "caption" | "label"; lineHeight?: number }): Block => ({
  id: newId("t"), type: "text", role: o.role ?? "body", text: o.text, x: o.x, y: o.y, w: o.w, h: o.h, editable: true,
  style: { fontSizePt: o.pt, align: o.align ?? "center", weight: o.weight, color: o.color, lineHeight: o.lineHeight },
});

const frame = (x: number, y: number, w: number, h: number, color = "#1f2937"): Block => ({ id: newId("s"), type: "shape", shape: "rect", color: "#FFFFFF", x, y, w, h, editable: true, style: { radius: 6, borderColor: color } });

/** Zone utile d'un dessin (marges d'impression, pied réservé au titre). */
export function drawingFrame(ctx: BuildContext) {
  const m = Math.max(10, ctx.theme.marginMm - 2);
  return { x: m, y: m, w: ctx.widthMm - 2 * m, h: ctx.heightMm - 2 * m - 14 };
}

export function buildColoringPages(ctx: BuildContext, c: Coloring, images: KitImages, opts: ColoringOptions): BuiltPage[] {
  const W = ctx.widthMm;
  const H = ctx.heightMm;
  const m = ctx.theme.marginMm;
  const pages: BuiltPage[] = [];

  // « Ce cahier appartient à… »
  const owner = page(ctx, "coloring_owner", false);
  owner.layout.blocks.push(t({ text: c.page_appartient?.titre || "Ce cahier appartient à", x: m, y: m + 18, w: W - 2 * m, h: 16, pt: 28, weight: "bold", role: "title", color: ctx.theme.colorPrimary }));
  owner.layout.blocks.push(t({ text: opts.childName ? opts.childName : "_______________________", x: m, y: m + 40, w: W - 2 * m, h: 16, pt: opts.childName ? 30 : 22, weight: "bold" }));
  owner.layout.blocks.push(frame(m + 20, m + 66, W - 2 * m - 40, H * 0.42));
  owner.layout.blocks.push(t({ text: c.page_appartient?.texte || "Dessine-toi dans le cadre !", x: m + 20, y: m + 70 + H * 0.42, w: W - 2 * m - 40, h: 10, pt: 12, color: "#4b5563" }));
  if (c.introduction) owner.layout.blocks.push(t({ text: c.introduction, x: m, y: H - m - 34, w: W - 2 * m, h: 28, pt: 10.5, color: "#4b5563", lineHeight: 1.45 }));
  pages.push(owner);

  // Exemple colorié
  const sample = images[COLORING_SLOTS.sample];
  if (opts.sampleColored && sample?.src) {
    const p = page(ctx, "coloring_sample");
    const f = drawingFrame(ctx);
    p.layout.blocks.push({ id: newId("i"), type: "image", role: "decoration", illustrationId: sample.illustrationId, src: sample.src, alt: "Exemple colorié", caption: "", isDemo: sample.isDemo, fit: "contain", x: f.x, y: f.y + 10, w: f.w, h: f.h - 10, editable: true, style: { background: "#FFFFFF" } });
    p.layout.blocks.push(t({ text: "Exemple : à toi de choisir tes couleurs !", x: m, y: f.y - 2, w: W - 2 * m, h: 10, pt: 14, weight: "bold", color: ctx.theme.colorPrimary }));
    pages.push(p);
  }

  // Sommaire (facultatif) : 2 colonnes de 25 titres par page
  if (opts.toc) {
    const per = 50;
    for (let i = 0; i < c.dessins.length; i += per) {
      const p = page(ctx, "coloring_toc");
      p.layout.blocks.push(t({ text: i === 0 ? "Sommaire" : "Sommaire (suite)", x: m, y: m, w: W - 2 * m, h: 12, pt: 22, weight: "bold", role: "title", color: ctx.theme.colorPrimary }));
      const group = c.dessins.slice(i, i + per);
      const colW = (W - 2 * m - 8) / 2;
      [group.slice(0, 25), group.slice(25)].forEach((col, ci) => {
        if (!col.length) return;
        p.layout.blocks.push({ id: newId("l"), type: "list", role: "bullets", items: col.map((d) => `${d.numero}. ${d.titre}`), x: m + ci * (colW + 8), y: m + 18, w: colW, h: H - 2 * m - 24, editable: true, style: { fontSizePt: 9.5 } });
      });
      pages.push(p);
    }
  }

  // Dessins : une page chacun (+ page blanche au dos en recto-verso)
  for (const d of c.dessins) {
    const img = images[COLORING_SLOTS.drawing(d.numero)];
    const p = page(ctx, "coloring_drawing");
    const f = drawingFrame(ctx);
    p.layout.blocks.push({ id: newId("i"), type: "image", role: "decoration", illustrationId: img?.illustrationId, src: img?.src, alt: d.titre, caption: "", isDemo: img?.isDemo ?? false, fit: "contain", x: f.x, y: f.y, w: f.w, h: f.h, editable: true, style: { background: "#FFFFFF" } });
    p.layout.blocks.push(t({ text: d.legende || d.titre, x: f.x, y: f.y + f.h + 2, w: f.w, h: 8, pt: 10, color: "#6b7280", role: "caption" }));
    pages.push(p);
    if (opts.duplex) {
      const blank = page(ctx, "coloring_blank", false);
      blank.layout.blocks.push(t({ text: "Page laissée blanche (impression recto-verso)", x: m, y: H - m - 6, w: W - 2 * m, h: 5, pt: 7, color: "#d1d5db", role: "caption" }));
      pages.push(blank);
    }
  }

  // Diplôme « Artiste en herbe »
  const dip = page(ctx, "coloring_diploma", false);
  dip.layout.blocks.push(frame(m, m, W - 2 * m, H - 2 * m, ctx.theme.colorPrimary));
  dip.layout.blocks.push(t({ text: c.diplome?.titre || "Diplôme d'artiste en herbe", x: m + 10, y: m + 30, w: W - 2 * m - 20, h: 20, pt: 30, weight: "bold", role: "title", color: ctx.theme.colorPrimary }));
  dip.layout.blocks.push(t({ text: "Décerné à", x: m + 10, y: m + 70, w: W - 2 * m - 20, h: 10, pt: 14, color: "#4b5563" }));
  dip.layout.blocks.push(t({ text: opts.childName || "_______________________", x: m + 10, y: m + 84, w: W - 2 * m - 20, h: 14, pt: 24, weight: "bold" }));
  dip.layout.blocks.push(t({ text: c.diplome?.texte || "pour avoir colorié ce cahier avec talent et imagination.", x: m + 20, y: m + 108, w: W - 2 * m - 40, h: 30, pt: 13, lineHeight: 1.5 }));
  dip.layout.blocks.push(t({ text: "Date : ____________          Signature : ____________", x: m + 10, y: H - m - 40, w: W - 2 * m - 20, h: 10, pt: 11, color: "#4b5563" }));
  pages.push(dip);
  return pages;
}

/** Couverture du cahier : ligne « Ce cahier appartient à … » (ou prénom imprimé). */
export function decorateColoringCover(cover: BuiltPage, ctx: BuildContext, opts: ColoringOptions): BuiltPage {
  if (!opts.nameOnCover) return cover;
  const W = ctx.widthMm;
  const H = ctx.heightMm;
  const label = opts.childName ? `Le cahier de ${opts.childName}` : "Ce cahier appartient à : ____________________";
  cover.layout.blocks.push({ id: newId("t"), type: "text", role: "label", text: label, x: 20, y: H * 0.81 + 12, w: W - 40, h: 10, editable: true, style: { fontSizePt: opts.childName ? 18 : 13, color: ctx.theme.colorPrimary, background: "#FFFFFF", align: "center", weight: "bold", radius: 6, padding: 2 } });
  return cover;
}
