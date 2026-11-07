import { NextResponse } from "next/server";
import { authorizeDownload } from "@/lib/orders/access";
import { getStorage, safeFileName } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Téléchargement d'un fichier acheté : vérifie le droit d'accès, journalise,
 * puis redirige vers une URL signée de courte durée (5 min).
 */
export async function GET(req: Request, ctx: { params: Promise<{ token: string; fileId: string }> }) {
  const { token, fileId } = await ctx.params;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const check = await authorizeDownload(token, fileId, { ip, userAgent: req.headers.get("user-agent") });
  if (!check.ok) {
    return new NextResponse(check.reason, { status: check.status, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
  const url = await getStorage().signedUrl(check.storageKey, { expiresInSeconds: 300, fileName: safeFileName(check.fileName) });
  return NextResponse.redirect(url, { status: 302, headers: { "cache-control": "no-store" } });
}
