import type { Metadata } from "next";
import Link from "next/link";
import { Boxes } from "lucide-react";
import { env } from "@/lib/env";
import { getPublishedBundles } from "@/lib/catalog";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { Breadcrumbs } from "@/components/storefront/breadcrumbs";
import { BundleCard } from "@/components/storefront/bundle-card";
import { SectionHeading } from "@/components/storefront/section-heading";
import { JsonLd } from "@/components/storefront/json-ld";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Packs et offres groupées",
  description: "Plusieurs aventures à imprimer réunies à prix doux : packs anniversaire, vacances, par âge ou par thème.",
  alternates: { canonical: `${env.appUrl}/packs` },
};

export default async function PacksPage() {
  const bundles = await getPublishedBundles(48);
  return (
    <div className="container-shell py-8 sm:py-12">
      <JsonLd data={{ "@context": "https://schema.org", "@type": "CollectionPage", name: "Packs", url: `${env.appUrl}/packs` }} />
      <Breadcrumbs items={[{ label: "Packs" }]} className="mb-6" />
      <SectionHeading as="h1" eyebrow="Bons plans" title="Packs et offres groupées" description="Plusieurs kits réunis pour prolonger le plaisir, à prix réduit." />
      {bundles.length === 0 ? (
        <EmptyState icon={<Boxes />} title="Aucun pack disponible pour le moment" description="Les offres groupées arrivent bientôt. En attendant, découvrez toutes nos aventures." action={<Button asChild><Link href="/boutique">Voir la boutique</Link></Button>} />
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {bundles.map((b) => <BundleCard key={b.id} bundle={b} />)}
        </div>
      )}
    </div>
  );
}
