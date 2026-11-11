import { prisma } from "../db";
import { renderPdf, mergePdfs } from "../pdf/render";
import { storeAsset } from "../storage";
import { pageSize } from "../layout/formats";
import { PDF_CHUNK_PAGES, PDF_CHUNK_THRESHOLD, pdfTimeoutMs } from "../kits/limits";

/**
 * Rendu d'un livre : en une fois jusqu'à PDF_CHUNK_THRESHOLD pages, sinon par tranches de
 * PDF_CHUNK_PAGES pages (mémoire de Chromium maîtrisée) fusionnées avec pdf-lib. Délais
 * proportionnels au nombre de pages.
 */
export async function renderBookPdf(o: { baseUrl: string; pages: number; widthMm: number; heightMm: number; mode: "print" | "digital"; log?: (m: string) => unknown }) {
  if (o.pages <= PDF_CHUNK_THRESHOLD) return renderPdf({ url: o.baseUrl, widthMm: o.widthMm, heightMm: o.heightMm, mode: o.mode, timeoutMs: pdfTimeoutMs(o.pages) });
  const parts: Buffer[] = [];
  const overflows: { pageIndex: number; blockId: string; kind: string }[] = [];
  const fonts = new Set<string>();
  let missingImages = 0;
  for (let from = 0; from < o.pages; from += PDF_CHUNK_PAGES) {
    const to = Math.min(o.pages, from + PDF_CHUNK_PAGES);
    await o.log?.(`PDF : pages ${from + 1} à ${to} sur ${o.pages}`);
    const sep = o.baseUrl.includes("?") ? "&" : "?";
    const r = await renderPdf({ url: `${o.baseUrl}${sep}from=${from}&to=${to}`, widthMm: o.widthMm, heightMm: o.heightMm, mode: o.mode, timeoutMs: pdfTimeoutMs(to - from) });
    parts.push(r.pdf);
    overflows.push(...r.overflows);
    r.fonts.forEach((f) => fonts.add(f));
    missingImages += r.missingImages;
  }
  const pdf = await mergePdfs(parts);
  const { PDFDocument } = await import("pdf-lib");
  return { pdf, pageCount: (await PDFDocument.load(pdf)).getPageCount(), overflows, missingImages, fonts: [...fonts] };
}
import type { ExportKind, Prisma } from "@prisma/client";

function appUrl() {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

/** Fige l'état complet du livre (reproductibilité des exports). */
export async function createSnapshot(bookId: string, label?: string) {
  const book = await prisma.book.findUniqueOrThrow({
    where: { id: bookId },
    include: {
      pages: { orderBy: { position: "asc" } },
      activities: { include: { activity: { include: { currentVersion: true, visualRef: true, illustrations: { where: { isCurrent: true }, include: { asset: true } } } } }, orderBy: { position: "asc" } },
      illustrations: { where: { isCurrent: true }, include: { asset: true } },
    },
  });
  const last = await prisma.bookSnapshot.findFirst({ where: { bookId }, orderBy: { version: "desc" } });
  return prisma.bookSnapshot.create({
    data: { bookId, version: (last?.version ?? 0) + 1, label, data: JSON.parse(JSON.stringify(book)) as Prisma.InputJsonValue },
  });
}

export async function runExport(exportId: string) {
  const exp = await prisma.export.findUniqueOrThrow({ where: { id: exportId }, include: { book: true } });
  await prisma.export.update({ where: { id: exportId }, data: { status: "RUNNING", error: null } });
  try {
    const size = exp.book ? pageSize(exp.book.pageFormat, exp.book.customWidthMm, exp.book.customHeightMm) : { widthMm: 210, heightMm: 297 };
    let pdf: Buffer;
    let pageCount = 0;
    const checks: Record<string, unknown> = {};
    const mode = exp.kind === "BOOK_DIGITAL" ? "digital" : "print";

    if (exp.kind === "BOOK_PRINT" || exp.kind === "BOOK_DIGITAL") {
      const snapshot = exp.snapshotId ? await prisma.bookSnapshot.findUnique({ where: { id: exp.snapshotId } }) : await createSnapshot(exp.bookId!, `Export ${exp.kind}`);
      const pages = await prisma.bookPage.count({ where: { bookId: exp.bookId! } });
      const r = await renderBookPdf({ baseUrl: `${appUrl()}/print/books/${exp.bookId}?snapshot=${snapshot!.id}`, pages, ...size, mode });
      pdf = r.pdf;
      pageCount = r.pageCount;
      Object.assign(checks, { overflows: r.overflows, missingImages: r.missingImages, fonts: r.fonts });
      await prisma.export.update({ where: { id: exportId }, data: { snapshotId: snapshot!.id } });
    } else if (exp.kind === "COVER") {
      const r = await renderPdf({ url: `${appUrl()}/print/books/${exp.bookId}?only=cover`, ...size, mode });
      pdf = r.pdf;
      pageCount = r.pageCount;
      Object.assign(checks, { overflows: r.overflows, missingImages: r.missingImages, fonts: r.fonts });
    } else if (exp.kind === "ACTIVITY") {
      const r = await renderPdf({ url: `${appUrl()}/print/activities/${exp.activityId}${exp.bookId ? `?book=${exp.bookId}` : ""}`, ...size, mode });
      pdf = r.pdf;
      pageCount = r.pageCount;
      Object.assign(checks, { overflows: r.overflows, missingImages: r.missingImages, fonts: r.fonts });
    } else {
      // ACTIVITY_SHEETS : une fiche par activité du livre, fusionnées
      const links = await prisma.bookActivity.findMany({ where: { bookId: exp.bookId!, activity: { currentVersionId: { not: null } } }, orderBy: { position: "asc" } });
      const parts: Buffer[] = [];
      let missing = 0;
      const overflows: unknown[] = [];
      for (const l of links) {
        const r = await renderPdf({ url: `${appUrl()}/print/activities/${l.activityId}?book=${exp.bookId}`, ...size, mode });
        parts.push(r.pdf);
        missing += r.missingImages;
        overflows.push(...r.overflows.map((o) => ({ ...o, activityId: l.activityId })));
      }
      pdf = await mergePdfs(parts);
      const { PDFDocument } = await import("pdf-lib");
      pageCount = (await PDFDocument.load(pdf)).getPageCount();
      Object.assign(checks, { overflows, missingImages: missing });
    }

    const expectedPages = exp.kind === "BOOK_PRINT" || exp.kind === "BOOK_DIGITAL" ? await prisma.bookPage.count({ where: { bookId: exp.bookId! } }) : undefined;
    checks.expectedPages = expectedPages;
    checks.pageCountOk = expectedPages === undefined || expectedPages === pageCount;
    checks.ok = checks.pageCountOk && (checks.missingImages as number) === 0 && ((checks.overflows as unknown[])?.length ?? 0) === 0;

    const key = `exports/${exp.bookId ?? exp.activityId}/${exportId}.pdf`;
    const asset = await storeAsset({ key, data: pdf, mime: "application/pdf" });
    await prisma.export.update({ where: { id: exportId }, data: { status: "COMPLETED", assetId: asset.id, pageCount, checks: checks as Prisma.InputJsonValue } });
    // Le statut « Exporté » n'est attribué qu'à un livre déjà marqué prêt (toutes les activités validées).
    if (exp.book?.status === "READY" && (exp.kind === "BOOK_PRINT" || exp.kind === "BOOK_DIGITAL")) {
      await prisma.book.update({ where: { id: exp.bookId! }, data: { status: "EXPORTED" } }).catch(() => undefined);
    }
    return { pageCount, checks };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.export.update({ where: { id: exportId }, data: { status: "FAILED", error: message } });
    throw err;
  }
}

export async function createExport(o: { kind: ExportKind; bookId?: string; activityId?: string; label?: string; snapshotId?: string }) {
  return prisma.export.create({ data: { kind: o.kind, bookId: o.bookId, activityId: o.activityId, label: o.label, snapshotId: o.snapshotId, status: "QUEUED" } });
}
