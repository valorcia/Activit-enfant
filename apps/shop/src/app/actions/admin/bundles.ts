"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { assertPermission } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { revalidateCatalog } from "@/lib/catalog";
import { handleActionError, succeed, fail, type ActionResult } from "@/lib/admin/action-result";
import { slugify } from "@/lib/utils";
import { bundleSchema } from "@/lib/schemas/catalog";
import { adminDefaultSiteId } from "@/lib/sites";


async function uniqueSlug(base: string, excludeId?: string) {
  const root = slugify(base) || "pack";
  let slug = root;
  for (let i = 2; i < 200; i++) {
    const ex = await prisma.bundle.findUnique({ where: { slug }, select: { id: true } });
    if (!ex || ex.id === excludeId) return slug;
    slug = `${root}-${i}`;
  }
  return `${root}-${Date.now()}`;
}

function revalidate(id?: string) {
  revalidateCatalog();
  revalidatePath("/admin/packs");
  if (id) revalidatePath(`/admin/packs/${id}`);
}

export async function saveBundleAction(id: string | null, raw: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await assertPermission("catalog:write");
    const input = bundleSchema.parse(raw);
    const products = await prisma.product.findMany({ where: { id: { in: input.productIds } }, select: { id: true, siteId: true } });
    if (products.length !== input.productIds.length) return fail("Un des produits sélectionnés n'existe plus");
    // Un pack appartient à l'univers de ses produits (tous du même univers)
    const siteIds = [...new Set(products.map((p) => p.siteId))];
    if (siteIds.length > 1) return fail("Les produits d'un pack doivent appartenir au même univers");
    const slug = await uniqueSlug(input.slug || input.name, id ?? undefined);
    const { productIds, ...rest } = input;
    const before = id ? await prisma.bundle.findUnique({ where: { id } }) : null;
    const siteId = siteIds[0] ?? before?.siteId ?? (await adminDefaultSiteId());
    const data = { ...rest, slug, siteId, publishedAt: input.status === "PUBLISHED" ? before?.publishedAt ?? new Date() : before?.publishedAt ?? null };
    const row = await prisma.$transaction(async (tx) => {
      const b = id ? await tx.bundle.update({ where: { id }, data }) : await tx.bundle.create({ data });
      await tx.bundleItem.deleteMany({ where: { bundleId: b.id } });
      await tx.bundleItem.createMany({ data: productIds.map((productId, position) => ({ bundleId: b.id, productId, position })) });
      return b;
    });
    await audit({ userId: user.id, action: id ? "bundle.update" : "bundle.create", entity: "bundle", entityId: row.id, data: { status: row.status } });
    revalidate(row.id);
    return succeed({ id: row.id });
  } catch (e) { return handleActionError(e); }
}

export async function deleteBundleAction(id: string): Promise<ActionResult<{ archived: boolean }>> {
  try {
    const user = await assertPermission("catalog:write");
    const sold = await prisma.orderItem.count({ where: { bundleId: id } });
    if (sold > 0) {
      await prisma.bundle.update({ where: { id }, data: { status: "ARCHIVED" } });
    } else {
      await prisma.bundle.delete({ where: { id } });
    }
    await audit({ userId: user.id, action: sold > 0 ? "bundle.archive" : "bundle.delete", entity: "bundle", entityId: id });
    revalidate(id);
    return succeed({ archived: sold > 0 });
  } catch (e) { return handleActionError(e); }
}
