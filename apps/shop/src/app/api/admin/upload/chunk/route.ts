import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/auth/session";
import { roleCan } from "@/lib/auth/permissions";
import { getStorage } from "@/lib/storage";
import { CHUNK_BYTES, chunkKey, isUploadId, MAX_CHUNKS } from "@/lib/admin/upload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Reçoit un morceau (≤ 3,5 Mo) d'un gros fichier, stocké temporairement dans l'espace privé. */
export async function POST(req: Request) {
  try {
    return await handle(req);
  } catch (e) {
    console.error("[upload]", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erreur serveur" }, { status: 500 });
  }
}

async function handle(req: Request) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "Authentification requise" }, { status: 401 });
  if (!roleCan(user.role, "products:write") && !roleCan(user.role, "appearance:write") && !roleCan(user.role, "blog:write")) {
    return NextResponse.json({ error: "Permission insuffisante" }, { status: 403 });
  }
  const form = await req.formData();
  const uploadId = form.get("uploadId");
  const index = Number(form.get("index"));
  const part = form.get("chunk");
  if (!isUploadId(uploadId) || !Number.isInteger(index) || index < 0 || index >= MAX_CHUNKS || !(part instanceof Blob)) {
    return NextResponse.json({ error: "Morceau invalide" }, { status: 400 });
  }
  if (part.size > CHUNK_BYTES + 1024) return NextResponse.json({ error: "Morceau trop volumineux" }, { status: 413 });
  await getStorage().put(chunkKey(uploadId, index), Buffer.from(await part.arrayBuffer()), "application/octet-stream");
  return NextResponse.json({ ok: true });
}
