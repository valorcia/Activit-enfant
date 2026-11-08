import { PageHeader } from "@/components/page-header";
import { KitWizard } from "@/components/kits/kit-wizard";
import { getStudioSettings } from "@/lib/settings";
import { shopClient } from "@/lib/shop/catalog";
import { activeSites, defaultSiteSlug } from "@/lib/universes";

export const dynamic = "force-dynamic";

export default async function NewBookPage() {
  const studio = await getStudioSettings();
  const client = await shopClient();
  const categories = client ? await client.categories().then((c) => c.map((x) => ({ slug: x.slug, name: x.name }))).catch(() => undefined) : undefined;
  const [sites, defaultSite] = await Promise.all([activeSites(), defaultSiteSlug()]);
  return (
    <div className="p-8 max-w-5xl">
      <PageHeader title="Nouvel e-book" description="Univers de la boutique, type d'e-book, personnalisation (thème, personnage, âge, prix…), style, puis production automatique." />
      <KitWizard categories={categories} prices={studio.priceByKitType} sites={sites} defaultSiteSlug={defaultSite} />
    </div>
  );
}
