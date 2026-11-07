import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { getAdminUser } from "@/lib/auth/session";
import { roleCan } from "@/lib/auth/permissions";
import { getStorage, privateKey, publicKey, safeFileName } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 50 * 1024 * 1024;
const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/svg+xml": "svg", "image/avif": "avif",
  "application/pdf": "pdf", "application/zip": "zip", "application/x-zip-compressed": "zip", "video/mp4": "mp4",
};

/** Lit les dimensions d'un PNG/JPEG/WebP/GIF sans dépendance (entêtes). */
function imageSize(buf: Buffer, mime: string): { width: number; height: number } | undefined {
  try {
    if (mime === "image/png" && buf.length > 24) return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
    if (mime === "image/gif" && buf.length > 10) return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
    if (mime === "image/jpeg") {
      let i = 2;
      while (i < buf.length) {
        if (buf[i] !== 0xff) { i++; continue; }
        const marker = buf[i + 1];
        if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
        const len = buf.readUInt16BE(i + 2);
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
          return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
        }
        i += 2 + len;
      }
    }
    if (mime === "image/webp" && buf.length > 30 && buf.toString("ascii", 12, 16) === "VP8 ") {
      return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
    }
  } catch { /* ignoré */ }
  return undefined;
}

export async function POST(req: Request) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "Authentification requise" }, { status: 401 });
  if (!roleCan(user.role, "products:write") && !roleCan(user.role, "appearance:write") && !roleCan(user.role, "blog:write")) {
    return NextResponse.json({ error: "Permission insuffisante" }, { status: 403 });
  }
  const form = await req.formData();
  const file = form.get("file");
  const scope = form.get("scope") === "private" ? "private" : "public";
  const productId = String(form.get("productId") ?? "divers").replace(/[^a-zA-Z0-9_-]/g, "") || "divers";
  if (!(file instanceof File)) return NextResponse.json({ error: "Fichier manquant" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Fichier trop volumineux (50 Mo max)" }, { status: 413 });
  const mime = file.type || "application/octet-stream";
  const ext = ALLOWED[mime] ?? (file.name.split(".").pop()?.toLowerCase() === "pdf" ? "pdf" : null);
  if (!ext) return NextResponse.json({ error: `Type de fichier non autorisé (${mime})` }, { status: 415 });
  if (scope === "public" && !mime.startsWith("image/") && mime !== "video/mp4") {
    return NextResponse.json({ error: "Seules les images et vidéos peuvent être publiques" }, { status: 415 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const base = safeFileName(file.name.replace(/\.[^.]+$/, "")).slice(0, 60);
  const name = `${nanoid(10)}-${base}.${ext}`;
  const key = scope === "public" ? publicKey(`products/${productId}`, name) : privateKey(`products/${productId}`, name);
  const storage = getStorage();
  await storage.put(key, buf, mime);

  if (scope === "public") {
    const dims = imageSize(buf, mime);
    return NextResponse.json({ url: storage.publicUrl(key), key, ...dims });
  }
  return NextResponse.json({ key, size: buf.length, mime });
}
