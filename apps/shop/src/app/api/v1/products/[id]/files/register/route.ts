import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiError, apiOk, authenticateApiKey } from "@/lib/api/auth";
import { removeFilesByKind } from "@/lib/api/media";
import { registerPrivateFile } from "@/lib/api/file-presign";
import { fileKindSchema } from "@/lib/schemas/product";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ key: z.string().min(1).max(400), name: z.string().min(1).max(160), mime: z.string().default("application/pdf"), kind: fileKindSchema.catch("MAIN_PDF").default("MAIN_PDF"), description: z.string().max(500).nullish(), replace: z.boolean().default(false) });

/** POST /api/v1/products/:id/files/register — enregistre un fichier déposé par URL signée (après /files/presign). */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await authenticateApiKey(req, "products:write");
  if (!auth.ok) return apiError(auth.status, auth.error);
  const { id } = await ctx.params;
  const product = await prisma.product.findUnique({ where: { id }, select: { id: true } });
  if (!product) return apiError(404, "Produit introuvable");
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return apiError(400, "Corps invalide : { key, name, mime, kind, replace }");
  try {
    const b = parsed.data;
    if (b.replace) {
      // On ne supprime pas le fichier qu'on vient de déposer
      const old = await prisma.productFile.findMany({ where: { productId: id, kind: b.kind, storageKey: { not: b.key } }, select: { id: true } });
      if (old.length) await removeFilesByKind(id, b.kind);
    }
    const created = await registerPrivateFile(id, b.key, { name: b.name, mime: b.mime, kind: b.kind, description: b.description ?? null });
    return apiOk({ id: created.id, name: created.name, kind: created.kind, sizeBytes: created.sizeBytes, mime: created.mime }, 201);
  } catch (e) {
    return apiError(400, e instanceof Error ? e.message : "Erreur");
  }
}
