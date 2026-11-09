import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { AdminPageHeader } from "@/components/admin/page-header";
import { ProductForm } from "@/components/admin/product-form";
import { productToForm } from "@/lib/admin/product-form-data";
import { getSites, siteUrl } from "@/lib/sites";
import { EtsyProductPanel } from "@/components/admin/ops-etsy";
import { etsyProductPreview } from "@/lib/channels/etsy";

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
  const [categories, collections, products, sites] = await Promise.all([
    prisma.category.findMany({ orderBy: { position: "asc" }, select: { id: true, name: true, siteId: true } }),
    prisma.collection.findMany({ orderBy: { position: "asc" }, select: { id: true, name: true, siteId: true } }),
    prisma.product.findMany({ where: { status: { not: "ARCHIVED" } }, orderBy: { name: "asc" }, select: { id: true, name: true, slug: true } }),
    getSites(),
  ]);
  const etsy = await etsyProductPreview(product.id).catch((e) => { console.warn("[etsy] aperçu", e); return null; });
  return (
    <div>
      <AdminPageHeader title={product.name} breadcrumbs={[{ label: "Produits", href: "/admin/produits" }, { label: product.name }]} />
      <ProductForm
        initial={productToForm(product)}
        images={product.images.map((i) => ({ id: i.id, url: i.url, alt: i.alt, role: i.role, position: i.position }))}
        files={product.files.map((f) => ({ id: f.id, name: f.name, description: f.description, kind: f.kind, sizeBytes: f.sizeBytes, mime: f.mime }))}
        categories={categories} collections={collections} products={products} sites={sites.filter((s) => s.status !== "ARCHIVED" || s.id === product.siteId).map((s) => ({ id: s.id, name: s.name, url: siteUrl(s) }))}
      />
      {etsy && (
        <EtsyProductPanel
          productId={product.id}
          connected={Boolean(etsy.account)}
          enabled={etsy.settings.enabled}
          defaultState={etsy.settings.defaultState}
          listing={etsy.listing ? { id: etsy.listing.id, state: etsy.listing.state, url: etsy.listing.url, etsyListingId: etsy.listing.etsyListingId, lastSyncedAt: etsy.listing.lastSyncedAt?.toISOString() ?? null, lastError: etsy.listing.lastError } : null}
          generated={{ title: etsy.generated.title, description: etsy.generated.description, tags: etsy.generated.tags, priceCents: etsy.generated.priceCents }}
          overrides={etsy.overrides}
          fees={etsy.settings}
          listingFeeCents={etsy.settings.listingFeeCents}
          issues={etsy.issues}
          currency={product.currency}
        />
      )}
    </div>
  );
}
