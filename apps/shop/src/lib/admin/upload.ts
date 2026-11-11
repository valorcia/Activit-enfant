import "server-only";
import { nanoid } from "nanoid";
import { getStorage, privateKey, publicKey, safeFileName } from "@/lib/storage";

export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
/** Taille d'un morceau : sous la limite de 4,5 Mo des requêtes Vercel. */
export const CHUNK_BYTES = 3.5 * 1024 * 1024;
export const MAX_CHUNKS = Math.ceil(MAX_UPLOAD_BYTES / CHUNK_BYTES);
export const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/svg+xml": "svg", "image/avif": "avif",
  "application/pdf": "pdf", "application/zip": "zip", "application/x-zip-compressed": "zip", "video/mp4": "mp4",
};

/** Lit les dimensions d'un PNG/JPEG/WebP/GIF sans dépendance (entêtes). */
export function imageSize(buf: Buffer, mime: string): { width: number; height: number } | undefined {
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

export type UploadScope = "public" | "private";

/** Vérifie le type demandé ; renvoie l'extension ou un message d'erreur. */
export function checkUpload(name: string, mime: string, scope: UploadScope, size: number): { ext: string } | { error: string; status: number } {
  if (size > MAX_UPLOAD_BYTES) return { error: "Fichier trop volumineux (100 Mo max)", status: 413 };
  const ext = ALLOWED[mime] ?? (name.split(".").pop()?.toLowerCase() === "pdf" ? "pdf" : null);
  if (!ext) return { error: `Type de fichier non autorisé (${mime})`, status: 415 };
  if (scope === "public" && !mime.startsWith("image/") && mime !== "video/mp4") return { error: "Seules les images et vidéos peuvent être publiques", status: 415 };
  return { ext };
}

/** Enregistre le fichier final et renvoie la réponse attendue par le champ de dépôt. */
export async function storeUpload(buf: Buffer, opts: { name: string; mime: string; ext: string; scope: UploadScope; productId: string }) {
  const base = safeFileName(opts.name.replace(/\.[^.]+$/, "")).slice(0, 60);
  const fileName = `${nanoid(10)}-${base}.${opts.ext}`;
  const key = opts.scope === "public" ? publicKey(`products/${opts.productId}`, fileName) : privateKey(`products/${opts.productId}`, fileName);
  const storage = getStorage();
  await storage.put(key, buf, opts.mime);
  if (opts.scope === "public") return { url: storage.publicUrl(key), key, ...imageSize(buf, opts.mime) };
  return { key, size: buf.length, mime: opts.mime };
}

export function cleanProductId(v: unknown): string {
  return String(v ?? "divers").replace(/[^a-zA-Z0-9_-]/g, "") || "divers";
}

const UPLOAD_ID = /^[a-zA-Z0-9_-]{12,40}$/;
export function isUploadId(v: unknown): v is string { return typeof v === "string" && UPLOAD_ID.test(v); }
export function chunkKey(uploadId: string, index: number): string { return privateKey(`tmp-uploads/${uploadId}`, String(index).padStart(4, "0")); }
