import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { AdminPageHeader } from "@/components/admin/page-header";
import { ProductForm } from "@/components/admin/product-form";
import { productToForm } from "@/lib/admin/product-form-data";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await prisma.product.findUnique({ where: { id }, select: { name: true } });
  return { title: p ? `Modifier · ${p.name}` : "Produit" };
}

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("products:write");
  const { id } = await params;
  const product = await prisma.product.findUnique({ where: { id }, include: { images: { orderBy: { position: "asc" } }, files: { orderBy: { position: "asc" } }, collections: true, recommendations: true } });
  if (!product) notFound();
  const [categories, collections, products] = await Promise.all([
    prisma.category.findMany({ orderBy: { position: "asc" }, select: { id: true, name: true } }),
    prisma.collection.findMany({ orderBy: { position: "asc" }, select: { id: true, name: true } }),
    prisma.product.findMany({ where: { status: { not: "ARCHIVED" } }, orderBy: { name: "asc" }, select: { id: true, name: true, slug: true } }),
  ]);
  return (
    <div>
      <AdminPageHeader title={product.name} breadcrumbs={[{ label: "Produits", href: "/admin/produits" }, { label: product.name }]} />
      <ProductForm
        initial={productToForm(product)}
        images={product.images.map((i) => ({ id: i.id, url: i.url, alt: i.alt, role: i.role, position: i.position }))}
        files={product.files.map((f) => ({ id: f.id, name: f.name, description: f.description, kind: f.kind, sizeBytes: f.sizeBytes, mime: f.mime }))}
        categories={categories} collections={collections} products={products} siteUrl={env.appUrl}
      />
    </div>
  );
}
