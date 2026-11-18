import "server-only";
import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { getStorage, privateKey } from "@/lib/storage";
import { DEFAULT_MAX_PHOTOS, PHOTO_ID_RE, photoEntries, photoIdsIn, type Answers } from "./questionnaire/engine";
import type { Question } from "./questionnaire/schema";

/**
 * Photos des livres personnalisés.
 *
 *  - Toujours privées : `private/unwritten/photos/<id>.jpg` (+ vignette `<id>_t.jpg`), jamais d'URL
 *    publique. Le navigateur ne les voit que par /api/u/photos/<id>, si la photo figure dans les
 *    réponses de SON brouillon (cookie signé) ou de SON lien cadeau.
 *  - Ré-encodées en JPEG : orientation appliquée, métadonnées supprimées (dont la position GPS),
 *    2400 px au plus sur le grand côté (environ 400 dpi sur une page A5, assez pour l'impression).
 *  - Supprimées avec le brouillon, ou avec les données de la commande à l'issue de la durée de
 *    conservation (purgeUnwrittenData). Jamais utilisées pour autre chose que le livre.
 */

export const PHOTO_MAX_BYTES = 4 * 1024 * 1024; // corps de requête Vercel ≤ 4,5 Mo : le navigateur réduit avant l'envoi
export const PHOTO_MAX_SIDE = 2400;
export const PHOTO_THUMB_SIDE = 480;
/** En dessous, la photo reste acceptée mais risque d'être floue en pleine page imprimée. */
export const PHOTO_LOW_RES_SIDE = 1200;

const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

export function newPhotoId(): string {
  const bytes = randomBytes(24);
  let out = "ph_";
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}

export function photoKey(id: string, variant: "full" | "thumb" = "full"): string {
  if (!PHOTO_ID_RE.test(id)) throw new Error("Identifiant de photo invalide");
  return privateKey("unwritten/photos", variant === "thumb" ? `${id}_t.jpg` : `${id}.jpg`);
}

export class PhotoError extends Error {
  constructor(public code: "not_image" | "too_large" | "too_many" | "unavailable") {
    super(code);
  }
}

export interface StoredPhoto { id: string; width: number; height: number; lowRes: boolean }

/** Valide, normalise et enregistre une photo. Lève PhotoError si ce n'est pas une image lisible. */
export async function storePhoto(input: Buffer): Promise<StoredPhoto> {
  if (input.length > PHOTO_MAX_BYTES) throw new PhotoError("too_large");
  let meta;
  try {
    meta = await sharp(input, { limitInputPixels: 80_000_000 }).metadata();
  } catch {
    throw new PhotoError("not_image");
  }
  if (!meta.format || !["jpeg", "png", "webp", "heif", "avif", "gif", "tiff"].includes(meta.format)) throw new PhotoError("not_image");
  const base = sharp(input, { limitInputPixels: 80_000_000 }).rotate();
  const full = await base.clone().resize({ width: PHOTO_MAX_SIDE, height: PHOTO_MAX_SIDE, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 86, mozjpeg: true }).toBuffer({ resolveWithObject: true });
  const thumb = await base.clone().resize({ width: PHOTO_THUMB_SIDE, height: PHOTO_THUMB_SIDE, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 78, mozjpeg: true }).toBuffer();
  const id = newPhotoId();
  const storage = getStorage();
  await storage.put(photoKey(id), full.data, "image/jpeg");
  await storage.put(photoKey(id, "thumb"), thumb, "image/jpeg");
  const { width, height } = full.info;
  return { id, width, height, lowRes: Math.max(width, height) < PHOTO_LOW_RES_SIDE };
}

/** Supprime des photos (fichier et vignette). Les erreurs sont journalisées sans bloquer. */
export async function deletePhotos(ids: Iterable<string>): Promise<number> {
  const storage = getStorage();
  let n = 0;
  for (const id of ids) {
    if (!PHOTO_ID_RE.test(id)) continue;
    for (const variant of ["full", "thumb"] as const) {
      try {
        await storage.delete(photoKey(id, variant));
      } catch (e) {
        console.error("[unwritten] suppression photo", id, e instanceof Error ? e.message : e);
      }
    }
    n += 1;
  }
  return n;
}

/** Photos retirées entre deux versions des réponses (à supprimer du stockage). */
export function removedPhotoIds(before: Answers, after: Answers): string[] {
  const kept = new Set(photoIdsIn(after));
  return photoIdsIn(before).filter((id) => !kept.has(id));
}

export function photoCapacity(q: Pick<Question, "maxFiles">): number {
  return q.maxFiles ?? DEFAULT_MAX_PHOTOS;
}

export function photoCount(answers: Answers, questionId: string): number {
  return photoEntries(answers[questionId]).length;
}
