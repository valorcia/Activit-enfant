"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { MediaRole, FileKind, ProductStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { assertPermission } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { revalidateCatalog } from "@/lib/catalog";
import { getStorage } from "@/lib/storage";
import { createProduct, deleteProduct, duplicateProduct, setProductStatus, updateProduct } from "@/lib/products/service";
import { handleActionError, succeed, fail, type ActionResult } from "@/lib/admin/action-result";
import { mediaRoleSchema, fileKindSchema } from "@/lib/schemas/product";

function revalidateAdmin(id?: string) {
  revalidatePath("/admin/produits");
  if (id) revalidatePath(`/admin/produits/${id}`);
}

export async function createProductAction(raw: unknown): Promise<ActionResult<{ id: string; slug: string }>> {
  try {
    const user = await assertPermission("products:write");
    const p = await createProduct(raw, { userId: user.id, actor: user.email, source: "admin" });
    revalidateAdmin();
    return succeed({ id: p.id, slug: p.slug });
  } catch (e) { return handleActionError(e); }
}

export async function updateProductAction(id: string, raw: unknown): Promise<ActionResult<{ id: string; slug: string; status: ProductStatus }>> {
  try {
    const user = await assertPermission("products:write");
    const p = await updateProduct(id, raw, { userId: user.id, actor: user.email });
    revalidateAdmin(id);
    return succeed({ id: p.id, slug: p.slug, status: p.status });
  } catch (e) { return handleActionError(e); }
}

export async function duplicateProductAction(id: string, name?: string): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await assertPermission("products:write");
    const copy = await duplicateProduct(id, { userId: user.id, actor: user.email }, name ? { name } : {});
    revalidateAdmin();
    return succeed({ id: copy.id });
  } catch (e) { return handleActionError(e); }
}

const statusSchema = z.enum(["DRAFT", "SCHEDULED", "PUBLISHED", "ARCHIVED"]);
export async function setStatusAction(id: string, status: string, scheduledAt?: string | null): Promise<ActionResult<{ status: ProductStatus }>> {
  try {
    const user = await assertPermission("products:publish");
    const s = statusSchema.parse(status);
    const date = scheduledAt ? new Date(scheduledAt) : null;
    if (s === "SCHEDULED" && (!date || Number.isNaN(date.getTime()))) return fail("Date de publication requise");
    const p = await setProductStatus(id, s, { userId: user.id, actor: user.email }, date);
    revalidateAdmin(id);
    return succeed({ status: p.status });
  } catch (e) { return handleActionError(e); }
}

export async function deleteProductAction(id: string): Promise<ActionResult<{ archived: boolean }>> {
  try {
    const user = await assertPermission("products:write");
    const sold = await prisma.orderItem.count({ where: { productId: id } });
    await deleteProduct(id, { userId: user.id, actor: user.email });
    revalidateAdmin(id);
    return succeed({ archived: sold > 0 });
  } catch (e) { return handleActionError(e); }
}

// --- Médias ----------------------------------------------------------------

const imageSchema = z.object({
  url: z.string().min(1).max(600),
  key: z.string().max(400).optional().nullable(),
  alt: z.string().max(200).optional().nullable(),
  role: mediaRoleSchema.default("GALLERY"),
  width: z.number().int().optional().nullable(),
  height: z.number().int().optional().nullable(),
});

export async function addImageAction(productId: string, raw: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await assertPermission("products:write");
    const input = imageSchema.parse(raw);
    const product = await prisma.product.findUniqueOrThrow({ where: { id: productId }, select: { slug: true } });
    const img = await prisma.$transaction(async (tx) => {
      // Une seule image principale / une seule image OG
      if (input.role === "MAIN" || input.role === "OG") {
        await tx.productImage.updateMany({ where: { productId, role: input.role }, data: { role: "GALLERY" } });
      }
      const count = await tx.productImage.count({ where: { productId, role: input.role as MediaRole } });
      return tx.productImage.create({ data: { productId, url: input.url, storageKey: input.key ?? undefined, alt: input.alt ?? undefined, role: input.role as MediaRole, position: count, width: input.width ?? undefined, height: input.height ?? undefined } });
    });
    if (input.role === "OG") await prisma.product.update({ where: { id: productId }, data: { ogImageUrl: input.url } });
    await audit({ userId: user.id, action: "product.image.add", entity: "product", entityId: productId, data: { role: input.role } });
    revalidateCatalog([product.slug]);
    revalidateAdmin(productId);
    return succeed({ id: img.id });
  } catch (e) { return handleActionError(e); }
}

export async function addVideoAction(productId: string, url: string, title?: string): Promise<ActionResult<{ id: string }>> {
  const parsed = z.string().url().safeParse(url.trim());
  if (!parsed.success) return fail("URL de vidéo invalide");
  return addImageAction(productId, { url: parsed.data, role: "VIDEO", alt: title ?? null });
}

export async function updateImageAction(imageId: string, patch: { alt?: string | null; role?: string }): Promise<ActionResult<undefined>> {
  try {
    const user = await assertPermission("products:write");
    const img = await prisma.productImage.findUniqueOrThrow({ where: { id: imageId }, include: { product: { select: { slug: true } } } });
    const role = patch.role ? mediaRoleSchema.parse(patch.role) : undefined;
    await prisma.$transaction(async (tx) => {
      if (role && (role === "MAIN" || role === "OG") && role !== img.role) {
        await tx.productImage.updateMany({ where: { productId: img.productId, role }, data: { role: "GALLERY" } });
      }
      await tx.productImage.update({ where: { id: imageId }, data: { alt: patch.alt === undefined ? undefined : patch.alt, role: role as MediaRole | undefined } });
    });
    void user;
    revalidateCatalog([img.product.slug]);
    revalidateAdmin(img.productId);
    return succeed(undefined);
  } catch (e) { return handleActionError(e); }
}

export async function removeImageAction(imageId: string): Promise<ActionResult<undefined>> {
  try {
    const user = await assertPermission("products:write");
    const img = await prisma.productImage.findUniqueOrThrow({ where: { id: imageId }, include: { product: { select: { slug: true } } } });
    await prisma.productImage.delete({ where: { id: imageId } });
    if (img.storageKey) await getStorage().delete(img.storageKey).catch(() => undefined);
    await audit({ userId: user.id, action: "product.image.remove", entity: "product", entityId: img.productId });
    revalidateCatalog([img.product.slug]);
    revalidateAdmin(img.productId);
    return succeed(undefined);
  } catch (e) { return handleActionError(e); }
}

export async function reorderImagesAction(productId: string, orderedIds: string[]): Promise<ActionResult<undefined>> {
  try {
    await assertPermission("products:write");
    const product = await prisma.product.findUniqueOrThrow({ where: { id: productId }, select: { slug: true } });
    await prisma.$transaction(orderedIds.map((id, position) => prisma.productImage.updateMany({ where: { id, productId }, data: { position } })));
    revalidateCatalog([product.slug]);
    revalidateAdmin(productId);
    return succeed(undefined);
  } catch (e) { return handleActionError(e); }
}

// --- Fichiers numériques (privés) ---------------------------------------------

const fileSchema = z.object({
  key: z.string().min(1).max(400).refine((k) => k.startsWith("private/"), "Clé de stockage privée attendue"),
  name: z.string().min(1).max(160),
  description: z.string().max(300).optional().nullable(),
  kind: fileKindSchema.default("MAIN_PDF"),
  mime: z.string().max(80).default("application/pdf"),
  size: z.number().int().min(0).default(0),
});

export async function addFileAction(productId: string, raw: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await assertPermission("products:write");
    const input = fileSchema.parse(raw);
    const count = await prisma.productFile.count({ where: { productId } });
    const f = await prisma.productFile.create({ data: { productId, storageKey: input.key, name: input.name, description: input.description ?? undefined, kind: input.kind as FileKind, mime: input.mime, sizeBytes: input.size, position: count } });
    await audit({ userId: user.id, action: "product.file.add", entity: "product", entityId: productId, data: { kind: input.kind, name: input.name } });
    const product = await prisma.product.findUniqueOrThrow({ where: { id: productId }, select: { slug: true } });
    revalidateCatalog([product.slug]);
    revalidateAdmin(productId);
    return succeed({ id: f.id });
  } catch (e) { return handleActionError(e); }
}

export async function removeFileAction(fileId: string): Promise<ActionResult<undefined>> {
  try {
    const user = await assertPermission("products:write");
    const f = await prisma.productFile.findUniqueOrThrow({ where: { id: fileId }, include: { product: { select: { slug: true } } } });
    // Si le même fichier est référencé par un produit dupliqué, on ne supprime pas l'objet physique
    const shared = await prisma.productFile.count({ where: { storageKey: f.storageKey, id: { not: fileId } } });
    await prisma.productFile.delete({ where: { id: fileId } });
    if (shared === 0) await getStorage().delete(f.storageKey).catch(() => undefined);
    await audit({ userId: user.id, action: "product.file.remove", entity: "product", entityId: f.productId, data: { name: f.name } });
    revalidateCatalog([f.product.slug]);
    revalidateAdmin(f.productId);
    return succeed(undefined);
  } catch (e) { return handleActionError(e); }
}

export async function updateFileAction(fileId: string, patch: { name?: string; description?: string | null; kind?: string }): Promise<ActionResult<undefined>> {
  try {
    await assertPermission("products:write");
    const kind = patch.kind ? fileKindSchema.parse(patch.kind) : undefined;
    const f = await prisma.productFile.update({ where: { id: fileId }, data: { name: patch.name, description: patch.description === undefined ? undefined : patch.description, kind: kind as FileKind | undefined }, include: { product: { select: { slug: true } } } });
    revalidateCatalog([f.product.slug]);
    revalidateAdmin(f.productId);
    return succeed(undefined);
  } catch (e) { return handleActionError(e); }
}
