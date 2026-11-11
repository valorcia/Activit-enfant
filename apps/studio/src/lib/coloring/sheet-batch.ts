/**
 * Copier-coller « en lot » des cahiers de coloriage : au lieu d'une demande par dessin,
 * UNE demande « Lot d'images » avec un prompt maître à coller dans ChatGPT (planches de 4 ou
 * 9 dessins), un dépôt groupé des planches, un découpage automatique et un écran de
 * vérification avant de créer les illustrations et de relancer la production.
 */
import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { getStorage, storeAsset } from "../storage";
import { KitCustomizationSchema } from "../kits/schemas";
import { kitType } from "../kits/types";
import { coloringCharterFor, coloringComplexity, drawingNumber, isDrawingSlot } from "../kits/coloring";
import { getStudioSettings } from "../settings";
import { gridSide, orderUploads, processCell, splitSheet, type SheetGrid } from "./split";
import { buildSheetMasterPrompt, sheetCount } from "./sheet-prompt";

export { buildSheetMasterPrompt, sheetCount };

export const SHEET_BATCH_PURPOSE = "coloring_sheets";

export interface SheetDrawing {
  slot: string;
  numero: number;
  titre: string;
  description: string;
}

export interface StagedCell {
  /** Rang global (ordre de lecture des planches) */
  index: number;
  sheet: number;
  cell: number;
  slot: string | null;
  pngAssetId: string;
  svgAssetId: string | null;
  rejected?: boolean;
}

export interface SheetUpload {
  assetId: string;
  name: string;
  lastModified?: number;
  fallback?: boolean;
  /** Lignes de découpe réglées à la main (conservées si on relance le découpage) */
  manualCuts?: boolean;
  cutsX?: number[];
  cutsY?: number[];
  width?: number;
  height?: number;
}

export interface SheetBatchParams {
  grid: SheetGrid;
  drawings: SheetDrawing[];
  uploads: SheetUpload[];
  cells: StagedCell[];
  /** pending : à déposer · processing : découpage en cours · review : à vérifier · done */
  stage: "pending" | "processing" | "review" | "done";
  processJobId?: string;
  error?: string | null;
  rejectedSlots?: string[];
}

export function paramsOf(raw: unknown): SheetBatchParams {
  const p = (raw ?? {}) as Partial<SheetBatchParams>;
  return { grid: (p.grid ?? 4) as SheetGrid, drawings: p.drawings ?? [], uploads: p.uploads ?? [], cells: p.cells ?? [], stage: p.stage ?? "pending", processJobId: p.processJobId, error: p.error ?? null, rejectedSlots: p.rejectedSlots ?? [] };
}

/** Dessins par planche choisis pour le livre (défaut 2×2). */
export function sheetGridOf(book: { customization?: unknown }): SheetGrid {
  const c = KitCustomizationSchema.safeParse(book.customization ?? {});
  return (c.success ? c.data.ai?.sheetGrid : undefined) ?? 4;
}

/** Emplacements rejetés à l'écran de vérification : ils repassent en demande individuelle (ou par l'API). */
export async function rejectedSheetSlots(bookId: string): Promise<Set<string>> {
  const done = await prisma.manualRequest.findMany({ where: { bookId, kind: "IMAGE_BATCH", status: "DONE" }, select: { params: true } });
  return new Set(done.flatMap((r) => paramsOf(r.params).rejectedSlots ?? []));
}

/**
 * Crée (ou retrouve) la demande « Lot d'images » des dessins sans image du livre.
 * pending=false : rien à produire en lot (tout est déjà là, ou les restants sont des rejets).
 */
export async function ensureSheetBatchRequest(bookId: string, jobId: string, plan: Array<{ slot: string; prompt: string; label: string }>): Promise<{ pending: boolean; drawings: number; sheets: number; requestId?: string }> {
  const book = await prisma.book.findUniqueOrThrow({ where: { id: bookId } });
  if (kitType(book.kitType).format !== "coloring") return { pending: false, drawings: 0, sheets: 0 };
  const grid = sheetGridOf(book);
  const have = await prisma.illustration.findMany({ where: { bookId, kind: "KIT", isCurrent: true, status: { in: ["GENERATED", "ACCEPTED"] }, assetId: { not: null } }, select: { slot: true } });
  const haveSlots = new Set(have.map((h) => h.slot));
  const rejected = await rejectedSheetSlots(bookId);
  const content = (book.kitContent ?? {}) as { dessins?: Array<{ numero: number; titre: string; description: string }> };
  const byNumber = new Map((content.dessins ?? []).map((d) => [d.numero, d]));
  const drawings: SheetDrawing[] = plan
    .filter((p) => isDrawingSlot(p.slot) && !haveSlots.has(p.slot) && !rejected.has(p.slot))
    .map((p) => {
      const n = drawingNumber(p.slot)!;
      const d = byNumber.get(n);
      return { slot: p.slot, numero: n, titre: d?.titre ?? p.label, description: d?.description ?? p.prompt };
    });
  if (!drawings.length) return { pending: false, drawings: 0, sheets: 0 };
  const fp = createHash("sha256").update(JSON.stringify(["IMAGE_BATCH", bookId, grid, drawings.map((d) => d.slot)])).digest("hex");
  const existing = await prisma.manualRequest.findUnique({ where: { fingerprint: fp } });
  const sheets = sheetCount(drawings.length, grid);
  if (existing?.status === "DONE") return { pending: false, drawings: drawings.length, sheets };
  if (existing) {
    await prisma.manualRequest.update({ where: { id: existing.id }, data: { status: "PENDING", jobId } });
    return { pending: true, drawings: drawings.length, sheets, requestId: existing.id };
  }
  // Une seule demande de lot ouverte par livre : l'ancienne (autre liste de dessins) est remplacée
  await prisma.manualRequest.updateMany({ where: { bookId, kind: "IMAGE_BATCH", status: "PENDING" }, data: { status: "CANCELLED" } });
  const studio = await getStudioSettings();
  const prompt = buildSheetMasterPrompt({ title: book.title, ageRange: book.ageRange, charter: coloringCharterFor(studio.illustrationCharters), complexity: coloringComplexity(book.ageRange), grid, drawings });
  const params: SheetBatchParams = { grid, drawings, uploads: [], cells: [], stage: "pending" };
  const req = await prisma.manualRequest.create({
    data: {
      kind: "IMAGE_BATCH",
      fingerprint: fp,
      title: `Lot d'images : ${drawings.length} dessins en ${sheets} planche(s) — ${book.title}`,
      prompt,
      expectedFormat: `${sheets} image(s) portrait 1024×1536 (${grid === 1 ? "un dessin" : `${grid} dessins en grille ${gridSide(grid)}×${gridSide(grid)}`} par image), à déposer d'un coup (plusieurs fichiers ou un ZIP).`,
      purpose: SHEET_BATCH_PURPOSE,
      params: params as unknown as Prisma.InputJsonValue,
      bookId,
      jobId,
    },
  });
  return { pending: true, drawings: drawings.length, sheets, requestId: req.id };
}

async function saveParams(requestId: string, params: SheetBatchParams) {
  await prisma.manualRequest.update({ where: { id: requestId }, data: { params: params as unknown as Prisma.InputJsonValue } });
}

/** Ajoute une planche déposée (image déjà convertie en PNG). */
export async function addSheetUpload(requestId: string, file: { name: string; lastModified?: number; data: Buffer; width?: number; height?: number }) {
  const req = await prisma.manualRequest.findUniqueOrThrow({ where: { id: requestId } });
  const params = paramsOf(req.params);
  const asset = await storeAsset({ key: `manual/${requestId}/planche-${Date.now()}-${params.uploads.length + 1}.png`, data: file.data, mime: "image/png", width: file.width, height: file.height });
  params.uploads = orderUploads([...params.uploads, { assetId: asset.id, name: file.name, lastModified: file.lastModified, width: file.width, height: file.height }]);
  params.stage = "pending";
  await saveParams(requestId, params);
  return params;
}

/** Ordre des planches choisi par l'utilisateur (glisser-déposer) avant découpage. */
export async function reorderSheetUploads(requestId: string, assetIds: string[]) {
  const req = await prisma.manualRequest.findUniqueOrThrow({ where: { id: requestId } });
  const params = paramsOf(req.params);
  const byId = new Map(params.uploads.map((u) => [u.assetId, u]));
  params.uploads = [...assetIds.map((id) => byId.get(id)).filter((u): u is SheetUpload => Boolean(u)), ...params.uploads.filter((u) => !assetIds.includes(u.assetId))];
  await saveParams(requestId, params);
  return params;
}

export async function removeSheetUpload(requestId: string, assetId: string) {
  const req = await prisma.manualRequest.findUniqueOrThrow({ where: { id: requestId } });
  const params = paramsOf(req.params);
  params.uploads = params.uploads.filter((u) => u.assetId !== assetId);
  params.cells = params.cells.filter((c) => params.uploads[c.sheet]?.assetId);
  await saveParams(requestId, params);
  return params;
}

/** Affectation des cases aux dessins dans l'ordre (planche par planche, ordre de lecture). */
export function assignSlots(cells: Array<Omit<StagedCell, "index" | "slot">>, drawings: SheetDrawing[]): StagedCell[] {
  return cells.map((c, i) => ({ ...c, index: i, slot: drawings[i]?.slot ?? null }));
}

/** Échange les dessins de deux cases (réaffectation : les emplacements restent dans l'ordre du sommaire). */
export function swapCells(cells: StagedCell[], a: number, b: number): StagedCell[] {
  const out = cells.map((c) => ({ ...c }));
  const ia = out.findIndex((c) => c.index === a);
  const ib = out.findIndex((c) => c.index === b);
  if (ia < 0 || ib < 0) return out;
  const keep = ["pngAssetId", "svgAssetId", "sheet", "cell", "rejected"] as const;
  for (const k of keep) {
    const tmp = out[ia][k];
    (out[ia] as unknown as Record<string, unknown>)[k] = out[ib][k];
    (out[ib] as unknown as Record<string, unknown>)[k] = tmp;
  }
  return out;
}

/** Découpe une planche et enregistre ses cases (PNG noir et blanc + SVG vectorisé). */
async function cutSheet(requestId: string, sheetIndex: number, upload: SheetUpload, grid: SheetGrid, manual?: { cutsX: number[]; cutsY: number[] }) {
  const storage = getStorage();
  const asset = await prisma.asset.findUniqueOrThrow({ where: { id: upload.assetId } });
  const data = await storage.get(asset.key);
  const split = await splitSheet(data, grid, manual);
  const cells: Array<Omit<StagedCell, "index" | "slot">> = [];
  for (let i = 0; i < split.cells.length; i++) {
    const r = await processCell(split.cells[i]);
    const png = await storeAsset({ key: `manual/${requestId}/cases/p${sheetIndex + 1}-c${i + 1}-${Date.now()}.png`, data: r.png, mime: "image/png", width: r.width, height: r.height });
    const svg = r.svg ? await storeAsset({ key: `manual/${requestId}/cases/p${sheetIndex + 1}-c${i + 1}-${Date.now()}.svg`, data: Buffer.from(r.svg), mime: "image/svg+xml", width: r.width, height: r.height }) : null;
    cells.push({ sheet: sheetIndex, cell: i, pngAssetId: png.id, svgAssetId: svg?.id ?? null });
  }
  return { cells, split };
}

/** Découpage de toutes les planches déposées (tâche du worker « coloring.sheets »). */
export async function processSheetBatch(requestId: string, log?: (m: string) => Promise<unknown> | unknown) {
  const req = await prisma.manualRequest.findUniqueOrThrow({ where: { id: requestId } });
  const params = paramsOf(req.params);
  params.stage = "processing";
  params.error = null;
  await saveParams(requestId, params);
  try {
    const all: Array<Omit<StagedCell, "index" | "slot">> = [];
    for (let s = 0; s < params.uploads.length; s++) {
      const u = params.uploads[s];
      const manual = u.manualCuts && u.cutsX && u.cutsY ? { cutsX: u.cutsX, cutsY: u.cutsY } : undefined;
      const { cells, split } = await cutSheet(requestId, s, u, params.grid, manual);
      params.uploads[s] = { ...u, fallback: split.fallback, cutsX: split.cutsX, cutsY: split.cutsY, width: split.width, height: split.height };
      all.push(...cells);
      await log?.(`Planche ${s + 1}/${params.uploads.length} découpée${split.fallback ? " (découpe régulière : gouttières introuvables)" : ""}`);
    }
    params.cells = assignSlots(all, params.drawings);
    params.stage = "review";
  } catch (e) {
    params.stage = "pending";
    params.error = e instanceof Error ? e.message : String(e);
  }
  await saveParams(requestId, params);
  return params;
}

/** Réglage manuel des lignes de découpe d'une planche (planche mal découpée). */
export async function recutSheet(requestId: string, sheetIndex: number, cutsX: number[], cutsY: number[]) {
  const req = await prisma.manualRequest.findUniqueOrThrow({ where: { id: requestId } });
  const params = paramsOf(req.params);
  const u = params.uploads[sheetIndex];
  if (!u) throw new Error("Planche introuvable");
  const n = gridSide(params.grid);
  if (cutsX.length !== n - 1 || cutsY.length !== n - 1) throw new Error(`Il faut ${n - 1} ligne(s) de découpe dans chaque sens`);
  const { cells } = await cutSheet(requestId, sheetIndex, u, params.grid, { cutsX: [...cutsX].sort((a, b) => a - b), cutsY: [...cutsY].sort((a, b) => a - b) });
  params.uploads[sheetIndex] = { ...u, cutsX, cutsY, fallback: false, manualCuts: true };
  // Remplace les cases de cette planche en gardant l'ordre global, puis réaffecte les emplacements
  const others = params.cells.filter((c) => c.sheet !== sheetIndex).map(({ index: _i, slot: _s, ...rest }) => rest);
  const merged = [...others, ...cells].sort((a, b) => a.sheet - b.sheet || a.cell - b.cell);
  const rejected = new Set(params.cells.filter((c) => c.rejected).map((c) => `${c.sheet}:${c.cell}`));
  params.cells = assignSlots(merged.map((c) => ({ ...c, rejected: rejected.has(`${c.sheet}:${c.cell}`) || undefined })), params.drawings);
  await saveParams(requestId, params);
  return params;
}

export async function updateCells(requestId: string, fn: (cells: StagedCell[]) => StagedCell[]) {
  const req = await prisma.manualRequest.findUniqueOrThrow({ where: { id: requestId } });
  const params = paramsOf(req.params);
  params.cells = fn(params.cells);
  await saveParams(requestId, params);
  return params;
}

/**
 * « Valider » : crée une illustration par dessin accepté (SVG vectorisé, sinon PNG agrandi),
 * note les dessins rejetés (ils repasseront en demande individuelle ou par l'API) et clôt la demande.
 */
export async function validateSheetBatch(requestId: string): Promise<{ created: number; rejected: number; missing: number }> {
  const req = await prisma.manualRequest.findUniqueOrThrow({ where: { id: requestId } });
  if (!req.bookId) throw new Error("Demande sans livre");
  const params = paramsOf(req.params);
  let created = 0;
  const rejectedSlots: string[] = [];
  for (const c of params.cells) {
    if (!c.slot) continue;
    if (c.rejected) {
      rejectedSlots.push(c.slot);
      continue;
    }
    const assetId = c.svgAssetId ?? c.pngAssetId;
    const d = params.drawings.find((x) => x.slot === c.slot);
    const previous = await prisma.illustration.findFirst({ where: { bookId: req.bookId, kind: "KIT", slot: c.slot, isCurrent: true }, orderBy: { version: "desc" } });
    if (previous) await prisma.illustration.update({ where: { id: previous.id }, data: { isCurrent: false } });
    await prisma.illustration.create({
      data: { bookId: req.bookId, kind: "KIT", slot: c.slot, version: (previous?.version ?? 0) + 1, parentId: previous?.id, status: "GENERATED", prompt: d ? `${d.titre} : ${d.description}` : null, provider: "manual", model: "manual", isCurrent: true, assetId, isDemo: false, costUsd: 0, targetRatio: "portrait", fit: "contain", quality: "medium" },
    });
    created++;
  }
  const covered = new Set(params.cells.filter((c) => c.slot).map((c) => c.slot));
  const missing = params.drawings.filter((d) => !covered.has(d.slot));
  rejectedSlots.push(...missing.map((d) => d.slot));
  params.rejectedSlots = rejectedSlots;
  params.stage = "done";
  await prisma.manualRequest.update({ where: { id: requestId }, data: { status: "DONE", resolvedAt: new Date(), params: params as unknown as Prisma.InputJsonValue } });
  return { created, rejected: rejectedSlots.length - missing.length, missing: missing.length };
}
