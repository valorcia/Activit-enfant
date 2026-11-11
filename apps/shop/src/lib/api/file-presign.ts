import { nanoid } from "nanoid";
import { HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { FileKind } from "@prisma/client";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { privateKey, safeFileName } from "@/lib/storage";

/**
 * Gros PDF (cahier de coloriage de 120 pages, recueils…) : téléversement direct vers le
 * stockage PRIVÉ S3 par URL signée, car le corps d'une requête est limité à 4,5 Mo sur
 * Vercel. Le fichier est ensuite enregistré sur le produit (aucune URL publique).
 */
export const MAX_PRESIGNED_FILE = 500 * 1024 * 1024;
const FILE_MIMES = ["application/pdf", "application/zip"];

function s3() {
  return new S3Client({ region: env.s3.region, endpoint: env.s3.endpoint, forcePathStyle: !!env.s3.endpoint, credentials: { accessKeyId: env.s3.accessKeyId, secretAccessKey: env.s3.secretAccessKey } });
}

export function filePrefix(productId: string) {
  return privateKey(`products/${productId}`, "");
}

export async function presignPrivateFile(productId: string, name: string, mime: string): Promise<{ key: string; uploadUrl: string; expiresIn: number } | null> {
  if (env.storageDriver !== "s3") return null;
  if (!FILE_MIMES.includes(mime)) throw new Error("Type de fichier non supporté (PDF ou ZIP attendu)");
  const key = privateKey(`products/${productId}`, `${nanoid(10)}-${safeFileName(name)}`);
  const expiresIn = 900;
  const uploadUrl = await getSignedUrl(s3(), new PutObjectCommand({ Bucket: env.s3.bucket, Key: key, ContentType: mime }), { expiresIn });
  return { key, uploadUrl, expiresIn };
}

/** Enregistre sur le produit un fichier déjà déposé par URL signée (clé vérifiée, taille lue dans S3). */
export async function registerPrivateFile(productId: string, key: string, opts: { name: string; mime: string; kind?: FileKind; description?: string | null }) {
  if (env.storageDriver !== "s3") throw new Error("Téléversement direct indisponible (stockage local)");
  if (!key.startsWith(filePrefix(productId)) || key.includes("..")) throw new Error("Clé de fichier invalide pour ce produit");
  if (!FILE_MIMES.includes(opts.mime)) throw new Error("Type de fichier non supporté (PDF ou ZIP attendu)");
  const head = await s3().send(new HeadObjectCommand({ Bucket: env.s3.bucket, Key: key }));
  const size = Number(head.ContentLength ?? 0);
  if (!size) throw new Error("Fichier introuvable dans le stockage (téléversement non terminé ?)");
  if (size > MAX_PRESIGNED_FILE) throw new Error("Fichier trop volumineux (500 Mo max)");
  const agg = await prisma.productFile.aggregate({ where: { productId }, _max: { position: true } });
  return prisma.productFile.create({
    data: { productId, name: opts.name.slice(0, 160), kind: opts.kind ?? "MAIN_PDF", storageKey: key, mime: opts.mime, sizeBytes: size, description: opts.description ?? null, position: (agg._max.position ?? -1) + 1 },
  });
}
