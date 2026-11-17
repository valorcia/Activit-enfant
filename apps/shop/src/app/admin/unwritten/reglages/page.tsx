import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { AdminCard, AdminPageHeader } from "@/components/admin/page-header";
import { BrandSettingsForm, ProductSettingsForm } from "@/components/admin/unwritten-admin";
import { EmptyState } from "@/components/ui/misc";
import { SUPPORTED_LOCALES } from "@/lib/unwritten/constants";
import { readUnwrittenConfig } from "@/lib/unwritten/config";
import { pricesSchema } from "@/lib/unwritten/catalog-content";
import { adminPersonalizedSites } from "@/lib/unwritten/admin";

export const metadata = { title: "Réglages de la marque" };
export const dynamic = "force-dynamic";

/** Interrupteur d'ouverture par langue, conservation des données, prix par produit et par devise. */
export default async function BrandSettingsPage() {
  await requirePermission("settings:write");
  const sites = await adminPersonalizedSites();
  if (!sites.length) return <div><AdminPageHeader title="Réglages de la marque" /><EmptyState title="Aucune marque personnalisée sélectionnée" /></div>;
  const products = await prisma.product.findMany({ where: { siteId: { in: sites.map((s) => s.id) }, personalization: { isNot: null } }, include: { personalization: true }, orderBy: { createdAt: "asc" } });
  return (
    <div className="space-y-6">
      <AdminPageHeader title="Réglages de la marque" description="Marques à vitrine personnalisée (UNWRITTEN). Le statut, les domaines et l'aperçu se règlent dans « Univers & domaines »." />
      {sites.map((site) => (
        <div key={site.id} className="space-y-6">
          <AdminCard title={`${site.name} · langues et données`} description={`Statut ${site.status}${site.domains.length ? ` · ${site.domains.join(", ")}` : " · sans domaine (aperçu : /?site=" + site.slug + ")"} · devises : ${site.currencies.join(", ")}`}>
            <BrandSettingsForm siteId={site.id} supported={[...SUPPORTED_LOCALES]} openLocales={site.locales} defaultLocale={site.defaultLocale} config={readUnwrittenConfig(site.settings)} />
          </AdminCard>
          <AdminCard title={`${site.name} · prix par produit`} description="Prix TTC fixés par devise (aucune conversion automatique). Le délai est une estimation affichée sur la fiche : à valider avant l'ouverture.">
            <div className="space-y-6">
              {products.filter((p) => p.siteId === site.id).map((p) => {
                const prices = pricesSchema.safeParse(p.personalization!.prices);
                return (
                  <div key={p.id}>
                    <p className="mb-2 text-sm font-bold">{p.name}</p>
                    <ProductSettingsForm productId={p.id} currencies={site.currencies} prices={prices.success ? prices.data : {}} deliveryDaysMin={p.personalization!.deliveryDaysMin} deliveryDaysMax={p.personalization!.deliveryDaysMax} pagesMin={p.personalization!.pagesMin} pagesMax={p.personalization!.pagesMax} />
                  </div>
                );
              })}
            </div>
          </AdminCard>
        </div>
      ))}
    </div>
  );
}
