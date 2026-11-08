import { prisma } from "@/lib/db";
import { apiError, apiOk, authenticateApiKey } from "@/lib/api/auth";
import { attachPrivateFile, removeFilesByKind } from "@/lib/api/media";
import { fileKindSchema } from "@/lib/schemas/product";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/v1/products/:id/files — multipart (file, kind, name, description, replace) → stockage privé.
 *  `replace=1` : remplace les fichiers existants du même type (re-synchronisation idempotente). */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await authenticateApiKey(req, "products:write");
  if (!auth.ok) return apiError(auth.status, auth.error);
  const { id } = await ctx.params;
  const product = await prisma.product.findUnique({ where: { id }, select: { id: true } });
  if (!product) return apiError(404, "Produit introuvable");
  if (!(req.headers.get("content-type") ?? "").includes("multipart/form-data")) return apiError(400, "multipart/form-data attendu");
  try {
    const fd = await req.formData();
    const file = fd.get("file");
    if (!(file instanceof File)) return apiError(400, "Champ « file » manquant");
    const kind = fileKindSchema.catch("MAIN_PDF").parse(fd.get("kind") ?? "MAIN_PDF");
    const replace = fd.get("replace");
    if (replace === "1" || replace === "true") await removeFilesByKind(id, kind);
    const name = ((fd.get("name") as string) || file.name || "fichier.pdf").slice(0, 160);
    const created = await attachPrivateFile(id, Buffer.from(await file.arrayBuffer()), file.type || "application/pdf", { name, kind, description: (fd.get("description") as string) || null });
    return apiOk({ id: created.id, name: created.name, kind: created.kind, sizeBytes: created.sizeBytes, mime: created.mime }, 201);
  } catch (e) {
    return apiError(400, e instanceof Error ? e.message : "Erreur");
  }
}
