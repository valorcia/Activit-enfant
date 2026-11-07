import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { AdminPageHeader } from "@/components/admin/page-header";
import { ProductForm } from "@/components/admin/product-form";
import { emptyProductForm } from "@/lib/admin/product-form-data";

export const metadata = { title: "Nouveau produit" };
export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  await requirePermission("products:write");
  const [categories, collections, products] = await Promise.all([
    prisma.category.findMany({ orderBy: { position: "asc" }, select: { id: true, name: true } }),
    prisma.collection.findMany({ orderBy: { position: "asc" }, select: { id: true, name: true } }),
    prisma.product.findMany({ where: { status: { not: "ARCHIVED" } }, orderBy: { name: "asc" }, select: { id: true, name: true, slug: true } }),
  ]);
  return (
    <div>
      <AdminPageHeader title="Nouveau produit" breadcrumbs={[{ label: "Produits", href: "/admin/produits" }, { label: "Nouveau" }]} description="Astuce : pour aller plus vite, dupliquez un produit existant depuis la liste." />
      <ProductForm initial={emptyProductForm()} images={[]} files={[]} categories={categories} collections={collections} products={products} siteUrl={env.appUrl} />
    </div>
  );
}
