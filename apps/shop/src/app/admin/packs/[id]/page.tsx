import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { AdminPageHeader } from "@/components/admin/page-header";
import { BundleForm } from "@/components/admin/bundle-form";
import { bundleToForm } from "@/lib/admin/bundle-form-data";

export const dynamic = "force-dynamic";

export default async function EditBundlePage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("catalog:write");
  const { id } = await params;
  const bundle = await prisma.bundle.findUnique({ where: { id }, include: { items: { orderBy: { position: "asc" } } } });
  if (!bundle) notFound();
  const products = await prisma.product.findMany({ where: { status: { not: "ARCHIVED" } }, orderBy: { name: "asc" }, select: { id: true, name: true, slug: true, priceCents: true, status: true } });
  return (
    <div>
      <AdminPageHeader title={bundle.name} breadcrumbs={[{ label: "Packs", href: "/admin/packs" }, { label: bundle.name }]} />
      <BundleForm initial={bundleToForm(bundle)} products={products} siteUrl={env.appUrl} />
    </div>
  );
}
