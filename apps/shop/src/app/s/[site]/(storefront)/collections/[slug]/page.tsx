import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import { prisma } from "@/lib/db";
import { siteFromParams, siteUrl, getSites } from "@/lib/sites";
import { getCollectionBySlug } from "@/lib/catalog";
import { Breadcrumbs } from "@/components/storefront/breadcrumbs";
import { CatalogView, type CatalogSearchParams } from "@/components/storefront/catalog-view";
import { JsonLd } from "@/components/storefront/json-ld";

export const revalidate = 300;

export async function generateStaticParams({ params }: { params: { site: string } }) {
  const site = (await getSites()).find((s) => s.slug === params.site);
  if (!site) return [];
  const rows = await prisma.collection.findMany({ where: { siteId: site.id, isVisible: true }, select: { slug: true } });
  return rows.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ site: string; slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const site = await siteFromParams(params);
  const col = await getCollectionBySlug(site.id, slug);
  if (!col) return {};
  return {
    title: col.seoTitle ?? `Collection ${col.name}`,
    description: col.seoDescription ?? col.description ?? undefined,
    alternates: { canonical: `/collections/${col.slug}` },
    openGraph: { title: col.seoTitle ?? col.name, description: col.seoDescription ?? col.description ?? undefined, images: col.imageUrl ? [col.imageUrl] : undefined },
  };
}

export default async function CollectionPage({ params, searchParams }: { params: Promise<{ site: string; slug: string }>; searchParams: Promise<CatalogSearchParams> }) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const site = await siteFromParams(params);
  const col = await getCollectionBySlug(site.id, slug);
  if (!col) notFound();
  const tint = col.color ?? "var(--brand-lavender)";
  return (
    <div>
      <JsonLd data={{ "@context": "https://schema.org", "@type": "CollectionPage", name: col.name, description: col.description ?? undefined, url: `${siteUrl(site)}/collections/${col.slug}` }} />
      <section className="relative overflow-hidden" style={{ background: `color-mix(in oklab, ${tint} 25%, white)` }}>
        <div className="container-shell grid items-center gap-8 py-10 sm:py-14 lg:grid-cols-[1.3fr_1fr]">
          <div>
            <Breadcrumbs baseUrl={siteUrl(site)} items={[{ label: "Boutique", href: "/boutique" }, { label: col.name }]} className="mb-4" />
            <p className="font-heading text-sm font-bold uppercase tracking-wider text-ink-soft">Collection</p>
            <h1 className="mt-1 font-heading text-4xl font-bold leading-tight sm:text-5xl">{col.name}</h1>
            {col.description && <p className="mt-4 max-w-2xl text-lg text-ink-soft">{col.description}</p>}
          </div>
          {col.imageUrl && (
            <div className="relative hidden aspect-[4/3] overflow-hidden rounded-[var(--radius-card)] shadow-card lg:block">
              <Image src={col.imageUrl} alt="" fill sizes="33vw" className="object-cover" priority />
            </div>
          )}
        </div>
      </section>
      <div className="container-shell py-8 sm:py-12">
        <CatalogView siteId={site.id} searchParams={sp} basePath={`/collections/${col.slug}`} fixed={{ collection: col.slug }} />
      </div>
    </div>
  );
}
