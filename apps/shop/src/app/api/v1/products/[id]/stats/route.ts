import { prisma } from "@/lib/db";
import { apiError, apiOk, authenticateApiKey } from "@/lib/api/auth";
import { productSalesStats } from "@/lib/api/stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/v1/products/:id/stats — ventes du produit (total et 30 derniers jours). */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await authenticateApiKey(req, "products:read");
  if (!auth.ok) return apiError(auth.status, auth.error);
  const { id } = await ctx.params;
  const p = await prisma.product.findFirst({ where: { OR: [{ id }, { slug: id }] }, select: { id: true } });
  if (!p) return apiError(404, "Produit introuvable");
  return apiOk(await productSalesStats(p.id));
}
