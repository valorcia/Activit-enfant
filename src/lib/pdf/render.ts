import { PDFDocument } from "pdf-lib";
import { getBrowser } from "./browser";

export interface RenderOptions {
  url: string;
  widthMm: number;
  heightMm: number;
  /** "print" : qualité maximale ; "digital" : images compressées côté page (paramètre d'URL) */
  mode?: "print" | "digital";
  timeoutMs?: number;
}

export interface RenderResult {
  pdf: Buffer;
  pageCount: number;
  overflows: { pageIndex: number; blockId: string; kind: string }[];
  missingImages: number;
  fonts: string[];
}

/**
 * Rend une route d'impression de l'application en PDF avec Chromium.
 * La page HTML doit exposer window.__INVENTOR_READY__ = true une fois les images chargées.
 */
export async function renderPdf(opts: RenderOptions): Promise<RenderResult> {
  const browser = await getBrowser();
  const context = await browser.newContext({ deviceScaleFactor: 2, viewport: { width: 1200, height: 1600 } });
  const page = await context.newPage();
  const url = new URL(opts.url);
  if (opts.mode) url.searchParams.set("mode", opts.mode);
  if (process.env.INTERNAL_TOKEN) url.searchParams.set("token", process.env.INTERNAL_TOKEN);
  try {
    await page.goto(url.toString(), { waitUntil: "networkidle", timeout: opts.timeoutMs ?? 120_000 });
    await page.waitForFunction(() => (window as unknown as { __INVENTOR_READY__?: boolean }).__INVENTOR_READY__ === true, null, { timeout: 60_000 });
    await page.evaluate(() => document.fonts.ready);

    // Contrôles : débordements de blocs, images manquantes, polices utilisées
    const checks = await page.evaluate(() => {
      const overflows: { pageIndex: number; blockId: string; kind: string }[] = [];
      document.querySelectorAll<HTMLElement>("[data-page-index]").forEach((pg) => {
        const pageIndex = Number(pg.dataset.pageIndex);
        pg.querySelectorAll<HTMLElement>("[data-block-id]").forEach((el) => {
          const inner = el.querySelector<HTMLElement>("[data-measure]") ?? el;
          if (inner.scrollHeight > el.clientHeight + 3) overflows.push({ pageIndex, blockId: el.dataset.blockId!, kind: el.dataset.blockType ?? "text" });
        });
      });
      let missingImages = 0;
      document.querySelectorAll<HTMLImageElement>("img").forEach((img) => {
        if (!img.complete || img.naturalWidth === 0) missingImages++;
      });
      const fonts = new Set<string>();
      document.fonts.forEach((f) => {
        if (f.status === "loaded") fonts.add(f.family);
      });
      return { overflows, missingImages, fonts: [...fonts] };
    });

    const pdf = await page.pdf({
      width: `${opts.widthMm}mm`,
      height: `${opts.heightMm}mm`,
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });
    const doc = await PDFDocument.load(pdf);
    return { pdf: Buffer.from(pdf), pageCount: doc.getPageCount(), ...checks };
  } finally {
    await context.close();
  }
}

/** Fusionne plusieurs PDF (export par lot). */
export async function mergePdfs(buffers: Buffer[]) {
  const out = await PDFDocument.create();
  for (const b of buffers) {
    const src = await PDFDocument.load(b);
    const pages = await out.copyPages(src, src.getPageIndices());
    pages.forEach((p) => out.addPage(p));
  }
  return Buffer.from(await out.save());
}
