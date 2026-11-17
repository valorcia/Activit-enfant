import { NextResponse } from "next/server";
import { isCronAuthorized } from "@/app/api/cron/publish/route";
import { purgeUnwrittenData } from "@/lib/unwritten/drafts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Purge RGPD quotidienne UNWRITTEN : brouillons expirés supprimés, réponses des livres livrés ou
 * annulés effacées après la durée de conservation de la marque. À déclarer dans vercel.json
 * (non ajouté automatiquement : voir docs/unwritten/STORE_UNWRITTEN.md, offre Vercel à confirmer).
 */
export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const result = await purgeUnwrittenData();
  return NextResponse.json({ ok: true, ...result });
}
