import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { getSettings } from "@/lib/settings";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { AppearanceForm } from "@/components/admin/ops-appearance-form";
import { getAdminSite, getDefaultSite } from "@/lib/sites";
import { SiteTargetNotice } from "@/components/admin/site-target-notice";

export const metadata = { title: "Apparence" };
export const dynamic = "force-dynamic";

export default async function AppearancePage() {
  await requirePermission("appearance:write");
  const adminSite = await getAdminSite();
  const target = adminSite ?? (await getDefaultSite());
  const [settings, products] = await Promise.all([
    getSettings(target),
    prisma.product.findMany({ where: { status: "PUBLISHED", siteId: target.id }, select: { id: true, name: true, slug: true }, orderBy: { name: "asc" } }),
  ]);
  return (
    <div>
      <AdminPageHeader title="Apparence" description="Marque, couleurs, typographies, page d'accueil, tunnel de vente, navigation et pied de page. Les changements s'appliquent immédiatement sur le site." actions={<Button asChild variant="outline" size="sm"><a href={`/?site=${target.slug}`} target="_blank" rel="noopener">Voir le site</a></Button>} />
      <SiteTargetNotice site={target} explicit={!!adminSite} />
      <AppearanceForm brand={settings.brand} theme={settings.theme} homepage={settings.homepage} navigation={settings.navigation} conversion={settings.conversion} products={products} />
    </div>
  );
}
