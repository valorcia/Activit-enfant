import { PageHeader } from "@/components/page-header";
import { BriefFlow } from "@/components/kits/brief-flow";
import { getAiSettings, providerAvailability, usesDemoProviders } from "@/lib/settings";
import { DemoModeBanner } from "@/components/demo-mode-banner";
import { manualText } from "@/lib/ai/registry";
import { shopClient } from "@/lib/shop/catalog";
import { activeSites, loadSites } from "@/lib/universes";

export const dynamic = "force-dynamic";

/** Réglages d'image du cahier de coloriage transmis au plan (aucune clé). */
function coloringAiOf(s: Awaited<ReturnType<typeof getAiSettings>>) {
  return { ...s.coloring, manualImagesNow: s.mode === "manual" && s.manualFor !== "text", manualTextNow: s.mode === "manual" && s.manualFor !== "images" };
}


export default async function BriefPage() {
  const settings = await getAiSettings();
  const client = await shopClient();
  const categories = client ? await client.categories().then((c) => c.map((x) => ({ slug: x.slug, name: x.name }))).catch(() => undefined) : undefined;
  const [sites, { source, error: sitesError }] = await Promise.all([activeSites(), loadSites()]);
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl">
      <PageHeader title="Créer depuis un brief" description="Collez votre demande : le studio en déduit l'univers de la boutique, le type d'e-book, le ton, le prix… puis produit tout le reste automatiquement." />
      <DemoModeBanner {...usesDemoProviders(settings)} keys={providerAvailability()} />
      <BriefFlow coloringAi={coloringAiOf(settings)} mode={manualText(settings) ? "manual" : "api"} categories={categories} sites={sites} sitesNote={source === "fallback" ? sitesError ?? "Univers par défaut (boutique mono-univers)." : null} />
    </div>
  );
}
