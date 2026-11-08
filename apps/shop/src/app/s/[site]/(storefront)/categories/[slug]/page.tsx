import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import { prisma } from "@/lib/db";
import { siteFromParams, siteUrl, getSites } from "@/lib/sites";
import { getCategories, getCategoryBySlug } from "@/lib/catalog";
import { Icon } from "@/components/ui/icon";
import { Breadcrumbs } from "@/components/storefront/breadcrumbs";
import { CatalogView, type CatalogSearchParams } from "@/components/storefront/catalog-view";
import { JsonLd } from "@/components/storefront/json-ld";

export const revalidate = 300;

export async function generateStaticParams({ params }: { params: { site: string } }) {
  const site = (await getSites()).find((s) => s.slug === params.site);
  if (!site) return [];
  const cats = await prisma.category.findMany({ where: { siteId: site.id, isVisible: true }, select: { slug: true } });
  return cats.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ site: string; slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const site = await siteFromParams(params);
  const cat = await getCategoryBySlug(site.id, slug);
  if (!cat) return {};
  return {
    title: cat.seoTitle ?? `${cat.name} à imprimer`,
    description: cat.seoDescription ?? cat.description ?? undefined,
    alternates: { canonical: `/categories/${cat.slug}` },
    openGraph: { title: cat.seoTitle ?? cat.name, description: cat.seoDescription ?? cat.description ?? undefined, images: cat.illustrationUrl ? [cat.illustrationUrl] : undefined },
  };
}

export default async function CategoryPage({ params, searchParams }: { params: Promise<{ site: string; slug: string }>; searchParams: Promise<CatalogSearchParams> }) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const site = await siteFromParams(params);
  const cat = await getCategoryBySlug(site.id, slug);
  if (!cat) notFound();
  const siblings = (await getCategories(site.id)).filter((c) => c.slug !== cat.slug);
  const tint = cat.color ?? "var(--brand-coral)";

  return (
    <div>
      <JsonLd data={{ "@context": "https://schema.org", "@type": "CollectionPage", name: cat.name, description: cat.description ?? undefined, url: `${siteUrl(site)}/categories/${cat.slug}` }} />
      <section className="relative overflow-hidden" style={{ background: `color-mix(in oklab, ${tint} 22%, white)` }}>
        <div className="pointer-events-none absolute -right-16 -top-16 size-72 rounded-full opacity-40 blur-3xl" style={{ background: tint }} aria-hidden />
        <div className="container-shell grid items-center gap-8 py-10 sm:py-14 lg:grid-cols-[1.3fr_1fr]">
          <div>
            <Breadcrumbs baseUrl={siteUrl(site)} items={[{ label: "Boutique", href: "/boutique" }, { label: cat.name }]} className="mb-4" />
            <div className="flex items-center gap-4">
              <span className="grid size-14 shrink-0 place-items-center rounded-2xl text-white shadow-soft rotate-[-4deg]" style={{ background: tint }}><Icon name={cat.icon ?? "sparkles"} className="size-7" /></span>
              <h1 className="font-heading text-4xl font-bold leading-tight sm:text-5xl">{cat.name}</h1>
            </div>
            {cat.description && <p className="mt-4 max-w-2xl text-lg text-ink-soft">{cat.description}</p>}
            {siblings.length > 0 && (
              <ul className="mt-6 flex flex-wrap gap-2" aria-label="Autres catégories">
                {siblings.map((s) => (
                  <li key={s.id}><a href={`/categories/${s.slug}`} className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-sm font-bold shadow-card hover:bg-ink hover:text-white"><Icon name={s.icon ?? "sparkles"} className="size-4" style={{ color: s.color ?? undefined }} />{s.name}</a></li>
                ))}
              </ul>
            )}
          </div>
          {cat.illustrationUrl && (
            <div className="relative hidden aspect-[4/3] overflow-hidden rounded-[var(--radius-card)] shadow-card lg:block">
              <Image src={cat.illustrationUrl} alt="" fill sizes="33vw" className="object-cover" priority />
            </div>
          )}
        </div>
      </section>
      <div className="container-shell py-8 sm:py-12">
        <CatalogView siteId={site.id} searchParams={sp} basePath={`/categories/${cat.slug}`} fixed={{ category: cat.slug }} hideCategory />
      </div>
    </div>
  );
}
