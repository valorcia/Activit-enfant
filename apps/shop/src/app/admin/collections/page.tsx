import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { AdminPageHeader } from "@/components/admin/page-header";
import { TaxonomyManager } from "@/components/admin/taxonomy-manager";
import { saveCollectionAction, deleteCollectionAction, reorderCollectionsAction } from "@/app/actions/admin/categories";

export const metadata = { title: "Collections" };
export const dynamic = "force-dynamic";

export default async function CollectionsPage() {
  await requirePermission("products:read");
  const rows = await prisma.collection.findMany({ orderBy: { position: "asc" }, include: { _count: { select: { products: true } } } });
  return (
    <div>
      <AdminPageHeader title="Collections" description="Regroupements transversaux (univers, tranche d'âge, saison…). Un produit peut appartenir à plusieurs collections." />
      <TaxonomyManager kind="collection" save={saveCollectionAction} remove={deleteCollectionAction} reorder={reorderCollectionsAction}
        items={rows.map((c) => ({ id: c.id, name: c.name, slug: c.slug, description: c.description, imageUrl: c.imageUrl, color: c.color, position: c.position, isVisible: c.isVisible, seoTitle: c.seoTitle, seoDescription: c.seoDescription, productCount: c._count.products }))} />
    </div>
  );
}
