/**
 * Démonstration du moteur éditorial UNWRITTEN : compose les trois livres d'exemple (un par
 * collection), les enregistre dans la base de développement, les imprime en PDF par le chemin
 * réel du studio (route /print/books/[id] → PageRenderer → Chromium → renderBookPdf), exécute le
 * contrôle qualité éditorial sur ce rendu et produit des captures PNG de pages représentatives.
 *
 * Usage (dans apps/studio, Postgres local démarré, base de dev de .env) :
 *   npx tsx scripts/unwritten-demo.ts                 # démarre `next dev` sur un port libre, puis l'arrête
 *   npx tsx scripts/unwritten-demo.ts --url=http://localhost:3000   # serveur déjà lancé
 *   options : --out=<dossier> --only=secret-book --modes=print,digital
 *
 * Aucun appel d'IA : les textes sont ceux de src/lib/demo/unwritten, les illustrations des aplats.
 */
import "dotenv/config";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/db";
import { composeBook, type ComposeMode } from "@/lib/editorial/compose";
import { createChromiumMeasurer } from "@/lib/editorial/measure";
import { runEditorialQa, type QaReport } from "@/lib/editorial/qa";
import { renderBookPdf } from "@/lib/export";
import { closeBrowser, getBrowser } from "@/lib/pdf/browser";
import { PageLayoutSchema } from "@/lib/schemas/layout";
import { UNWRITTEN_DEMOS } from "@/lib/demo/unwritten";

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=");
const OUT = path.resolve(arg("out") ?? "/tmp/claude-0/-home-user-Activit-enfant/c7dda0b2-f8fe-52e2-a668-6285f4e83eb6/scratchpad/unwritten");
const ONLY = arg("only");
const MODES = (arg("modes") ?? "print,digital").split(",") as ComposeMode[];
const DATE = new Date("2026-11-17T12:00:00Z");

/** Gabarits capturés en PNG (première occurrence de chacun). */
const SHOTS = ["cover", "title", "dedication", "contents", "chapter_opening", "text", "text_figure", "quote", "illustration", "activity", "memory", "conclusion", "back_cover"];

async function waitFor(url: string, timeoutMs: number) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try {
      const r = await fetch(url, { redirect: "manual" });
      if (r.status < 500) return;
    } catch {
      /* serveur pas encore prêt */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Serveur injoignable : ${url}`);
}

async function startServer(): Promise<{ base: string; child: ChildProcess }> {
  const port = 3000 + Math.floor(Math.random() * 500) + 200;
  const child = spawn("npx", ["next", "dev", "-p", String(port)], { cwd: process.cwd(), env: { ...process.env, PORT: String(port) }, stdio: ["ignore", "pipe", "pipe"], detached: true });
  child.stdout?.on("data", () => undefined);
  child.stderr?.on("data", (d) => process.env.DEMO_VERBOSE && process.stderr.write(d));
  const base = `http://localhost:${port}`;
  await waitFor(`${base}/connexion`, 180_000);
  return { base, child };
}

function stopServer(child: ChildProcess) {
  try {
    if (child.pid) process.kill(-child.pid, "SIGTERM");
  } catch {
    child.kill("SIGTERM");
  }
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const given = arg("url");
  const server = given ? null : await startServer();
  const base = given ?? server!.base;
  process.env.APP_URL = base;
  console.log(`Rendu par ${base} → ${OUT}`);
  const measurer = await createChromiumMeasurer();
  const summary: Record<string, unknown>[] = [];
  try {
    for (const demo of UNWRITTEN_DEMOS) {
      if (ONLY && demo.slug !== ONLY) continue;
      for (const mode of MODES) {
        const t0 = Date.now();
        const book = await composeBook(demo.manuscript, { format: demo.format, mode, measurer, date: DATE });
        const tCompose = Date.now() - t0;
        // Aller-retour par le schéma : un champ oublié dans PageLayoutSchema serait perdu à l'enregistrement
        for (const p of book.pages) {
          const parsed = PageLayoutSchema.parse(p.layout);
          if (JSON.stringify(stripUndefined(parsed)) !== JSON.stringify(stripUndefined(p.layout))) throw new Error(`Page ${p.templateKey} modifiée par PageLayoutSchema : champ non déclaré`);
        }
        const marker = `unwritten-demo:${demo.slug}:${mode}`;
        const existing = await prisma.book.findFirst({ where: { brief: marker } });
        const data = { title: book.title, subtitle: (demo.manuscript.subtitle as string | undefined) ?? null, bookType: "unwritten", kitType: "unwritten", ageRange: "adulte", artStyle: "aplats", pageFormat: book.pageFormat, language: book.lang, theme: book.theme, brief: marker, collection: `UNWRITTEN · ${demo.manuscript.collection}` };
        const row = existing ? await prisma.book.update({ where: { id: existing.id }, data }) : await prisma.book.create({ data });
        await prisma.$transaction([
          prisma.bookPage.deleteMany({ where: { bookId: row.id } }),
          prisma.bookPage.createMany({ data: book.pages.map((p, position) => ({ bookId: row.id, position, templateKey: p.templateKey, layout: PageLayoutSchema.parse(p.layout) })) }),
        ]);

        // PDF par le chemin d'export du studio
        const t1 = Date.now();
        const pdf = await renderBookPdf({ baseUrl: `${base}/print/books/${row.id}`, pages: book.pages.length, widthMm: book.grid.widthMm, heightMm: book.grid.heightMm, mode: "print" });
        const tPdf = Date.now() - t1;
        const pdfPath = path.join(OUT, `${demo.slug}-${mode}.pdf`);
        writeFileSync(pdfPath, pdf.pdf);

        // Contrôle qualité et captures sur le même rendu (deviceScaleFactor 1)
        const browser = await getBrowser();
        const ctx = await browser.newContext({ deviceScaleFactor: 1, viewport: { width: 1400, height: 1800 } });
        const page = await ctx.newPage();
        await page.goto(`${base}/print/books/${row.id}`, { waitUntil: "networkidle", timeout: 180_000 });
        await page.waitForFunction(() => (window as unknown as { __INVENTOR_READY__?: boolean }).__INVENTOR_READY__ === true, null, { timeout: 120_000 });
        const qa: QaReport = await runEditorialQa(page, { expect: book.expectations, mode });
        const shots: string[] = [];
        if (mode === "print") {
          const seen = new Set<string>();
          for (let i = 0; i < book.pages.length; i++) {
            const t = book.pages[i].layout.editorial?.template ?? "";
            if (!SHOTS.includes(t) || seen.has(t)) continue;
            seen.add(t);
            const file = path.join(OUT, `${demo.slug}-${String(i).padStart(2, "0")}-${t}.png`);
            await page.locator(`[data-page-index="${i}"]`).screenshot({ path: file });
            shots.push(file);
          }
          // Planche de toutes les pages (revue d'ensemble du rythme)
          await page.addStyleTag({ content: ".print-root{display:flex;flex-wrap:wrap;gap:5mm;padding:6mm;background:#8d8a84;zoom:0.32;width:2900mm} .print-root .book-page{box-shadow:0 0 1.5mm rgba(0,0,0,.35)}" });
          const sheet = path.join(OUT, `${demo.slug}-planche.png`);
          await page.screenshot({ path: sheet, fullPage: true });
          shots.push(sheet);
        }
        await ctx.close();
        const entry = {
          slug: demo.slug,
          mode,
          format: book.grid.label,
          bookId: row.id,
          pages: book.pages.length,
          pdfPages: pdf.pageCount,
          pdf: pdfPath,
          composeMs: tCompose,
          pdfMs: tPdf,
          renderOverflows: pdf.overflows.length,
          missingImages: pdf.missingImages,
          fonts: pdf.fonts,
          stats: book.stats,
          qa: { ok: qa.ok, critical: qa.critical, warnings: qa.warnings, defects: qa.defects, personalization: qa.personalization },
          shots,
        };
        summary.push(entry);
        console.log(`${demo.slug} (${mode}) : ${book.pages.length} pages, PDF ${pdf.pageCount} p. en ${tPdf} ms, composition ${tCompose} ms, QA ${qa.critical} critique(s) / ${qa.warnings} avertissement(s)`);
        for (const d of qa.defects) console.log(`   [${d.severity}] p.${d.pageIndex ?? "-"}${d.folio !== undefined ? ` (folio ${d.folio})` : ""} ${d.template ?? ""} ${d.code} ${d.message}`);
      }
    }
  } finally {
    writeFileSync(path.join(OUT, "report.json"), JSON.stringify(summary, null, 1));
    await measurer.close().catch(() => undefined);
    await closeBrowser().catch(() => undefined);
    await prisma.$disconnect().catch(() => undefined);
    if (server) stopServer(server.child);
  }
}

/** Forme canonique (clés triées, valeurs indéfinies retirées) pour comparer deux mises en page. */
function stripUndefined(x: unknown): unknown {
  if (Array.isArray(x)) return x.map(stripUndefined);
  if (x && typeof x === "object") return Object.fromEntries(Object.entries(x as Record<string, unknown>).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, stripUndefined(v)]));
  return x;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
