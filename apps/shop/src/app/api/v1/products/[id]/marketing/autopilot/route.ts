import { apiError, apiOk, authenticateApiKey } from "@/lib/api/auth";
import { runAutopilot } from "@/lib/social/autopilot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// La génération des textes par Claude peut prendre plusieurs dizaines de secondes
export const maxDuration = 120;

/**
 * POST /api/v1/products/:id/marketing/autopilot — crée la campagne tracée et les
 * publications d'un produit (textes générés par Claude, ou fournis dans `copy`).
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await authenticateApiKey(req, "products:write");
  if (!auth.ok) return apiError(auth.status, auth.error);
  const { id } = await ctx.params;
  let body: unknown;
  try { body = await req.json(); } catch { return apiError(422, "Corps JSON invalide"); }
  try {
    const r = await runAutopilot(id, body, { apiKeyPrefix: auth.key.prefix });
    if (!r.ok) return apiError(r.status, r.error, r.details);
    return apiOk(r.data, 201);
  } catch (e) {
    console.error("[api/autopilot]", e);
    return apiError(500, e instanceof Error ? e.message : "Erreur inattendue");
  }
}
