import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/auth/session";
import { roleCan } from "@/lib/auth/permissions";
import { getStorage } from "@/lib/storage";
import { checkUpload, chunkKey, cleanProductId, isUploadId, MAX_CHUNKS, storeUpload } from "@/lib/admin/upload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function authorize() {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "Authentification requise" }, { status: 401 });
  if (!roleCan(user.role, "products:write") && !roleCan(user.role, "appearance:write") && !roleCan(user.role, "blog:write")) {
    return NextResponse.json({ error: "Permission insuffisante" }, { status: 403 });
  }
  return null;
}

/**
 * Deux modes :
 *  - multipart/form-data « file » : petit fichier envoyé d'un coup ;
 *  - JSON { uploadId, parts, name, mime, scope, productId } : assemble les morceaux
 *    déjà déposés par /api/admin/upload/chunk (fichiers de plus de 4 Mo, au-delà
 *    de la limite de taille des requêtes Vercel).
 */
export async function POST(req: Request) {
  const denied = await authorize();
  if (denied) return denied;

  if ((req.headers.get("content-type") ?? "").includes("application/json")) {
    const b = (await req.json().catch(() => null)) as { uploadId?: unknown; parts?: unknown; name?: unknown; mime?: unknown; scope?: unknown; productId?: unknown } | null;
    if (!b || !isUploadId(b.uploadId) || typeof b.parts !== "number" || !Number.isInteger(b.parts) || b.parts < 1 || b.parts > MAX_CHUNKS) {
      return NextResponse.json({ error: "Envoi incomplet" }, { status: 400 });
    }
    const name = String(b.name ?? "fichier").slice(0, 200);
    const mime = String(b.mime || "application/octet-stream");
    const scope = b.scope === "private" ? "private" : "public";
    const storage = getStorage();
    const keys = Array.from({ length: b.parts }, (_, i) => chunkKey(b.uploadId as string, i));
    try {
      const chunks: Buffer[] = [];
      for (const k of keys) {
        const part = await storage.get(k);
        if (!part) return NextResponse.json({ error: "Un morceau du fichier est manquant : recommencez l'envoi" }, { status: 400 });
        chunks.push(part.body);
      }
      const buf = Buffer.concat(chunks);
      const check = checkUpload(name, mime, scope, buf.length);
      if ("error" in check) return NextResponse.json({ error: check.error }, { status: check.status });
      return NextResponse.json(await storeUpload(buf, { name, mime, ext: check.ext, scope, productId: cleanProductId(b.productId) }));
    } finally {
      await Promise.all(keys.map((k) => storage.delete(k).catch(() => undefined)));
    }
  }

  const form = await req.formData();
  const file = form.get("file");
  const scope = form.get("scope") === "private" ? "private" : "public";
  if (!(file instanceof File)) return NextResponse.json({ error: "Fichier manquant" }, { status: 400 });
  const mime = file.type || "application/octet-stream";
  const check = checkUpload(file.name, mime, scope, file.size);
  if ("error" in check) return NextResponse.json({ error: check.error }, { status: check.status });
  const buf = Buffer.from(await file.arrayBuffer());
  return NextResponse.json(await storeUpload(buf, { name: file.name, mime, ext: check.ext, scope, productId: cleanProductId(form.get("productId")) }));
}
