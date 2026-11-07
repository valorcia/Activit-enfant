import { z } from "zod";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { apiError, apiOk, authenticateApiKey } from "@/lib/api/auth";
import { apiProductSelect, serializeProduct } from "@/lib/api/products";
import { setProductStatus } from "@/lib/products/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ scheduledAt: z.coerce.date().optional() });

/**
 * POST /api/v1/products/:id/publish
 *  - { scheduledAt } : programme la publication (scope products:write suffit) ;
 *  - sans date : publication immédiate UNIQUEMENT avec le scope products:publish,
 *    sinon 403 et le produit reste en attente de validation humaine.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await authenticateApiKey(req, "products:write");
  if (!auth.ok) return apiError(auth.status, auth.error);
  const { id } = await ctx.params;
  const product = await prisma.product.findUnique({ where: { id }, select: { id: true, status: true, files: { select: { id: true } } } });
  if (!product) return apiError(404, "Produit introuvable");
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return apiError(422, "Données invalides", parsed.error.issues);
  if (product.files.length === 0) return apiError(409, "Aucun fichier numérique attaché : ajoutez le PDF avant de publier");
  const actor = { actor: `api:${auth.key.prefix}`, source: "api" };
  if (parsed.data.scheduledAt) {
    if (parsed.data.scheduledAt.getTime() < Date.now() - 60_000) return apiError(422, "La date de publication doit être dans le futur");
    await setProductStatus(id, "SCHEDULED", actor, parsed.data.scheduledAt);
  } else {
    if (!auth.key.scopes.includes("products:publish")) {
      return apiError(403, "Publication directe non autorisée pour cette clé : le produit reste en attente de validation humaine (ou utilisez scheduledAt)");
    }
    await setProductStatus(id, "PUBLISHED", actor);
  }
  const full = await prisma.product.findUniqueOrThrow({ where: { id }, select: apiProductSelect });
  return apiOk(serializeProduct(full, env.appUrl));
}
