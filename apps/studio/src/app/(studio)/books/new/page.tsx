import { PageHeader } from "@/components/page-header";
import { KitWizard } from "@/components/kits/kit-wizard";
import { getStudioSettings } from "@/lib/settings";
import { shopClient } from "@/lib/shop/catalog";
import { activeSites, defaultSiteSlug } from "@/lib/universes";

import { getAiSettings, providerAvailability, usesDemoProviders } from "@/lib/settings";
import { DemoModeBanner } from "@/components/demo-mode-banner";

export const dynamic = "force-dynamic";

/** Réglages d'image du cahier de coloriage transmis au plan (aucune clé). */
function coloringAiOf(s: Awaited<ReturnType<typeof getAiSettings>>) {
  return { ...s.coloring, manualImagesNow: s.mode === "manual" && s.manualFor !== "text", manualTextNow: s.mode === "manual" && s.manualFor !== "images" };
}


export default async function NewBookPage() {
  const studio = await getStudioSettings();
  const ai = await getAiSettings();
  const client = await shopClient();
  const categories = client ? await client.categories().then((c) => c.map((x) => ({ slug: x.slug, name: x.name }))).catch(() => undefined) : undefined;
  const [sites, defaultSite] = await Promise.all([activeSites(), defaultSiteSlug()]);
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl">
      <PageHeader title="Nouvel e-book" description="Univers de la boutique, type d'e-book, personnalisation (thème, personnage, âge, prix…), style, puis production automatique." />
      <DemoModeBanner {...usesDemoProviders(ai)} keys={providerAvailability()} />
      <KitWizard coloringAi={coloringAiOf(ai)} categories={categories} prices={studio.priceByKitType} sites={sites} defaultSiteSlug={defaultSite} />
    </div>
  );
}
