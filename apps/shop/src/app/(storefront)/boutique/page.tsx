import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/storefront/breadcrumbs";
import { CatalogView, parseCatalogParams, type CatalogSearchParams } from "@/components/storefront/catalog-view";
import { SectionHeading } from "@/components/storefront/section-heading";
import { JsonLd } from "@/components/storefront/json-ld";
import { env } from "@/lib/env";

export async function generateMetadata({ searchParams }: { searchParams: Promise<CatalogSearchParams> }): Promise<Metadata> {
  const v = parseCatalogParams(await searchParams);
  const filtered = Boolean(v.q || v.age || v.theme || v.prix || v.duree || v.categorie || v.page > 1);
  return {
    title: v.q ? `Recherche : ${v.q}` : "Boutique — toutes les aventures à imprimer",
    description: "Chasses au trésor, cahiers d'activités, kits d'anniversaire et histoires à imprimer pour enfants de 3 à 12 ans. Filtrez par âge, thème, prix et durée.",
    alternates: { canonical: `${env.appUrl}/boutique` },
    robots: filtered ? { index: false, follow: true } : undefined,
  };
}

export default async function BoutiquePage({ searchParams }: { searchParams: Promise<CatalogSearchParams> }) {
  const sp = await searchParams;
  return (
    <div className="container-shell py-8 sm:py-12">
      <JsonLd data={{ "@context": "https://schema.org", "@type": "CollectionPage", name: "Boutique", url: `${env.appUrl}/boutique` }} />
      <Breadcrumbs items={[{ label: "Boutique" }]} className="mb-6" />
      <SectionHeading as="h1" eyebrow="Boutique" title="Toutes nos aventures à imprimer" description="Filtrez par âge, thème, prix ou durée pour trouver l'activité parfaite." />
      <CatalogView searchParams={sp} basePath="/boutique" />
    </div>
  );
}
