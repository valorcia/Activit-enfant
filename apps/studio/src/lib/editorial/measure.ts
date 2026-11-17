/**
 * Mesure réelle des coupures de lignes dans Chromium (Playwright).
 *
 * Chaque paragraphe est rendu par le composant ProseView, celui de l'impression, avec les
 * polices embarquées de public/fonts/unwritten, dans la largeur exacte de la colonne. On relève
 * pour chaque ligne le caractère qui l'ouvre et si la coupure précédente est une césure.
 * L'algorithme de coupure de Chromium étant glouton (ligne par ligne), un fragment de
 * paragraphe recomposé dans la même largeur reproduit exactement les mêmes lignes : c'est ce
 * qui permet de découper le texte en pages sans estimation.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Browser, Page } from "playwright-core";
import { ProseView } from "@/components/editorial/prose-view";
import type { ProseBlock, ProseItem } from "../schemas/layout";
import { fontFaceCss } from "./fonts";

export interface MeasureFlow {
  /** Réglages typographiques communs (ceux du bloc qui sera imprimé) */
  block: Omit<ProseBlock, "id" | "type" | "items" | "x" | "y" | "h" | "style" | "editable"> & { w: number; style?: ProseBlock["style"] };
  items: ProseItem[];
}

export interface MeasuredLines {
  /** Index (dans le texte brut du paragraphe) du premier caractère de chaque ligne */
  starts: number[];
  /** hyphen[k] : la ligne k se termine par une césure automatique */
  hyphen: boolean[];
  /** Hauteur mesurée en mm (contrôle de cohérence avec la grille) */
  heightMm: number;
}

export interface Measurer {
  measure(flows: MeasureFlow[]): Promise<MeasuredLines[][]>;
  close(): Promise<void>;
}

/** Origine fictive servie par interception : polices lues sur le disque, aucun accès réseau. */
const ORIGIN = "https://unwritten-measure.local";

export function publicDir(): string {
  return path.resolve(process.cwd(), "public");
}

/** Document HTML autonome : polices UNWRITTEN + contenu (sert aussi aux tests de contrôle qualité). */
export function standaloneHtml(body: string, opts: { lang?: string; extraCss?: string } = {}): string {
  return `<!doctype html><html lang="${opts.lang ?? "en"}"><head><meta charset="utf-8"><style>${fontFaceCss(`${ORIGIN}/fonts/unwritten`)}
html,body{margin:0;padding:0;background:#fff;} *{box-sizing:border-box;} ${opts.extraCss ?? ""}</style></head><body>${body}</body></html>`;
}

/** Ouvre une page Chromium sur l'origine de mesure (polices servies depuis public/). */
export async function openStandalonePage(browser: Browser, html: string, opts: { deviceScaleFactor?: number; viewport?: { width: number; height: number } } = {}): Promise<Page> {
  const context = await browser.newContext({ deviceScaleFactor: opts.deviceScaleFactor ?? 2, viewport: opts.viewport ?? { width: 1200, height: 1600 } });
  const page = await context.newPage();
  const root = publicDir();
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/") return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html });
    const file = path.join(root, decodeURIComponent(url.pathname));
    if (!file.startsWith(root)) return route.fulfill({ status: 403, body: "" });
    try {
      const data = await readFile(file);
      const type = file.endsWith(".woff2") ? "font/woff2" : file.endsWith(".ttf") ? "font/ttf" : "application/octet-stream";
      return route.fulfill({ status: 200, contentType: type, body: data });
    } catch {
      return route.fulfill({ status: 404, body: "" });
    }
  });
  await page.goto(`${ORIGIN}/`, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  return page;
}

function flowMarkup(flows: MeasureFlow[]): string {
  return flows
    .map((f, k) => {
      const prose = renderToStaticMarkup(createElement(ProseView, { block: { ...f.block, items: f.items }, measure: true }));
      return `<section data-measure-flow="${k}" style="width:${f.block.w}mm;margin:0 0 20mm 0;">${prose}</section>`;
    })
    .join("");
}

/** Script exécuté dans la page : relève les débuts de ligne de chaque paragraphe. */
function collectLines(): { starts: number[]; hyphen: boolean[]; heightMm: number }[][] {
  const pxPerMm = 96 / 25.4;
  const word = /[\p{L}\p{N}]/u;
  const flows: { starts: number[]; hyphen: boolean[]; heightMm: number }[][] = [];
  document.querySelectorAll<HTMLElement>("[data-measure-flow]").forEach((flowEl) => {
    const items: { starts: number[]; hyphen: boolean[]; heightMm: number }[] = [];
    const lead = parseFloat(getComputedStyle(flowEl.querySelector<HTMLElement>("[data-prose]")!).lineHeight) || 16;
    flowEl.querySelectorAll<HTMLElement>("[data-prose-item]").forEach((el) => {
      const range = document.createRange();
      const starts: number[] = [];
      const hyphen: boolean[] = [];
      let off = 0;
      let lastTop: number | null = null;
      let prev = "";
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let node: Node | null;
      while ((node = walker.nextNode())) {
        const t = (node as Text).data;
        for (let i = 0; i < t.length; i++) {
          const ch = t[i];
          if (ch === " " || ch === "\n" || ch === "\t") {
            prev = ch;
            continue;
          }
          range.setStart(node, i);
          range.setEnd(node, i + 1);
          const rects = range.getClientRects();
          if (rects.length === 0) {
            prev = ch;
            continue;
          }
          // Le trait d'union d'une césure est rattaché au caractère qui suit la coupure :
          // son glyphe réel est le dernier rectangle
          const top = rects[rects.length - 1].top;
          if (lastTop === null || top > lastTop + lead / 2) {
            if (lastTop !== null) hyphen.push(word.test(prev) && word.test(ch));
            starts.push(off + i);
            lastTop = top;
          }
          prev = ch;
        }
        off += t.length;
      }
      if (starts.length > 0) hyphen.push(false);
      items.push({ starts, hyphen, heightMm: el.getBoundingClientRect().height / pxPerMm });
    });
    flows.push(items);
  });
  return flows;
}

/** Mesureur Chromium : une page réutilisée pour toutes les mesures d'un livre. */
export async function createChromiumMeasurer(browser?: Browser): Promise<Measurer> {
  const { getBrowser } = await import("../pdf/browser");
  const b = browser ?? (await getBrowser());
  let page: Page | null = null;
  return {
    async measure(flows) {
      const html = standaloneHtml(`<div id="root">${flowMarkup(flows)}</div>`);
      if (!page) page = await openStandalonePage(b, html);
      else {
        await page.setContent(html, { waitUntil: "load" });
        await page.evaluate(() => document.fonts.ready);
      }
      // Les polices sont chargées à la demande (unicode-range) : on attend qu'elles le soient toutes
      await page.waitForFunction(() => document.fonts.status === "loaded");
      await page.evaluate("window.__name = window.__name || ((f) => f)");
      return page.evaluate(collectLines);
    },
    async close() {
      await page?.context().close();
      page = null;
    },
  };
}
