import { nanoid } from "nanoid";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { revalidateCatalog } from "@/lib/catalog";
import { getStorage, publicKey } from "@/lib/storage";

/** Vidéos publicitaires d'un produit (ProductImage role VIDEO). */
export const VIDEO_FORMATS = {
  story: { width: 1080, height: 1920, label: "9:16" },
  square: { width: 1080, height: 1080, label: "1:1" },
  landscape: { width: 1920, height: 1080, label: "16:9" },
} as const;
export type VideoFormat = keyof typeof VIDEO_FORMATS;

export const VIDEO_MIME_EXT: Record<string, string> = { "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov" };
export const MAX_VIDEO_BYTES = 200 * 1024 * 1024;

export function videoKey(productId: string, mime: string): string {
  return publicKey(`videos/${productId}`, `${nanoid(10)}.${VIDEO_MIME_EXT[mime] ?? "mp4"}`);
}

/** Le texte alternatif porte le format et le titre : « [story] Titre ». */
export function videoAlt(format: VideoFormat, title?: string | null) {
  return `[${format}] ${title?.trim() || "Vidéo publicitaire"}`.slice(0, 200);
}

export function parseVideoAlt(alt: string | null | undefined): { format: VideoFormat | null; title: string } {
  const m = /^\[(story|square|landscape)\]\s*(.*)$/.exec(alt ?? "");
  return m ? { format: m[1] as VideoFormat, title: m[2] } : { format: null, title: alt ?? "Vidéo" };
}

export async function registerProductVideo(productId: string, key: string, format: VideoFormat, title?: string | null) {
  const storage = getStorage();
  const agg = await prisma.productImage.aggregate({ where: { productId }, _max: { position: true } });
  const dims = VIDEO_FORMATS[format];
  const video = await prisma.productImage.create({
    data: { productId, url: storage.publicUrl(key), storageKey: key, role: "VIDEO", alt: videoAlt(format, title), width: dims.width, height: dims.height, position: (agg._max.position ?? -1) + 1 },
  });
  const p = await prisma.product.findUnique({ where: { id: productId }, select: { slug: true } });
  if (p) revalidateCatalog([p.slug]);
  return video;
}

export async function storeProductVideo(productId: string, buf: Buffer, mime: string, format: VideoFormat, title?: string | null) {
  if (!VIDEO_MIME_EXT[mime]) throw new Error("Format vidéo non supporté (MP4, WebM ou MOV)");
  if (buf.length > MAX_VIDEO_BYTES) throw new Error("Vidéo trop volumineuse (200 Mo max)");
  const key = videoKey(productId, mime);
  await getStorage().put(key, buf, mime);
  return registerProductVideo(productId, key, format, title);
}

/**
 * Téléversement direct vers le stockage S3 (URL signée), indispensable sur Vercel
 * où le corps d'une requête est limité à 4,5 Mo. Renvoie null avec le stockage local.
 */
export async function presignVideoUpload(productId: string, mime: string): Promise<{ key: string; uploadUrl: string; expiresIn: number } | null> {
  if (env.storageDriver !== "s3") return null;
  if (!VIDEO_MIME_EXT[mime]) throw new Error("Format vidéo non supporté (MP4, WebM ou MOV)");
  const client = new S3Client({
    region: env.s3.region,
    endpoint: env.s3.endpoint,
    forcePathStyle: !!env.s3.endpoint,
    credentials: { accessKeyId: env.s3.accessKeyId, secretAccessKey: env.s3.secretAccessKey },
  });
  const key = videoKey(productId, mime);
  const expiresIn = 900;
  const uploadUrl = await getSignedUrl(client, new PutObjectCommand({ Bucket: env.s3.bucket, Key: key, ContentType: mime }), { expiresIn });
  return { key, uploadUrl, expiresIn };
}
