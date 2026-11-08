import { PageHeader } from "@/components/page-header";
import { BriefFlow } from "@/components/kits/brief-flow";
import { getAiSettings } from "@/lib/settings";
import { manualText } from "@/lib/ai/registry";
import { shopClient } from "@/lib/shop/catalog";

export const dynamic = "force-dynamic";

export default async function BriefPage() {
  const settings = await getAiSettings();
  const client = await shopClient();
  const categories = client ? await client.categories().then((c) => c.map((x) => ({ slug: x.slug, name: x.name }))).catch(() => undefined) : undefined;
  return (
    <div className="p-8 max-w-5xl">
      <PageHeader title="Créer depuis un brief" description="Collez votre demande : le studio en déduit le type de kit, le personnage, l'univers, le prix… puis produit tout le reste automatiquement." />
      <BriefFlow mode={manualText(settings) ? "manual" : "api"} categories={categories} />
    </div>
  );
}
