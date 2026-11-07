import type { ActivityContent, CoverData } from "../schemas/activity";
import { ageRangeLabel, difficultyLabel, supervisionLabel } from "../schemas/activity";
import type { Block, BookTheme, PageLayout } from "../schemas/layout";
import { estimateTextHeightMm } from "./formats";
import { newId } from "../utils";

export interface IllustrationRef {
  id: string;
  kind: "FINAL" | "STEP" | "COVER" | "MATERIAL";
  stepIndex: number | null;
  src?: string;
  isDemo: boolean;
  status: string;
}

export interface BuildContext {
  widthMm: number;
  heightMm: number;
  theme: BookTheme;
}

export interface BuiltPage {
  templateKey: string;
  layout: PageLayout;
  activityId?: string;
}

// ---------------------------------------------------------------------------
// Flux de page : positionne des blocs les uns sous les autres en respectant
// les marges, crée une nouvelle page quand un bloc ne tient plus.
// ---------------------------------------------------------------------------

class PageFlow {
  pages: BuiltPage[] = [];
  private current: BuiltPage | null = null;
  private y = 0;
  constructor(private ctx: BuildContext, private templateKey: string, private activityId?: string, private continuationKey = templateKey) {}

  get margin() {
    return this.ctx.theme.marginMm;
  }
  get contentWidth() {
    return this.ctx.widthMm - 2 * this.margin;
  }
  get bottom() {
    return this.ctx.heightMm - this.margin - 6; // réserve pour le numéro de page
  }
  get cursor() {
    return this.y;
  }
  get remaining() {
    return this.bottom - this.y;
  }
  get page(): BuiltPage {
    if (!this.current) this.newPage();
    return this.current!;
  }
  newPage(templateKey?: string) {
    this.current = {
      templateKey: templateKey ?? (this.pages.length === 0 ? this.templateKey : this.continuationKey),
      activityId: this.activityId,
      layout: { widthMm: this.ctx.widthMm, heightMm: this.ctx.heightMm, showPageNumber: true, blocks: [] },
    };
    this.pages.push(this.current);
    this.y = this.margin;
    return this.current;
  }
  ensure(heightMm: number) {
    if (!this.current) this.newPage();
    if (this.y + heightMm > this.bottom && this.y > this.margin + 0.5) this.newPage();
  }
  push(block: Block, advance = true) {
    this.page.layout.blocks.push(block);
    if (advance) this.y = Math.max(this.y, block.y + block.h);
  }
  gap(mm: number) {
    this.y += mm;
  }
  /** Ajoute un bloc texte d'une hauteur estimée, à la position courante. */
  text(opts: { text: string; role: "title" | "subtitle" | "heading" | "body" | "caption" | "label"; fontPt?: number; widthMm?: number; x?: number; style?: Record<string, unknown>; lineHeight?: number; minH?: number }) {
    const fontPt = opts.fontPt ?? this.ctx.theme.baseFontPt;
    const width = opts.widthMm ?? this.contentWidth;
    const padding = Number(opts.style?.padding ?? 0);
    const h = Math.max(opts.minH ?? 0, estimateTextHeightMm(opts.text, width - 2 * padding, fontPt, opts.lineHeight ?? 1.45) + 2 * padding + 1.5);
    this.ensure(Math.min(h, this.bottom - this.margin));
    const block: Block = { id: newId("t"), type: "text", role: opts.role, text: opts.text, x: opts.x ?? this.margin, y: this.y, w: width, h, style: { fontSizePt: fontPt, ...(opts.style ?? {}) }, editable: true };
    this.push(block);
    return block;
  }
}

// ---------------------------------------------------------------------------
// Pages d'activité
// ---------------------------------------------------------------------------

export function buildActivityPages(opts: {
  content: ActivityContent;
  illustrations: IllustrationRef[];
  ctx: BuildContext;
  activityNumber: number;
  activityId: string;
}): BuiltPage[] {
  const { content: c, ctx, illustrations } = opts;
  const t = ctx.theme;
  const flow = new PageFlow(ctx, "activity_intro", opts.activityId, "steps");
  const M = flow.margin;
  const W = flow.contentWidth;
  const final = illustrations.find((i) => i.kind === "FINAL");

  // --- Page de présentation -------------------------------------------------
  flow.newPage("activity_intro");
  flow.push({ id: newId("s"), type: "shape", shape: "band", color: t.colorPrimary, x: 0, y: 0, w: ctx.widthMm, h: M + 22, style: {}, editable: false }, false);
  flow.push({ id: newId("t"), type: "text", role: "label", text: `Activité ${opts.activityNumber}`, x: M, y: M - 4, w: W, h: 7, style: { fontSizePt: 11, color: "#ffffff", weight: "bold" }, editable: true }, false);
  flow.push({ id: newId("t"), type: "text", role: "title", text: c.title, x: M, y: M + 3, w: W, h: 14, style: { fontSizePt: c.title.length > 40 ? 20 : 24, color: "#ffffff", weight: "bold", lineHeight: 1.1 }, editable: true });
  flow.gap(6);
  if (c.subtitle) flow.text({ text: c.subtitle, role: "subtitle", fontPt: 13, style: { color: t.colorSecondary, weight: "bold" } });
  flow.gap(2);

  // Illustration finale (colonne droite) + badges + description (colonne gauche)
  const imgW = Math.min(W * 0.5, 95);
  const imgH = imgW; // carré
  const leftW = W - imgW - 6;
  const topY = flow.cursor;
  flow.push({ id: newId("i"), type: "image", role: "final", illustrationId: final?.id, src: final?.src, alt: c.finalIllustrationBrief, caption: "", isDemo: final?.isDemo ?? false, fit: "contain", x: M + leftW + 6, y: topY, w: imgW, h: imgH, style: { radius: 4, background: t.colorPanel }, editable: true }, false);
  flow.push({
    id: newId("b"),
    type: "badges",
    items: [
      { label: "Âge", value: ageRangeLabel(c.ageRange), icon: "age" },
      { label: "Durée", value: `${c.durationMinutes} min`, icon: "clock" },
      { label: "Difficulté", value: difficultyLabel(c.difficulty), icon: "star" },
      { label: "Adulte", value: supervisionLabel(c.safety.adultSupervision), icon: "adult" },
    ],
    x: M,
    y: topY,
    w: leftW,
    h: 26,
    style: {},
    editable: true,
  });
  flow.gap(3);
  flow.text({ text: c.description, role: "body", widthMm: leftW, fontPt: t.baseFontPt });
  flow.gap(3);
  flow.text({ text: `Objectif : ${c.pedagogicalGoal}`, role: "caption", widthMm: leftW, fontPt: t.baseFontPt - 1.5, style: { color: "#4b5563" } });
  // On s'assure de passer sous l'image
  if (flow.cursor < topY + imgH) flow.gap(topY + imgH - flow.cursor);
  flow.gap(5);

  // --- Matériel + sécurité ---------------------------------------------------
  const matItems = c.materials.map((m) => `${m.name}${m.quantity ? ` — ${m.quantity}` : ""}${m.optional ? " (facultatif)" : ""}${m.note ? ` · ${m.note}` : ""}`);
  const warnItems = [...c.safety.warnings];
  const listFont = t.baseFontPt - 1;
  const colW = (W - 6) / 2;
  const matHFull = listHeight(matItems, W, listFont);
  const warnHFull = warnItems.length ? listHeight(warnItems, W, listFont) : 0;
  const twoCols = W > 150 && matHFull + warnHFull + 4 > flow.remaining - 10 && warnItems.length > 0;
  if (twoCols) {
    const matH = listHeight(matItems, colW, listFont);
    const warnH = listHeight(warnItems, colW, listFont);
    flow.ensure(Math.max(matH, warnH));
    const y = flow.cursor;
    flow.push({ id: newId("l"), type: "list", role: "materials", title: "Il te faut", items: matItems, x: M, y, w: colW, h: matH, style: { background: t.colorPanel, padding: 4, radius: 3, fontSizePt: listFont }, editable: true });
    flow.push({ id: newId("l"), type: "list", role: "warnings", title: "Sécurité", items: warnItems, x: M + colW + 6, y, w: colW, h: warnH, style: { background: "#fff7ed", padding: 4, radius: 3, fontSizePt: listFont, borderColor: "#fdba74" }, editable: true });
  } else {
    flow.ensure(matHFull);
    flow.push({ id: newId("l"), type: "list", role: "materials", title: "Il te faut", items: matItems, x: M, y: flow.cursor, w: W, h: matHFull, style: { background: t.colorPanel, padding: 4, radius: 3, fontSizePt: listFont }, editable: true });
    if (warnItems.length) {
      flow.gap(4);
      flow.ensure(warnHFull);
      flow.push({ id: newId("l"), type: "list", role: "warnings", title: "Sécurité", items: warnItems, x: M, y: flow.cursor, w: W, h: warnHFull, style: { background: "#fff7ed", padding: 4, radius: 3, fontSizePt: listFont, borderColor: "#fdba74" }, editable: true });
    }
  }
  flow.gap(6);

  // --- Étapes --------------------------------------------------------------
  const stepHeight = (i: number) => {
    const s = c.steps[i];
    const ill = illustrations.find((x) => x.kind === "STEP" && x.stepIndex === i);
    const hasImg = Boolean(ill?.src);
    const textW = W - (hasImg ? 52 + 5 : 0) - 15;
    const titleH = estimateTextHeightMm(s.title, textW, t.baseFontPt * 1.2, 1.2) + 1.5;
    const bodyH = estimateTextHeightMm(s.instruction, textW, t.baseFontPt, 1.45);
    const tipH = s.tip ? estimateTextHeightMm(`Astuce : ${s.tip}`, textW, t.baseFontPt, 1.45) + 1.5 : 0;
    return Math.max(hasImg ? 52 : 16, titleH + bodyH + tipH + 3);
  };
  // Le titre « Les étapes » reste solidaire de la première étape
  flow.ensure(12 + stepHeight(0) + 5);
  flow.text({ text: "Les étapes", role: "heading", fontPt: 16, style: { color: t.colorPrimary, weight: "bold" } });
  flow.gap(2);
  c.steps.forEach((s, i) => {
    const ill = illustrations.find((x) => x.kind === "STEP" && x.stepIndex === i);
    const h = stepHeight(i);
    flow.ensure(h + 3);
    flow.push({ id: newId("st"), type: "step", number: i + 1, title: s.title, instruction: s.instruction, tip: s.tip ?? "", adultHelp: s.adultHelp ?? false, illustrationId: ill?.id, imageSrc: ill?.src, isDemo: ill?.isDemo ?? false, x: M, y: flow.cursor, w: W, h, style: { fontSizePt: t.baseFontPt }, editable: true });
    flow.gap(3);
  });
  flow.gap(4);

  // --- Explication -----------------------------------------------------------
  const expH = 10 + estimateTextHeightMm(c.explanation.body, W - 10, t.baseFontPt, 1.45) + (c.explanation.keyWords.length ? 10 : 0) + 8;
  flow.ensure(Math.min(expH, 120));
  const expY = flow.cursor;
  flow.push({ id: newId("s"), type: "shape", shape: "rect", color: t.colorPanel, x: M, y: expY, w: W, h: expH, style: { radius: 4 }, editable: true }, false);
  flow.gap(4);
  flow.text({ text: c.explanation.title, role: "heading", fontPt: 14, x: M + 5, widthMm: W - 10, style: { color: t.colorPrimary, weight: "bold" } });
  flow.text({ text: c.explanation.body, role: "body", x: M + 5, widthMm: W - 10 });
  if (c.explanation.keyWords.length) flow.push({ id: newId("l"), type: "list", role: "keywords", items: c.explanation.keyWords, x: M + 5, y: flow.cursor + 1, w: W - 10, h: 8, style: { fontSizePt: t.baseFontPt - 1 }, editable: true });
  if (flow.cursor < expY + expH) flow.gap(expY + expH - flow.cursor);
  flow.gap(5);

  // --- Défi + anecdote -------------------------------------------------------
  const chH = 10 + estimateTextHeightMm(c.challenge.body, W - 10, t.baseFontPt, 1.45) + 8;
  flow.ensure(chH);
  const chY = flow.cursor;
  flow.push({ id: newId("s"), type: "shape", shape: "rect", color: "#ffffff", x: M, y: chY, w: W, h: chH, style: { radius: 4, borderColor: t.colorSecondary }, editable: true }, false);
  flow.gap(4);
  flow.text({ text: `Défi : ${c.challenge.title}`, role: "heading", fontPt: 13, x: M + 5, widthMm: W - 10, style: { color: t.colorSecondary, weight: "bold" } });
  flow.text({ text: c.challenge.body, role: "body", x: M + 5, widthMm: W - 10 });
  if (flow.cursor < chY + chH) flow.gap(chY + chH - flow.cursor);
  if (c.funFact) {
    flow.gap(4);
    flow.text({ text: `Le sais-tu ? ${c.funFact}`, role: "caption", fontPt: t.baseFontPt - 1, style: { color: "#4b5563", background: "#fefce8", padding: 3, radius: 3 } });
  }
  // Pages suivantes = "steps"/continuation ; on nomme la 2e page et suivantes selon leur contenu
  return flow.pages;
}

// ---------------------------------------------------------------------------
// Pages hors activités
// ---------------------------------------------------------------------------

/** Hauteur d'une liste à puces (titre + éléments) dans une largeur donnée, marge intérieure 4 mm. */
export function listHeight(items: string[], widthMm: number, fontPt: number, padding = 4) {
  const inner = widthMm - 2 * padding - 6;
  const title = fontPt * 1.15 * 0.3527 * 1.3 + 1.5;
  const body = items.reduce((acc, it) => acc + estimateTextHeightMm(it, inner, fontPt, 1.35) + 1, 0);
  return title + body + 2 * padding + 2;
}

export function buildCoverPage(cover: CoverData, ctx: BuildContext, illustration?: IllustrationRef): BuiltPage {
  const t = ctx.theme;
  const W = ctx.widthMm;
  const H = ctx.heightMm;
  const blocks: Block[] = [
    { id: newId("s"), type: "shape", shape: "rect", color: t.colorPrimary, x: 0, y: 0, w: W, h: H, style: {}, editable: false },
    { id: newId("i"), type: "image", role: "cover", illustrationId: illustration?.id, src: illustration?.src, alt: cover.illustrationBrief, caption: "", isDemo: illustration?.isDemo ?? false, fit: "cover", x: 12, y: H * 0.3, w: W - 24, h: H * 0.5, style: { radius: 6, background: "#ffffff" }, editable: true },
    { id: newId("t"), type: "text", role: "label", text: cover.collection, x: 12, y: 16, w: W - 24, h: 8, style: { fontSizePt: 12, color: "#ffffff", align: "center", weight: "bold" }, editable: true },
    { id: newId("t"), type: "text", role: "title", text: cover.title, x: 12, y: 28, w: W - 24, h: 30, style: { fontSizePt: cover.title.length > 22 ? 34 : 42, color: "#ffffff", align: "center", weight: "bold", lineHeight: 1.05 }, editable: true },
    { id: newId("t"), type: "text", role: "subtitle", text: cover.subtitle, x: 12, y: 60, w: W - 24, h: 14, style: { fontSizePt: 18, color: t.colorSecondary, align: "center", weight: "bold" }, editable: true },
    { id: newId("t"), type: "text", role: "body", text: cover.tagline, x: 12, y: H * 0.82, w: W - 24, h: 10, style: { fontSizePt: 14, color: "#ffffff", align: "center" }, editable: true },
    { id: newId("t"), type: "text", role: "label", text: cover.ageLabel, x: W - 52, y: H - 26, w: 40, h: 12, style: { fontSizePt: 12, color: t.colorPrimary, background: t.colorSecondary, align: "center", weight: "bold", radius: 6, padding: 2 }, editable: true },
  ];
  return { templateKey: "cover", layout: { widthMm: W, heightMm: H, showPageNumber: false, blocks } };
}

export function buildBackCoverPage(cover: CoverData, ctx: BuildContext): BuiltPage {
  const t = ctx.theme;
  const W = ctx.widthMm;
  const H = ctx.heightMm;
  const M = t.marginMm + 5;
  const blocks: Block[] = [
    { id: newId("s"), type: "shape", shape: "rect", color: t.colorPanel, x: 0, y: 0, w: W, h: H, style: {}, editable: false },
    { id: newId("t"), type: "text", role: "title", text: cover.title, x: M, y: M + 10, w: W - 2 * M, h: 18, style: { fontSizePt: 24, color: t.colorPrimary, weight: "bold" }, editable: true },
    { id: newId("t"), type: "text", role: "body", text: cover.backText, x: M, y: M + 34, w: W - 2 * M, h: estimateTextHeightMm(cover.backText, W - 2 * M, 12, 1.5) + 4, style: { fontSizePt: 12, lineHeight: 1.5 }, editable: true },
    { id: newId("l"), type: "list", role: "bullets", items: cover.backBullets, x: M, y: M + 44 + estimateTextHeightMm(cover.backText, W - 2 * M, 12, 1.5), w: W - 2 * M, h: 10 + cover.backBullets.length * 7, style: { fontSizePt: 12, background: "#ffffff", padding: 5, radius: 4 }, editable: true },
    { id: newId("t"), type: "text", role: "label", text: `${cover.collection} · ${cover.ageLabel}`, x: M, y: H - M - 10, w: W - 2 * M, h: 8, style: { fontSizePt: 10, color: "#6b7280", align: "center" }, editable: true },
  ];
  return { templateKey: "back_cover", layout: { widthMm: W, heightMm: H, showPageNumber: false, blocks } };
}

export function buildIntroPage(title: string, intro: string, ctx: BuildContext): BuiltPage {
  const t = ctx.theme;
  const M = t.marginMm;
  const W = ctx.widthMm - 2 * M;
  const blocks: Block[] = [
    { id: newId("t"), type: "text", role: "title", text: "Bienvenue !", x: M, y: M + 10, w: W, h: 16, style: { fontSizePt: 26, color: t.colorPrimary, weight: "bold" }, editable: true },
    { id: newId("t"), type: "text", role: "body", text: intro, x: M, y: M + 32, w: W, h: estimateTextHeightMm(intro, W, 13, 1.6) + 6, style: { fontSizePt: 13, lineHeight: 1.6 }, editable: true },
    { id: newId("t"), type: "text", role: "caption", text: "Les activités signalées par un petit adulte demandent la présence d'un grand. Lis toujours la liste du matériel et les consignes de sécurité avant de commencer.", x: M, y: M + 40 + estimateTextHeightMm(intro, W, 13, 1.6), w: W, h: 22, style: { fontSizePt: 11, background: "#fff7ed", padding: 4, radius: 3, borderColor: "#fdba74" }, editable: true },
  ];
  return { templateKey: "intro", layout: { widthMm: ctx.widthMm, heightMm: ctx.heightMm, showPageNumber: true, blocks } };
}

export const TOC_PER_PAGE = 26;

export function buildTocPages(entries: { number: number; title: string; page: number }[], ctx: BuildContext): BuiltPage[] {
  const t = ctx.theme;
  const M = t.marginMm;
  const W = ctx.widthMm - 2 * M;
  const pages: BuiltPage[] = [];
  for (let i = 0; i < Math.max(1, Math.ceil(entries.length / TOC_PER_PAGE)); i++) {
    const slice = entries.slice(i * TOC_PER_PAGE, (i + 1) * TOC_PER_PAGE);
    const blocks: Block[] = [
      { id: newId("t"), type: "text", role: "title", text: i === 0 ? "Sommaire" : "Sommaire (suite)", x: M, y: M + 6, w: W, h: 16, style: { fontSizePt: 26, color: t.colorPrimary, weight: "bold" }, editable: true },
      { id: newId("toc"), type: "toc", entries: slice, x: M, y: M + 28, w: W, h: slice.length * 8.2 + 4, style: { fontSizePt: 12 }, editable: false },
    ];
    pages.push({ templateKey: "toc", layout: { widthMm: ctx.widthMm, heightMm: ctx.heightMm, showPageNumber: true, blocks } });
  }
  return pages;
}

export function buildDiplomaPage(bookTitle: string, ctx: BuildContext): BuiltPage {
  const t = ctx.theme;
  const W = ctx.widthMm;
  const H = ctx.heightMm;
  const M = t.marginMm;
  const blocks: Block[] = [
    { id: newId("s"), type: "shape", shape: "rect", color: "#ffffff", x: M - 4, y: M - 4, w: W - 2 * M + 8, h: H - 2 * M + 8, style: { borderColor: t.colorSecondary, radius: 6 }, editable: false },
    { id: newId("s"), type: "shape", shape: "rect", color: "#ffffff", x: M + 2, y: M + 2, w: W - 2 * M - 4, h: H - 2 * M - 4, style: { borderColor: t.colorPrimary, radius: 4 }, editable: false },
    { id: newId("t"), type: "text", role: "label", text: bookTitle, x: M, y: M + 22, w: W - 2 * M, h: 10, style: { fontSizePt: 14, color: t.colorSecondary, align: "center", weight: "bold" }, editable: true },
    { id: newId("t"), type: "text", role: "title", text: "Diplôme de petit inventeur", x: M, y: M + 36, w: W - 2 * M, h: 30, style: { fontSizePt: 32, color: t.colorPrimary, align: "center", weight: "bold", lineHeight: 1.1 }, editable: true },
    { id: newId("t"), type: "text", role: "body", text: "Ce diplôme est décerné à", x: M, y: M + 80, w: W - 2 * M, h: 10, style: { fontSizePt: 14, align: "center" }, editable: true },
    { id: newId("t"), type: "text", role: "body", text: "______________________________", x: M, y: M + 94, w: W - 2 * M, h: 12, style: { fontSizePt: 18, align: "center", color: "#9ca3af" }, editable: true },
    { id: newId("t"), type: "text", role: "body", text: "pour avoir construit, testé et compris toutes les inventions de ce livre avec curiosité, patience et créativité.", x: M + 15, y: M + 114, w: W - 2 * M - 30, h: 24, style: { fontSizePt: 13, align: "center", lineHeight: 1.6 }, editable: true },
    { id: newId("t"), type: "text", role: "body", text: "Date : ____________        Signature : ____________", x: M, y: H - M - 40, w: W - 2 * M, h: 10, style: { fontSizePt: 12, align: "center" }, editable: true },
  ];
  return { templateKey: "diploma", layout: { widthMm: W, heightMm: H, showPageNumber: false, blocks } };
}

export function buildConclusionPage(ctx: BuildContext, count: number): BuiltPage {
  const t = ctx.theme;
  const M = t.marginMm;
  const W = ctx.widthMm - 2 * M;
  const text = `Bravo ! Tu as découvert ${count} invention${count > 1 ? "s" : ""}. Chaque objet que tu as fabriqué cache un principe que les scientifiques et les ingénieurs utilisent tous les jours. Garde tes créations, montre-les autour de toi, et surtout : continue à te poser des questions. C'est ainsi que naissent les grandes inventions.`;
  const blocks: Block[] = [
    { id: newId("t"), type: "text", role: "title", text: "Et maintenant ?", x: M, y: M + 10, w: W, h: 16, style: { fontSizePt: 26, color: t.colorPrimary, weight: "bold" }, editable: true },
    { id: newId("t"), type: "text", role: "body", text, x: M, y: M + 32, w: W, h: estimateTextHeightMm(text, W, 13, 1.6) + 6, style: { fontSizePt: 13, lineHeight: 1.6 }, editable: true },
  ];
  return { templateKey: "conclusion", layout: { widthMm: ctx.widthMm, heightMm: ctx.heightMm, showPageNumber: true, blocks } };
}

/** Page vierge pour l'éditeur. */
export function buildBlankPage(ctx: BuildContext): BuiltPage {
  return { templateKey: "blank", layout: { widthMm: ctx.widthMm, heightMm: ctx.heightMm, showPageNumber: true, blocks: [] } };
}
