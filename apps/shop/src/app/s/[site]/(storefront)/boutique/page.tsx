import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/storefront/breadcrumbs";
import { CatalogView, parseCatalogParams, type CatalogSearchParams } from "@/components/storefront/catalog-view";
import { SectionHeading } from "@/components/storefront/section-heading";
import { JsonLd } from "@/components/storefront/json-ld";
import { siteFromParams, siteUrl } from "@/lib/sites";
import { getPreset } from "@/lib/sites/presets";

export async function generateMetadata({ params, searchParams }: { params: Promise<{ site: string }>; searchParams: Promise<CatalogSearchParams> }): Promise<Metadata> {
  const site = await siteFromParams(params);
  const labels = getPreset(site.preset).labels;
  const v = parseCatalogParams(await searchParams);
  const filtered = Boolean(v.q || v.age || v.theme || v.prix || v.duree || v.categorie || v.page > 1);
  return {
    title: v.q ? `Recherche : ${v.q}` : `Boutique — ${labels.boutiqueTitle.toLowerCase()}`,
    description: labels.catalogSeoDescription,
    alternates: { canonical: "/boutique" },
    robots: filtered ? { index: false, follow: true } : undefined,
  };
}

export default async function BoutiquePage({ params, searchParams }: { params: Promise<{ site: string }>; searchParams: Promise<CatalogSearchParams> }) {
  const site = await siteFromParams(params);
  const labels = getPreset(site.preset).labels;
  const sp = await searchParams;
  return (
    <div className="container-shell py-8 sm:py-12">
      <JsonLd data={{ "@context": "https://schema.org", "@type": "CollectionPage", name: "Boutique", url: `${siteUrl(site)}/boutique` }} />
      <Breadcrumbs baseUrl={siteUrl(site)} items={[{ label: "Boutique" }]} className="mb-6" />
      <SectionHeading as="h1" eyebrow="Boutique" title={labels.boutiqueTitle} description={labels.boutiqueDescription} />
      <CatalogView siteId={site.id} searchParams={sp} basePath="/boutique" />
    </div>
  );
}
