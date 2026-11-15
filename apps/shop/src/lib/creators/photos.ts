import "server-only";
import { nanoid } from "nanoid";
import { getStorage } from "@/lib/storage";
import { creatorPhotoFolder, parsePhotos } from "./submissions";

/**
 * Photos envoyées par les créatrices. Ré-encodées en JPEG (2 400 px max) avec sharp, ce qui
 * supprime les métadonnées EXIF (position GPS, appareil…). Photos des idées : stockage privé,
 * servies uniquement à la créatrice, à l'équipe et (URL signée temporaire) au studio.
 */
export const CREATOR_UPLOAD_MAX_BYTES = 4 * 1024 * 1024; // sous la limite de 4,5 Mo des requêtes Vercel
export const CREATOR_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

export async function processCreatorImage(input: Buffer, maxSide: number): Promise<{ data: Buffer; width: number; height: number }> {
  const sharp = (await import("sharp")).default;
  const { data, info } = await sharp(input, { failOn: "error" })
    .rotate() // applique l'orientation EXIF avant de la supprimer
    .resize({ width: maxSide, height: maxSide, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 84, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

export async function storeCreatorImage(creatorId: string, input: Buffer, purpose: "photo" | "avatar") {
  const img = await processCreatorImage(input, purpose === "avatar" ? 600 : 2400);
  const storage = getStorage();
  if (purpose === "avatar") {
    const key = `public/creators/${creatorId}/avatar-${nanoid(10)}.jpg`;
    await storage.put(key, img.data, "image/jpeg");
    return { key, url: storage.publicUrl(key), width: img.width, height: img.height, size: img.data.length };
  }
  const key = `${creatorPhotoFolder(creatorId)}${nanoid(14)}.jpg`;
  await storage.put(key, img.data, "image/jpeg");
  return { key, width: img.width, height: img.height, size: img.data.length };
}

/** Sert la n-ième photo d'une proposition (contrôle d'accès fait par l'appelant). */
export async function photoResponse(sub: { photos: unknown }, index: number): Promise<Response> {
  const photo = parsePhotos(sub.photos)[index];
  if (!photo) return new Response("Photo introuvable", { status: 404 });
  const file = await getStorage().get(photo.key);
  if (!file) return new Response("Photo introuvable", { status: 404 });
  return new Response(new Uint8Array(file.body), { headers: { "content-type": "image/jpeg", "cache-control": "private, max-age=600", "x-content-type-options": "nosniff" } });
}

/** URLs signées temporaires des photos (API du studio). */
export async function signedPhotoUrls(photos: unknown, expiresInSeconds = 3600) {
  const storage = getStorage();
  return Promise.all(parsePhotos(photos).map(async (p, i) => ({ url: await storage.signedUrl(p.key, { expiresInSeconds, fileName: `photo-${i + 1}.jpg` }), width: p.width ?? null, height: p.height ?? null })));
}
