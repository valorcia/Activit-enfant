"use server";
import { revalidatePath } from "next/cache";
import sharp from "sharp";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { enqueue } from "@/lib/queue/jobs";
import { QUEUES } from "@/lib/queue/boss";
import { resumeJobIfReady } from "@/lib/manual/requests";
import { addSheetUpload, ensureSheetBatchRequest, paramsOf, recutSheet, removeSheetUpload, reorderSheetUploads, swapCells, updateCells, validateSheetBatch } from "@/lib/coloring/sheet-batch";
import { kitIllustrationPlan, readKitContent } from "@/lib/kits/generate";

type R<T = null> = { ok: true; data: T } | { ok: false; error: string };
const fail = (e: unknown): { ok: false; error: string } => ({ ok: false, error: e instanceof Error ? e.message : String(e) });

function refresh() {
  revalidatePath("/manual");
  revalidatePath("/books");
}

async function batchRequest(requestId: string) {
  const req = await prisma.manualRequest.findUnique({ where: { id: requestId } });
  if (!req || req.kind !== "IMAGE_BATCH") throw new Error("Lot d'images introuvable");
  return req;
}

/** Dépôt d'une planche (une image ; les ZIP sont décompressés dans le navigateur). */
export async function uploadSheetAction(formData: FormData): Promise<R<{ uploads: number }>> {
  try {
    const requestId = String(formData.get("requestId") ?? "");
    await batchRequest(requestId);
    const file = formData.get("file");
    if (!(file instanceof File) || !file.size) return { ok: false, error: "Aucun fichier reçu" };
    if (file.size > 30 * 1024 * 1024) return { ok: false, error: `${file.name} : image trop lourde (30 Mo maximum)` };
    const input = Buffer.from(await file.arrayBuffer());
    const png = await sharp(input).png().toBuffer();
    const meta = await sharp(png).metadata();
    const lastModified = Number(formData.get("lastModified") ?? file.lastModified ?? 0) || undefined;
    const p = await addSheetUpload(requestId, { name: String(formData.get("name") ?? file.name), lastModified, data: png, width: meta.width, height: meta.height });
    refresh();
    return { ok: true, data: { uploads: p.uploads.length } };
  } catch (e) {
    return fail(e);
  }
}

export async function reorderSheetsAction(requestId: string, assetIds: string[]): Promise<R> {
  try {
    await batchRequest(requestId);
    await reorderSheetUploads(requestId, assetIds);
    refresh();
    return { ok: true, data: null };
  } catch (e) {
    return fail(e);
  }
}

export async function removeSheetAction(requestId: string, assetId: string): Promise<R> {
  try {
    await batchRequest(requestId);
    await removeSheetUpload(requestId, assetId);
    refresh();
    return { ok: true, data: null };
  } catch (e) {
    return fail(e);
  }
}

/** Découpage automatique de toutes les planches (tâche du worker). */
export async function processSheetsAction(requestId: string): Promise<R<{ jobId: string }>> {
  try {
    const req = await batchRequest(requestId);
    const params = paramsOf(req.params);
    if (!params.uploads.length) return { ok: false, error: "Déposez d'abord les planches générées dans ChatGPT." };
    const job = await enqueue(QUEUES.coloringSheets, { requestId, bookId: req.bookId ?? undefined });
    params.stage = "processing";
    params.processJobId = job.id;
    await prisma.manualRequest.update({ where: { id: requestId }, data: { params: params as unknown as Prisma.InputJsonValue } });
    refresh();
    return { ok: true, data: { jobId: job.id } };
  } catch (e) {
    return fail(e);
  }
}

export async function swapCellsAction(requestId: string, a: number, b: number): Promise<R> {
  try {
    await batchRequest(requestId);
    await updateCells(requestId, (cells) => swapCells(cells, a, b));
    refresh();
    return { ok: true, data: null };
  } catch (e) {
    return fail(e);
  }
}

export async function toggleRejectCellAction(requestId: string, index: number): Promise<R> {
  try {
    await batchRequest(requestId);
    await updateCells(requestId, (cells) => cells.map((c) => (c.index === index ? { ...c, rejected: !c.rejected || undefined } : c)));
    refresh();
    return { ok: true, data: null };
  } catch (e) {
    return fail(e);
  }
}

/** Réglage manuel des lignes de découpe d'une planche (positions en fraction de la largeur / hauteur). */
export async function recutSheetAction(requestId: string, sheet: number, fx: number[], fy: number[]): Promise<R> {
  try {
    const req = await batchRequest(requestId);
    const u = paramsOf(req.params).uploads[sheet];
    if (!u?.width || !u?.height) return { ok: false, error: "Planche introuvable" };
    await recutSheet(requestId, sheet, fx.map((f) => Math.round(f * u.width!)), fy.map((f) => Math.round(f * u.height!)));
    refresh();
    return { ok: true, data: null };
  } catch (e) {
    return fail(e);
  }
}

/** « Valider » : crée les illustrations et relance la production (mise en page, PDF, publication…). */
export async function validateSheetsAction(requestId: string): Promise<R<{ created: number; rejected: number; missing: number; resumed: string }>> {
  try {
    const req = await batchRequest(requestId);
    const r = await validateSheetBatch(requestId);
    const resumed = await resumeJobIfReady(req.jobId);
    refresh();
    return { ok: true, data: { ...r, resumed } };
  } catch (e) {
    return fail(e);
  }
}

/** Dessins par planche (1, 2×2, 3×3) : refait le prompt maître (planches non encore déposées). */
export async function setSheetGridAction(requestId: string, grid: 1 | 4 | 9): Promise<R> {
  try {
    const req = await batchRequest(requestId);
    if (paramsOf(req.params).uploads.length) return { ok: false, error: "Des planches sont déjà déposées : retirez-les avant de changer la grille." };
    const book = await prisma.book.findUniqueOrThrow({ where: { id: req.bookId! } });
    const cust = (book.customization ?? {}) as Record<string, unknown>;
    await prisma.book.update({ where: { id: book.id }, data: { customization: { ...cust, ai: { ...((cust.ai as object) ?? {}), sheetGrid: grid } } as Prisma.InputJsonValue } });
    const content = readKitContent(book);
    if (!content) return { ok: false, error: "Contenu du cahier absent" };
    if (grid === 1) {
      // Un dessin par image : retour aux demandes individuelles (créées à la reprise de la tâche)
      await prisma.manualRequest.update({ where: { id: requestId }, data: { status: "CANCELLED" } });
      await resumeJobIfReady(req.jobId);
    } else await ensureSheetBatchRequest(book.id, req.jobId ?? "", kitIllustrationPlan(content, { ...book, customization: { ...cust, ai: { ...((cust.ai as object) ?? {}), sheetGrid: grid } } }));
    refresh();
    return { ok: true, data: null };
  } catch (e) {
    return fail(e);
  }
}
