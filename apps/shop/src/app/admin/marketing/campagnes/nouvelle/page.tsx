import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { AdminPageHeader } from "@/components/admin/page-header";
import { MarketingNav } from "@/components/admin/ops-marketing-nav";
import { CampaignForm } from "@/components/admin/ops-campaign-form";
import { emptyCampaign } from "@/lib/admin/campaign-form-data";

export const metadata = { title: "Nouvelle campagne" };
export const dynamic = "force-dynamic";

export default async function NewCampaignPage({ searchParams }: { searchParams: Promise<{ produit?: string }> }) {
  await requirePermission("marketing:write");
  const { produit } = await searchParams;
  const [products, adAccounts] = await Promise.all([
    prisma.product.findMany({ where: { status: { in: ["PUBLISHED", "SCHEDULED", "DRAFT"] } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.socialAccount.findMany({ where: { kind: "AD_ACCOUNT", isActive: true }, select: { id: true, name: true, provider: true } }),
  ]);
  return (
    <div>
      <AdminPageHeader title="Nouvelle campagne" breadcrumbs={[{ label: "Marketing social", href: "/admin/marketing" }, { label: "Campagnes", href: "/admin/marketing/campagnes" }, { label: "Nouvelle" }]} />
      <MarketingNav />
      <CampaignForm initial={{ ...emptyCampaign(), productId: produit ?? "" }} products={products} adAccounts={adAccounts} />
    </div>
  );
}
