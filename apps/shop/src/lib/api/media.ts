import { nanoid } from "nanoid";
import type { FileKind, MediaRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getStorage, privateKey, publicKey, safeFileName } from "@/lib/storage";
import { revalidateCatalog } from "@/lib/catalog";

const IMAGE_EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif", "image/svg+xml": "svg", "image/avif": "avif" };
const MAX_IMAGE = 20 * 1024 * 1024;
const MAX_FILE = 100 * 1024 * 1024;

async function nextPosition(productId: string, table: "image" | "file") {
  const agg = table === "image"
    ? await prisma.productImage.aggregate({ where: { productId }, _max: { position: true } })
    : await prisma.productFile.aggregate({ where: { productId }, _max: { position: true } });
  return (agg._max.position ?? -1) + 1;
}

/** Enregistre une image (buffer) dans l'espace public et l'attache au produit. */
export async function attachImageBuffer(productId: string, buf: Buffer, mime: string, opts: { role?: MediaRole; alt?: string | null; position?: number } = {}) {
  if (!mime.startsWith("image/")) throw new Error("Type de fichier non supporté (image attendue)");
  if (buf.length > MAX_IMAGE) throw new Error("Image trop volumineuse (20 Mo max)");
  const ext = IMAGE_EXT[mime] ?? "jpg";
  const key = publicKey(`products/${productId}`, `${nanoid(10)}.${ext}`);
  const storage = getStorage();
  await storage.put(key, buf, mime);
  const role = opts.role ?? "GALLERY";
  if (role === "MAIN") await prisma.productImage.updateMany({ where: { productId, role: "MAIN" }, data: { role: "GALLERY" } });
  const image = await prisma.productImage.create({
    data: { productId, url: storage.publicUrl(key), storageKey: key, role, alt: opts.alt ?? null, position: opts.position ?? (await nextPosition(productId, "image")) },
  });
  const p = await prisma.product.findUnique({ where: { id: productId }, select: { slug: true } });
  if (p) revalidateCatalog([p.slug]);
  return image;
}

/** Télécharge une image distante puis l'attache. */
export async function attachImageFromUrl(productId: string, url: string, opts: { role?: MediaRole; alt?: string | null } = {}) {
  if (opts.role === "VIDEO") {
    const image = await prisma.productImage.create({ data: { productId, url, role: "VIDEO", alt: opts.alt ?? null, position: await nextPosition(productId, "image") } });
    return image;
  }
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`Téléchargement impossible (${res.status})`);
  const mime = res.headers.get("content-type")?.split(";")[0] ?? "image/jpeg";
  const buf = Buffer.from(await res.arrayBuffer());
  return attachImageBuffer(productId, buf, mime, opts);
}

/** Enregistre un fichier payant dans l'espace PRIVÉ et l'attache au produit. Aucune URL publique n'est jamais créée. */
export async function attachPrivateFile(productId: string, buf: Buffer, mime: string, opts: { name: string; kind?: FileKind; description?: string | null }) {
  if (buf.length > MAX_FILE) throw new Error("Fichier trop volumineux (100 Mo max)");
  const allowed = ["application/pdf", "application/zip", "application/x-zip-compressed", "application/octet-stream"];
  if (!allowed.includes(mime)) throw new Error("Type de fichier non supporté (PDF ou ZIP attendu)");
  const safe = safeFileName(opts.name);
  const key = privateKey(`products/${productId}`, `${nanoid(10)}-${safe}`);
  await getStorage().put(key, buf, mime);
  return prisma.productFile.create({
    data: { productId, name: opts.name.slice(0, 160), kind: opts.kind ?? "MAIN_PDF", storageKey: key, mime, sizeBytes: buf.length, description: opts.description ?? null, position: await nextPosition(productId, "file") },
  });
}

/** Supprime les images d'un produit ayant un rôle donné (stockage + base). Utilisé par le mode `replace` de l'API. */
export async function removeImagesByRole(productId: string, role: MediaRole) {
  const rows = await prisma.productImage.findMany({ where: { productId, role } });
  const storage = getStorage();
  for (const r of rows) {
    if (r.storageKey) await storage.delete(r.storageKey).catch(() => undefined);
  }
  await prisma.productImage.deleteMany({ where: { productId, role } });
  return rows.length;
}

/** Supprime les fichiers payants d'un produit d'un type donné (stockage privé + base). */
export async function removeFilesByKind(productId: string, kind: FileKind) {
  const rows = await prisma.productFile.findMany({ where: { productId, kind } });
  const storage = getStorage();
  for (const r of rows) await storage.delete(r.storageKey).catch(() => undefined);
  await prisma.productFile.deleteMany({ where: { productId, kind } });
  return rows.length;
}
