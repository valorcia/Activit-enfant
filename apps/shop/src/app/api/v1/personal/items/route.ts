import type { PersonalItemStatus } from "@prisma/client";
import { apiError, apiOk, authenticateApiKey } from "@/lib/api/auth";
import { listForStudio, STUDIO_VISIBLE } from "@/lib/unwritten/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/v1/personal/items?status=PENDING_GENERATION,ERROR&limit=20&after=<id>
 * Livres personnalisés à produire (premier payé, premier servi). Par défaut : PENDING_GENERATION.
 * Les cadeaux dont le destinataire n'a pas encore répondu (AWAITING_RECIPIENT) ne sont jamais listés.
 */
export async function GET(req: Request) {
  const auth = await authenticateApiKey(req, "personal:read");
  if (!auth.ok) return apiError(auth.status, auth.error);
  const url = new URL(req.url);
  const status = (url.searchParams.get("status") ?? "").split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
  const invalid = status.filter((s) => !STUDIO_VISIBLE.includes(s as PersonalItemStatus));
  if (invalid.length) return apiError(400, `Statut non disponible : ${invalid.join(", ")} (autorisés : ${STUDIO_VISIBLE.join(", ")})`);
  const { items, nextCursor } = await listForStudio({ status: status as PersonalItemStatus[], limit: Number(url.searchParams.get("limit")) || 20, after: url.searchParams.get("after") });
  return apiOk(items, 200, { nextCursor });
}
