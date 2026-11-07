import "server-only";
import { env } from "@/lib/env";
import { localStorageDriver } from "./local";
import { s3StorageDriver } from "./s3";

/**
 * Stockage objet. Deux espaces :
 *  - public/  : images, mockups, aperçus (servis via URL publique ou /api/media)
 *  - private/ : fichiers payants (jamais d'URL publique, uniquement via /api/download)
 */
export interface StorageDriver {
  put(key: string, body: Buffer | Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<{ body: Buffer; contentType: string } | null>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  /** URL signée temporaire pour un fichier privé (téléchargement direct). */
  signedUrl(key: string, opts: { expiresInSeconds: number; fileName?: string }): Promise<string>;
  /** URL publique (CDN) pour un fichier de l'espace public. */
  publicUrl(key: string): string;
}

export function getStorage(): StorageDriver {
  return env.storageDriver === "s3" ? s3StorageDriver() : localStorageDriver();
}

export function publicKey(folder: string, fileName: string): string {
  return `public/${folder}/${fileName}`;
}
export function privateKey(folder: string, fileName: string): string {
  return `private/${folder}/${fileName}`;
}

export function safeFileName(name: string): string {
  const base = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
  return base || "fichier";
}
