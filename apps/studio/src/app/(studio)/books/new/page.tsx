import { PageHeader } from "@/components/page-header";
import { KitWizard } from "@/components/kits/kit-wizard";
import { getStudioSettings } from "@/lib/settings";
import { shopClient } from "@/lib/shop/catalog";

export const dynamic = "force-dynamic";

export default async function NewBookPage() {
  const studio = await getStudioSettings();
  const client = await shopClient();
  const categories = client ? await client.categories().then((c) => c.map((x) => ({ slug: x.slug, name: x.name }))).catch(() => undefined) : undefined;
  return (
    <div className="p-8 max-w-5xl">
      <PageHeader title="Nouveau kit" description="Type de kit, personnalisation (univers, personnage, compagnon, âge, prix…), style, puis production automatique." />
      <KitWizard categories={categories} prices={studio.priceByKitType} />
    </div>
  );
}
