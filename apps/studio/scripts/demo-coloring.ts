/**
 * DÉMONSTRATION — cahier de coloriage de 120 dessins avec le VRAI worker (fournisseurs de démonstration).
 *
 *   pnpm tsx scripts/demo-coloring.ts api [nombre]   → rédaction par lots + 120 illustrations en file + PDF
 *   pnpm tsx scripts/demo-coloring.ts lot [nombre]   → copier-coller « en lot » : 30 planches de test 2×2
 *                                                      déposées, découpées, vérifiées, validées, puis PDF
 *
 * Prérequis : serveur Next (APP_URL) et worker (`pnpm worker`) lancés. Les réglages IA sont
 * restaurés à la fin. Aucune clé API n'est utilisée.
 */
import "dotenv/config";
import sharp from "sharp";
import { prisma } from "../src/lib/db";
import { enqueue } from "../src/lib/queue/jobs";
import { QUEUES, stopBoss } from "../src/lib/queue/boss";
import { getAiSettings, saveAiSettings } from "../src/lib/settings";
import { createKitFromPlan } from "../src/lib/kits/create";
import { KitPlanSchema } from "../src/lib/kits/schemas";
import { createExport } from "../src/lib/export";
import { addSheetUpload, paramsOf, validateSheetBatch } from "../src/lib/coloring/sheet-batch";
import { makeTestSheet } from "../src/lib/coloring/test-sheets";
import { storeAsset } from "../src/lib/storage";
import { resumeJobIfReady } from "../src/lib/manual/requests";

const t0 = Date.now();
const since = (t: number) => `${((Date.now() - t) / 1000).toFixed(1)} s`;

async function waitJob(id: string, until: string[], label: string, timeoutMs = 30 * 60_000) {
  const start = Date.now();
  let last = "";
  for (;;) {
    const j = await prisma.job.findUniqueOrThrow({ where: { id } });
    const line = `${j.status} · ${j.step ?? ""}`;
    if (line !== last) console.log(`  [${label} ${since(start)}] ${line}`);
    last = line;
    if (until.includes(j.status)) return j;
    if (j.status === "FAILED") throw new Error(`${label} : ${j.error}`);
    if (Date.now() - start > timeoutMs) throw new Error(`${label} : délai dépassé`);
    await new Promise((r) => setTimeout(r, 1500));
  }
}

async function exportPdf(bookId: string, kind: "BOOK_DIGITAL" | "BOOK_PRINT") {
  const t = Date.now();
  const exp = await createExport({ kind, bookId, label: `Démo ${kind}` });
  const job = await enqueue(QUEUES.bookExport, { exportId: exp.id, bookId, skipAutoPublish: true });
  await waitJob(job.id, ["COMPLETED"], kind);
  const e = await prisma.export.findUniqueOrThrow({ where: { id: exp.id }, include: { asset: true } });
  return { kind, pages: e.pageCount, mo: e.asset ? +(e.asset.bytes / 1024 / 1024).toFixed(1) : null, duree: since(t), checks: e.checks };
}

async function main() {
  const mode = process.argv[2] === "lot" ? "lot" : "api";
  const count = Number(process.argv[3] ?? 120);
  const previous = await getAiSettings();
  await saveAiSettings({ ...previous, mode: mode === "lot" ? "manual" : "api", manualFor: "images", textProvider: "mock", imageProvider: "mock", maxConcurrentGenerations: 4 });
  try {
    const plan = KitPlanSchema.parse({
      kitType: "cahier-coloriage", title: `[DÉMO ${mode}] Mon grand cahier de dinosaures`, subtitle: `${count} dessins à colorier`, ageRange: "3-5", universe: "Dinosaures", count, priceCents: 590,
      coloring: { sampleColored: true, nameOnCover: true, childName: "", toc: false, duplex: false }, ai: { sheetGrid: 4 },
    });
    const { bookId } = await createKitFromPlan({ plan, brief: `Cahier de coloriage de ${count} dessins de dinosaures pour les 4 à 6 ans` });
    console.log(`Livre ${bookId} (${mode}, ${count} dessins)`);

    const tp = Date.now();
    const job = await enqueue(QUEUES.bookPipeline, { bookId, withIllustrations: true, withCover: true });
    if (mode === "lot") {
      await waitJob(job.id, ["WAITING_INPUT"], "pipeline");
      const req = await prisma.manualRequest.findFirstOrThrow({ where: { bookId, kind: "IMAGE_BATCH", status: "PENDING" } });
      const params = paramsOf(req.params);
      const sheets = Math.ceil(params.drawings.length / params.grid);
      console.log(`Lot d'images : ${params.drawings.length} dessins, ${sheets} planches — prompt maître de ${req.prompt.length} caractères`);
      const tu = Date.now();
      for (let s = 0; s < sheets; s++) {
        const png = await makeTestSheet({ side: 2, seed: s, gutter: s % 7 === 6 ? 0 : 70 }); // une planche sur 7 sans gouttière → repli
        // Noms « ChatGPT » horodatés, déposés dans le désordre : le tri par nom remet l'ordre
        await addSheetUpload(req.id, { name: `ChatGPT Image 11 nov. 2026, 10_${String(s).padStart(2, "0")}_00.png`, lastModified: Date.now() - s, data: png, width: 1024, height: 1536 });
      }
      console.log(`  ${sheets} planches déposées en ${since(tu)}`);
      const cut = await enqueue(QUEUES.coloringSheets, { requestId: req.id, bookId });
      await waitJob(cut.id, ["COMPLETED"], "découpage");
      const after = paramsOf((await prisma.manualRequest.findUniqueOrThrow({ where: { id: req.id } })).params);
      console.log(`  ${after.cells.length} cases, ${after.cells.filter((c) => c.svgAssetId).length} vectorisées, ${after.uploads.filter((u) => u.fallback).length} planche(s) en découpe régulière`);
      // Les autres demandes (exemple colorié, visuels, couverture) : une image de test chacune
      const others = await prisma.manualRequest.findMany({ where: { bookId, kind: "IMAGE", status: "PENDING" } });
      for (const o of others) {
        const img = await sharp({ create: { width: 1024, height: 1536, channels: 3, background: "#ffd59e" } }).png().toBuffer();
        const a = await storeAsset({ key: `manual/${o.id}.png`, data: img, mime: "image/png", width: 1024, height: 1536 });
        await prisma.manualRequest.update({ where: { id: o.id }, data: { status: "DONE", assetId: a.id, resolvedAt: new Date() } });
      }
      const v = await validateSheetBatch(req.id);
      console.log(`  Validé : ${v.created} illustrations créées, ${v.rejected} rejetée(s), ${v.missing} manquante(s) ; ${others.length} autre(s) image(s) déposée(s)`);
      console.log(`  Reprise : ${await resumeJobIfReady(req.jobId)}`);
    }
    const done = await waitJob(job.id, ["COMPLETED"], "pipeline");
    const ills = await prisma.illustration.count({ where: { bookId, kind: "KIT", isCurrent: true } });
    const pages = await prisma.bookPage.count({ where: { bookId } });
    console.log(`Pipeline : ${since(tp)} — ${ills} illustrations, ${pages} pages (${done.step})`);
    const digital = await exportPdf(bookId, "BOOK_DIGITAL");
    const print = await exportPdf(bookId, "BOOK_PRINT");
    console.log(JSON.stringify({ bookId, mode, count, illustrations: ills, pages, digital, print, total: since(t0) }, null, 2));
  } finally {
    await saveAiSettings(previous);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await stopBoss().catch(() => undefined);
    await prisma.$disconnect();
  });
