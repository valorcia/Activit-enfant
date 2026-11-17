import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiError, apiOk, authenticateApiKey } from "@/lib/api/auth";
import { presignPrivateUpload } from "@/lib/api/file-presign";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ name: z.string().min(1).max(160) });

/**
 * POST /api/v1/personal/items/:id/file/presign { name } — URL signée (15 min) pour déposer le PDF final
 * directement dans le stockage PRIVÉ (même mécanisme que les fichiers produits). `data: null` en stockage local :
 * utilisez alors POST /file (multipart).
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await authenticateApiKey(req, "personal:write");
  if (!auth.ok) return apiError(auth.status, auth.error);
  const { id } = await ctx.params;
  const item = await prisma.personalOrderItem.findUnique({ where: { id }, select: { id: true } });
  if (!item) return apiError(404, "Livre introuvable");
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return apiError(400, "Corps invalide : { name }");
  try {
    return apiOk(await presignPrivateUpload(`personal/${id}`, parsed.data.name, "application/pdf"));
  } catch (e) {
    return apiError(400, e instanceof Error ? e.message : "Erreur");
  }
}
