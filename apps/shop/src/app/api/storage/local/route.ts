import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { getStorage } from "@/lib/storage";
import { signLocalKey } from "@/lib/storage/local";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Sert un fichier privé du stockage local via une URL signée (développement). */
export async function GET(req: Request) {
  if (env.storageDriver !== "local") return new NextResponse("Not found", { status: 404 });
  const url = new URL(req.url);
  const key = url.searchParams.get("key") ?? "";
  const expires = Number(url.searchParams.get("expires"));
  const sig = url.searchParams.get("sig") ?? "";
  const name = url.searchParams.get("name");
  if (!key || !Number.isFinite(expires) || expires < Date.now() / 1000) return new NextResponse("Lien expiré", { status: 410 });
  const expected = signLocalKey(key, expires);
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return new NextResponse("Signature invalide", { status: 403 });
  }
  const file = await getStorage().get(key);
  if (!file) return new NextResponse("Fichier introuvable", { status: 404 });
  return new NextResponse(new Uint8Array(file.body), {
    headers: {
      "content-type": file.contentType,
      "content-disposition": `attachment; filename="${name ?? key.split("/").pop()}"`,
      "cache-control": "private, no-store",
    },
  });
}
