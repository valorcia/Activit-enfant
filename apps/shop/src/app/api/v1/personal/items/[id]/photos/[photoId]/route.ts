import { apiError, authenticateApiKey } from "@/lib/api/auth";
import { getStorage } from "@/lib/storage";
import { getForStudio } from "@/lib/unwritten/orders";
import { photoKey } from "@/lib/unwritten/photos";
import { PHOTO_ID_RE } from "@/lib/unwritten/questionnaire/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/v1/personal/items/:id/photos/:photoId — photo d'un livre (JPEG, 2400 px au plus).
 * Accessible seulement si la photo figure dans les réponses figées de ce livre.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string; photoId: string }> }) {
  const auth = await authenticateApiKey(req, "personal:read");
  if (!auth.ok) return apiError(auth.status, auth.error);
  const { id, photoId } = await ctx.params;
  if (!PHOTO_ID_RE.test(photoId)) return apiError(404, "Photo introuvable");
  const item = await getForStudio(id);
  if (!item || !item.photos.some((p) => p.id === photoId)) return apiError(404, "Photo introuvable");
  const file = await getStorage().get(photoKey(photoId));
  if (!file) return apiError(404, "Photo introuvable");
  return new Response(new Uint8Array(file.body), { headers: { "content-type": "image/jpeg", "cache-control": "private, no-store" } });
}
