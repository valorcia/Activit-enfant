import { apiError, apiOk, authenticateApiKey } from "@/lib/api/auth";
import { getForStudio } from "@/lib/unwritten/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/v1/personal/items/:id — détail d'un livre (réponses figées, définition du questionnaire). */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await authenticateApiKey(req, "personal:read");
  if (!auth.ok) return apiError(auth.status, auth.error);
  const item = await getForStudio((await ctx.params).id);
  return item ? apiOk(item) : apiError(404, "Livre introuvable");
}
