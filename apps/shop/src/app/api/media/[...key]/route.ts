import { NextResponse } from "next/server";
import { getStorage } from "@/lib/storage";

export const runtime = "nodejs";

/** Sert les fichiers de l'espace public (images, aperçus) quand aucun CDN n'est configuré. */
export async function GET(_req: Request, ctx: { params: Promise<{ key: string[] }> }) {
  const { key } = await ctx.params;
  const joined = key.join("/");
  if (joined.includes("..") || joined.startsWith("private/")) return new NextResponse("Not found", { status: 404 });
  const file = await getStorage().get(`public/${joined}`);
  if (!file) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(new Uint8Array(file.body), {
    headers: { "content-type": file.contentType, "cache-control": "public, max-age=31536000, immutable" },
  });
}
