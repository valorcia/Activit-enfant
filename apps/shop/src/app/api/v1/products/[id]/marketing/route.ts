import { apiError, apiOk, authenticateApiKey } from "@/lib/api/auth";
import { productMarketing } from "@/lib/social/autopilot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/v1/products/:id/marketing — campagnes du produit, leurs posts et leur rentabilité. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await authenticateApiKey(req, "products:read");
  if (!auth.ok) return apiError(auth.status, auth.error);
  const { id } = await ctx.params;
  const campaigns = await productMarketing(id);
  if (!campaigns) return apiError(404, "Produit introuvable");
  return apiOk({ campaigns });
}
