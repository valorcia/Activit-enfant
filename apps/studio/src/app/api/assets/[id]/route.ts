import { prisma } from "@/lib/db";
import { getStorage } from "@/lib/storage";
import { NextResponse } from "next/server";
import { verifyPreviewToken } from "@/lib/preview/token";

/** Lien d'aperçu partagé : l'image doit appartenir au livre du jeton (illustration du livre ou de ses activités). */
async function assetAllowedForPreview(assetId: string, token: string): Promise<boolean> {
  const v = await verifyPreviewToken(token);
  if (!v) return false;
  const links = await prisma.bookActivity.findMany({ where: { bookId: v.bookId }, select: { activityId: true } });
  const ill = await prisma.illustration.findFirst({ where: { assetId, OR: [{ bookId: v.bookId }, { activityId: { in: links.map((l) => l.activityId) } }] }, select: { id: true } });
  return !!ill;
}

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pt = new URL(req.url).searchParams.get("pt");
  if (pt !== null && !(await assetAllowedForPreview(id, pt))) return new NextResponse("Lien d'aperçu invalide ou expiré", { status: 403 });
  const asset = await prisma.asset.findUnique({ where: { id } });
  if (!asset) return new NextResponse("Not found", { status: 404 });
  const storage = getStorage();
  const direct = storage.publicUrl(asset.key);
  if (direct) return NextResponse.redirect(direct);
  try {
    const data = await storage.get(asset.key);
    const fileName = asset.key.split("/").pop() ?? "fichier";
    const download = new URL(req.url).searchParams.get("download") === "1";
    const headers: Record<string, string> = {
      "Content-Type": asset.mime,
      "Cache-Control": "private, max-age=3600",
      "Accept-Ranges": "bytes",
      ...(download ? { "Content-Disposition": `attachment; filename="${fileName}"` } : asset.mime === "application/pdf" ? { "Content-Disposition": `inline; filename="${fileName}"` } : {}),
    };
    // Lecture partielle (lecteurs vidéo, Safari) : en-tête Range
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") ?? "");
    if (range && (range[1] || range[2])) {
      const size = data.length;
      let start = range[1] ? Number(range[1]) : size - Number(range[2]);
      let end = range[1] && range[2] ? Number(range[2]) : size - 1;
      start = Math.max(0, start);
      end = Math.min(size - 1, end);
      if (start > end) return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
      return new NextResponse(new Uint8Array(data.subarray(start, end + 1)), {
        status: 206,
        headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) },
      });
    }
    return new NextResponse(new Uint8Array(data), { headers: { ...headers, "Content-Length": String(data.length) } });
  } catch {
    return new NextResponse("Fichier introuvable dans le stockage", { status: 404 });
  }
}
