import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiError, apiOk, authenticateApiKey } from "@/lib/api/auth";
import { presignPrivateFile } from "@/lib/api/file-presign";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ name: z.string().min(1).max(160), mime: z.string().default("application/pdf") });

/** POST /api/v1/products/:id/files/presign — URL signée pour déposer un gros PDF directement dans le stockage privé (null en stockage local). */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await authenticateApiKey(req, "products:write");
  if (!auth.ok) return apiError(auth.status, auth.error);
  const { id } = await ctx.params;
  const product = await prisma.product.findUnique({ where: { id }, select: { id: true } });
  if (!product) return apiError(404, "Produit introuvable");
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return apiError(400, "Corps invalide : { name, mime }");
  try {
    return apiOk(await presignPrivateFile(id, parsed.data.name, parsed.data.mime));
  } catch (e) {
    return apiError(400, e instanceof Error ? e.message : "Erreur");
  }
}
