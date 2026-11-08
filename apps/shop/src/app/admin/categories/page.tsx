import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { AdminPageHeader } from "@/components/admin/page-header";
import { TaxonomyManager } from "@/components/admin/taxonomy-manager";
import { saveCategoryAction, deleteCategoryAction, reorderCategoriesAction } from "@/app/actions/admin/categories";
import { adminSiteWhere } from "@/lib/sites";

export const metadata = { title: "Catégories" };
export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  await requirePermission("products:read");
  const rows = await prisma.category.findMany({ where: await adminSiteWhere(), orderBy: { position: "asc" }, include: { _count: { select: { products: true } } } });
  return (
    <div>
      <AdminPageHeader title="Catégories" description="Les nouveaux produits apparaissent automatiquement dans leur catégorie. Ordre = ordre d'affichage sur le site." />
      <TaxonomyManager kind="category" save={saveCategoryAction} remove={deleteCategoryAction} reorder={reorderCategoriesAction}
        items={rows.map((c) => ({ id: c.id, name: c.name, slug: c.slug, description: c.description, imageUrl: c.illustrationUrl, color: c.color, icon: c.icon, position: c.position, isVisible: c.isVisible, seoTitle: c.seoTitle, seoDescription: c.seoDescription, parentId: c.parentId, productCount: c._count.products }))} />
    </div>
  );
}
