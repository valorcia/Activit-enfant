"use server";
import { revalidatePath } from "next/cache";
import sharp from "sharp";
import { prisma } from "@/lib/db";
import { getAiSettings, saveAiSettings } from "@/lib/settings";
import { storeAsset } from "@/lib/storage";
import { schemaByName } from "@/lib/ai/manual-schemas";
import { cleanPastedJson, splitBatchResponse } from "@/lib/ai/manual-core";
import { extractJson } from "@/lib/ai/structured";
import { resumeJobIfReady } from "@/lib/manual/requests";

export type ManualActionResult = { ok: true; resumed: "requeued" | "waiting" | "none" } | { ok: false; error: string };

function revalidateAll() {
  revalidatePath("/manual");
  revalidatePath("/jobs");
  revalidatePath("/books");
  revalidatePath("/", "layout");
}

/** Bascule rapide API ↔ copier-coller (tout). */
export async function toggleManualModeAction(): Promise<{ mode: "api" | "manual" }> {
  const s = await getAiSettings();
  const mode = s.mode === "manual" ? "api" : "manual";
  await saveAiSettings({ ...s, mode, manualFor: mode === "manual" ? "all" : s.manualFor });
  revalidatePath("/", "layout");
  return { mode };
}

/** Valide une réponse texte collée pour une demande : nettoyage, validation Zod, enregistrement, reprise. */
export async function resolveTextRequestAction(requestId: string, pasted: string): Promise<ManualActionResult> {
  const req = await prisma.manualRequest.findUnique({ where: { id: requestId } });
  if (!req || req.kind !== "TEXT") return { ok: false, error: "Demande introuvable" };
  if (req.status === "DONE") return { ok: true, resumed: "none" };
  const validation = validateText(req.schemaName, pasted);
  if (!validation.ok) {
    await prisma.manualRequest.update({ where: { id: req.id }, data: { error: validation.error } });
    revalidatePath("/manual");
    return { ok: false, error: validation.error };
  }
  await prisma.manualRequest.update({ where: { id: req.id }, data: { status: "DONE", responseText: validation.json, error: null, resolvedAt: new Date() } });
  const resumed = await resumeJobIfReady(req.jobId);
  revalidateAll();
  return { ok: true, resumed };
}

/** Collage de plusieurs réponses d'un coup (sections « ### DEMANDE <id> »). */
export async function resolveBatchAction(pasted: string): Promise<{ resolved: number; errors: string[]; resumed: number }> {
  const parts = splitBatchResponse(pasted);
  if (parts.length === 0) return { resolved: 0, errors: ["Aucune section « ### DEMANDE <identifiant> » trouvée dans le texte collé."], resumed: 0 };
  let resolved = 0;
  let resumed = 0;
  const errors: string[] = [];
  for (const part of parts) {
    const req = await prisma.manualRequest.findUnique({ where: { id: part.id } });
    if (!req) {
      errors.push(`${part.id} : demande inconnue`);
      continue;
    }
    if (req.status === "DONE") continue;
    const v = validateText(req.schemaName, part.body);
    if (!v.ok) {
      errors.push(`${req.title} : ${v.error}`);
      await prisma.manualRequest.update({ where: { id: req.id }, data: { error: v.error } });
      continue;
    }
    await prisma.manualRequest.update({ where: { id: req.id }, data: { status: "DONE", responseText: v.json, error: null, resolvedAt: new Date() } });
    resolved++;
    if ((await resumeJobIfReady(req.jobId)) === "requeued") resumed++;
  }
  revalidateAll();
  return { resolved, errors, resumed };
}

/** Téléverse l'image produite pour une demande image. */
export async function resolveImageRequestAction(formData: FormData): Promise<ManualActionResult> {
  const requestId = String(formData.get("requestId") ?? "");
  const file = formData.get("file");
  const req = await prisma.manualRequest.findUnique({ where: { id: requestId } });
  if (!req || req.kind !== "IMAGE") return { ok: false, error: "Demande introuvable" };
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Aucun fichier reçu" };
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return { ok: false, error: "Format accepté : PNG, JPG ou WebP" };
  if (file.size > 25 * 1024 * 1024) return { ok: false, error: "Image trop lourde (25 Mo maximum)" };
  try {
    const input = Buffer.from(await file.arrayBuffer());
    const png = await sharp(input).png().toBuffer();
    const meta = await sharp(png).metadata();
    const asset = await storeAsset({ key: `manual/${req.id}.png`, data: png, mime: "image/png", width: meta.width, height: meta.height });
    await prisma.manualRequest.update({ where: { id: req.id }, data: { status: "DONE", assetId: asset.id, error: null, resolvedAt: new Date() } });
    const resumed = await resumeJobIfReady(req.jobId);
    revalidateAll();
    return { ok: true, resumed };
  } catch (e) {
    const error = `Image illisible : ${e instanceof Error ? e.message : String(e)}`;
    await prisma.manualRequest.update({ where: { id: req.id }, data: { error } });
    return { ok: false, error };
  }
}

const VIDEO_MIME: Record<string, string> = { "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov" };

/** Téléverse le clip vidéo produit à la main (Runway, Sora, Veo) pour une demande vidéo. */
export async function resolveVideoRequestAction(formData: FormData): Promise<ManualActionResult> {
  const requestId = String(formData.get("requestId") ?? "");
  const file = formData.get("file");
  const req = await prisma.manualRequest.findUnique({ where: { id: requestId } });
  if (!req || req.kind !== "VIDEO") return { ok: false, error: "Demande introuvable" };
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Aucun fichier reçu" };
  const ext = VIDEO_MIME[file.type] ?? (/\.(mp4|webm|mov)$/i.exec(file.name)?.[1]?.toLowerCase());
  if (!ext) return { ok: false, error: "Format accepté : MP4, WebM ou MOV" };
  if (file.size > 200 * 1024 * 1024) return { ok: false, error: "Vidéo trop lourde (200 Mo maximum)" };
  const mime = ext === "mov" ? "video/quicktime" : `video/${ext}`;
  const data = Buffer.from(await file.arrayBuffer());
  const asset = await storeAsset({ key: `manual/${req.id}.${ext}`, data, mime });
  await prisma.manualRequest.update({ where: { id: req.id }, data: { status: "DONE", assetId: asset.id, error: null, resolvedAt: new Date() } });
  const resumed = await resumeJobIfReady(req.jobId);
  revalidateAll();
  revalidatePath("/videos");
  return { ok: true, resumed };
}

/** Annule une demande : la tâche reste en attente avec une erreur explicite. */
export async function cancelRequestAction(requestId: string): Promise<void> {
  const req = await prisma.manualRequest.findUnique({ where: { id: requestId } });
  if (!req || req.status === "DONE") return;
  await prisma.manualRequest.update({ where: { id: req.id }, data: { status: "CANCELLED", resolvedAt: new Date() } });
  if (req.jobId) {
    await prisma.job.updateMany({ where: { id: req.jobId, status: "WAITING_INPUT" }, data: { error: `Demande annulée : ${req.title}. Relancez la tâche pour la redemander.` } });
  }
  revalidateAll();
}

function validateText(schemaName: string | null, pasted: string): { ok: true; json: string } | { ok: false; error: string } {
  const cleaned = cleanPastedJson(pasted);
  const parsed = extractJson(cleaned);
  if (parsed === null) return { ok: false, error: "Le texte collé ne contient pas d'objet JSON lisible. Copiez toute la réponse de l'assistant, y compris les accolades." };
  const schema = schemaByName(schemaName);
  if (schema) {
    const r = schema.safeParse(parsed);
    if (!r.success) {
      const issues = r.error.issues.slice(0, 6).map((i) => `${i.path.join(".") || "(racine)"} : ${i.message}`).join(" · ");
      return { ok: false, error: `Réponse incomplète ou mal formée — ${issues}. Redemandez à l'assistant de corriger ces points et recollez.` };
    }
    return { ok: true, json: JSON.stringify(r.data) };
  }
  return { ok: true, json: JSON.stringify(parsed) };
}
