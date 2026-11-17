import { nanoid } from "nanoid";
import { prisma } from "@/lib/db";
import { apiError, apiOk, authenticateApiKey } from "@/lib/api/auth";
import { audit } from "@/lib/audit";
import { getStorage, safeFileName } from "@/lib/storage";
import { attachPersonalFile, getForStudio, PersonalItemError, personalFilePrefix } from "@/lib/unwritten/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_DIRECT = 4 * 1024 * 1024; // limite de corps de requête Vercel : au-delà, /file/presign

/** POST /api/v1/personal/items/:id/file — multipart (file) : PDF final envoyé directement (petits fichiers, stockage local). */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await authenticateApiKey(req, "personal:write");
  if (!auth.ok) return apiError(auth.status, auth.error);
  const { id } = await ctx.params;
  const item = await prisma.personalOrderItem.findUnique({ where: { id }, select: { id: true } });
  if (!item) return apiError(404, "Livre introuvable");
  if (!(req.headers.get("content-type") ?? "").includes("multipart/form-data")) return apiError(400, "multipart/form-data attendu");
  const fd = await req.formData();
  const file = fd.get("file");
  if (!(file instanceof File)) return apiError(400, "Champ « file » manquant");
  if ((file.type || "application/pdf") !== "application/pdf") return apiError(422, "PDF attendu");
  if (file.size > MAX_DIRECT) return apiError(413, "Fichier trop volumineux : utilisez /file/presign puis /file/register");
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.subarray(0, 5).toString() !== "%PDF-") return apiError(422, "Le fichier n'est pas un PDF valide");
  const name = (String(fd.get("name") ?? "") || file.name || "book.pdf").slice(0, 160);
  const key = `${personalFilePrefix(id)}${nanoid(10)}-${safeFileName(name)}`;
  try {
    await getStorage().put(key, buf, "application/pdf");
    await attachPersonalFile(id, { key, name, mime: "application/pdf", size: buf.length });
  } catch (e) {
    if (e instanceof PersonalItemError) return apiError(e.status, e.message);
    throw e;
  }
  await audit({ actor: `api:${auth.key.prefix}`, action: "personal.file", entity: "personalOrderItem", entityId: id });
  return apiOk(await getForStudio(id), 201);
}
