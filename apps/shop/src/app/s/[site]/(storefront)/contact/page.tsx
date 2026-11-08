import type { Metadata } from "next";
import { Mail } from "lucide-react";
import { getPublishedPage } from "@/lib/pages";
import { StaticPageView } from "@/components/storefront/static-page-view";
import { getSetting } from "@/lib/settings";
import { Breadcrumbs } from "@/components/storefront/breadcrumbs";
import { siteFromParams } from "@/lib/sites";

export const revalidate = 600;
export const metadata: Metadata = { title: "Contact", description: "Une question sur un kit, une commande ou un téléchargement ? Écrivez-nous." };

export default async function ContactPage({ params }: { params: Promise<{ site: string }> }) {
  const site = await siteFromParams(params);
  const page = await getPublishedPage(site.id, "contact");
  if (page) return <StaticPageView page={page} />;
  const brand = await getSetting("brand", site);
  return (
    <div className="container-shell max-w-xl py-10 sm:py-16">
      <Breadcrumbs items={[{ label: "Contact" }]} className="mb-6" />
      <div className="card-soft p-6 text-center sm:p-10">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-coral-light text-coral-dark"><Mail className="size-7" /></span>
        <h1 className="mt-4 font-heading text-3xl font-bold">Nous contacter</h1>
        <p className="mt-2 text-ink-soft">Une question sur un kit, une commande ou un téléchargement ? Nous répondons avec plaisir.</p>
        {brand.contactEmail ? (
          <a href={`mailto:${brand.contactEmail}`} className="mt-6 inline-flex items-center gap-2 rounded-full bg-coral px-6 py-3 font-heading font-bold text-white shadow-soft hover:brightness-105">{brand.contactEmail}</a>
        ) : (
          <p className="mt-6 text-sm text-ink-muted">L&apos;adresse de contact sera bientôt disponible.</p>
        )}
      </div>
    </div>
  );
}
