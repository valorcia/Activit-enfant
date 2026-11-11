import fs from "node:fs/promises";
import path from "node:path";
import { createHmac } from "node:crypto";
import { env } from "@/lib/env";
import type { StorageDriver } from "./index";

const MIME_BY_EXT: Record<string, string> = {
  ".pdf": "application/pdf", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".gif": "image/gif", ".svg": "image/svg+xml", ".mp4": "video/mp4", ".webm": "video/webm", ".mov": "video/quicktime", ".zip": "application/zip",
};

function resolveKey(key: string): string {
  const root = path.resolve(env.storageLocalDir);
  const full = path.resolve(root, key);
  if (!full.startsWith(root + path.sep)) throw new Error("Clé de stockage invalide");
  return full;
}

export function signLocalKey(key: string, expires: number): string {
  return createHmac("sha256", env.downloadTokenSecret).update(`${key}:${expires}`).digest("hex");
}

/** Stockage sur disque (développement). En production, utiliser S3. */
export function localStorageDriver(): StorageDriver {
  return {
    async put(key, body, _contentType) {
      // Sur Vercel le disque est en lecture seule : message explicite plutôt qu'un ENOENT obscur
      if (process.env.VERCEL) throw new Error("Stockage de fichiers non configuré : ajoutez STORAGE_DRIVER=s3 et les variables S3_* (Cloudflare R2) dans Vercel, puis redéployez.");
      const full = resolveKey(key);
      await fs.mkdir(path.dirname(full), { recursive: true });
      await fs.writeFile(full, body);
    },
    async get(key) {
      try {
        const full = resolveKey(key);
        const body = await fs.readFile(full);
        return { body, contentType: MIME_BY_EXT[path.extname(full).toLowerCase()] ?? "application/octet-stream" };
      } catch {
        return null;
      }
    },
    async delete(key) {
      try { await fs.unlink(resolveKey(key)); } catch { /* déjà supprimé */ }
    },
    async exists(key) {
      try { await fs.access(resolveKey(key)); return true; } catch { return false; }
    },
    async signedUrl(key, { expiresInSeconds, fileName }) {
      const expires = Math.floor(Date.now() / 1000) + expiresInSeconds;
      const sig = signLocalKey(key, expires);
      const params = new URLSearchParams({ key, expires: String(expires), sig });
      if (fileName) params.set("name", fileName);
      return `${env.appUrl}/api/storage/local?${params.toString()}`;
    },
    publicUrl(key) {
      return `/api/media/${key.replace(/^public\//, "")}`;
    },
  };
}
