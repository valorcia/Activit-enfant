import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { AdminPageHeader } from "@/components/admin/page-header";
import { BundleForm } from "@/components/admin/bundle-form";
import { emptyBundleForm } from "@/lib/admin/bundle-form-data";

export const metadata = { title: "Nouveau pack" };
export const dynamic = "force-dynamic";

export default async function NewBundlePage() {
  await requirePermission("catalog:write");
  const products = await prisma.product.findMany({ where: { status: { not: "ARCHIVED" } }, orderBy: { name: "asc" }, select: { id: true, name: true, slug: true, priceCents: true, status: true } });
  return (
    <div>
      <AdminPageHeader title="Nouveau pack" breadcrumbs={[{ label: "Packs", href: "/admin/packs" }, { label: "Nouveau" }]} />
      <BundleForm initial={emptyBundleForm()} products={products} siteUrl={env.appUrl} />
    </div>
  );
}
