"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { assertPermission } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { revalidateCatalog } from "@/lib/catalog";
import { handleActionError, succeed, fail, type ActionResult } from "@/lib/admin/action-result";
import { slugify } from "@/lib/utils";
import { categorySchema, collectionSchema } from "@/lib/schemas/catalog";
import { adminDefaultSiteId } from "@/lib/sites";


async function uniqueSlug(table: "category" | "collection", base: string, siteId: string, excludeId?: string) {
  const root = slugify(base) || table;
  let slug = root;
  for (let i = 2; i < 200; i++) {
    const existing = table === "category"
      ? await prisma.category.findFirst({ where: { siteId, slug }, select: { id: true } })
      : await prisma.collection.findFirst({ where: { siteId, slug }, select: { id: true } });
    if (!existing || existing.id === excludeId) return slug;
    slug = `${root}-${i}`;
  }
  return `${root}-${Date.now()}`;
}

function revalidate() {
  revalidateCatalog();
  revalidatePath("/admin/categories");
  revalidatePath("/admin/collections");
}

export async function saveCategoryAction(id: string | null, raw: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await assertPermission("catalog:write");
    const input = categorySchema.parse(raw);
    if (id && input.parentId === id) return fail("Une catégorie ne peut pas être sa propre parente");
    const siteId = id ? (await prisma.category.findUniqueOrThrow({ where: { id }, select: { siteId: true } })).siteId : await adminDefaultSiteId();
    const slug = await uniqueSlug("category", input.slug || input.name, siteId, id ?? undefined);
    const data = { ...input, slug, siteId, parentId: input.parentId ?? null };
    const row = id ? await prisma.category.update({ where: { id }, data }) : await prisma.category.create({ data });
    await audit({ userId: user.id, action: id ? "category.update" : "category.create", entity: "category", entityId: row.id });
    revalidate();
    return succeed({ id: row.id });
  } catch (e) { return handleActionError(e); }
}

export async function deleteCategoryAction(id: string): Promise<ActionResult<undefined>> {
  try {
    const user = await assertPermission("catalog:write");
    await prisma.category.delete({ where: { id } }); // produits → categoryId null (SetNull)
    await audit({ userId: user.id, action: "category.delete", entity: "category", entityId: id });
    revalidate();
    return succeed(undefined);
  } catch (e) { return handleActionError(e); }
}

export async function reorderCategoriesAction(orderedIds: string[]): Promise<ActionResult<undefined>> {
  try {
    await assertPermission("catalog:write");
    await prisma.$transaction(orderedIds.map((id, position) => prisma.category.update({ where: { id }, data: { position } })));
    revalidate();
    return succeed(undefined);
  } catch (e) { return handleActionError(e); }
}

// --- Collections --------------------------------------------------------------


export async function saveCollectionAction(id: string | null, raw: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await assertPermission("catalog:write");
    const input = collectionSchema.parse(raw);
    const siteId = id ? (await prisma.collection.findUniqueOrThrow({ where: { id }, select: { siteId: true } })).siteId : await adminDefaultSiteId();
    const slug = await uniqueSlug("collection", input.slug || input.name, siteId, id ?? undefined);
    const data = { ...input, slug, siteId };
    const row = id ? await prisma.collection.update({ where: { id }, data }) : await prisma.collection.create({ data });
    await audit({ userId: user.id, action: id ? "collection.update" : "collection.create", entity: "collection", entityId: row.id });
    revalidate();
    return succeed({ id: row.id });
  } catch (e) { return handleActionError(e); }
}

export async function deleteCollectionAction(id: string): Promise<ActionResult<undefined>> {
  try {
    const user = await assertPermission("catalog:write");
    await prisma.collection.delete({ where: { id } });
    await audit({ userId: user.id, action: "collection.delete", entity: "collection", entityId: id });
    revalidate();
    return succeed(undefined);
  } catch (e) { return handleActionError(e); }
}

export async function reorderCollectionsAction(orderedIds: string[]): Promise<ActionResult<undefined>> {
  try {
    await assertPermission("catalog:write");
    await prisma.$transaction(orderedIds.map((id, position) => prisma.collection.update({ where: { id }, data: { position } })));
    revalidate();
    return succeed(undefined);
  } catch (e) { return handleActionError(e); }
}
