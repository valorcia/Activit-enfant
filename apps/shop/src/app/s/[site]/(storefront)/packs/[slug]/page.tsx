import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Check, Download, Layers, Printer, Zap } from "lucide-react";
import { prisma } from "@/lib/db";
import { siteFromParams, siteUrl, getSites } from "@/lib/sites";
import { bundleSavings, getBundleBySlug } from "@/lib/catalog";
import { formatPrice } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Markdown } from "@/components/markdown";
import { AddToCartButton } from "@/components/storefront/add-to-cart-button";
import { Breadcrumbs } from "@/components/storefront/breadcrumbs";
import { JsonLd } from "@/components/storefront/json-ld";
import { PlaceholderArt } from "@/components/storefront/placeholder-art";
import { Price } from "@/components/storefront/price";
import { ProductGrid } from "@/components/storefront/product-card";
import { SectionHeading } from "@/components/storefront/section-heading";

export const revalidate = 300;

export async function generateStaticParams({ params }: { params: { site: string } }) {
  const site = (await getSites()).find((s) => s.slug === params.site);
  if (!site) return [];
  const rows = await prisma.bundle.findMany({ where: { siteId: site.id, status: "PUBLISHED" }, select: { slug: true } });
  return rows.map((b) => ({ slug: b.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ site: string; slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const site = await siteFromParams(params);
  const b = await getBundleBySlug(site.id, slug);
  if (!b) return {};
  return {
    title: b.seoTitle ?? b.name,
    description: b.seoDescription ?? b.tagline ?? b.description ?? undefined,
    alternates: { canonical: `/packs/${b.slug}` },
    openGraph: { type: "website", title: b.seoTitle ?? b.name, description: b.seoDescription ?? b.tagline ?? undefined, images: b.imageUrl ? [b.imageUrl] : undefined },
  };
}

export default async function BundlePage({ params }: { params: Promise<{ site: string; slug: string }> }) {
  const { slug } = await params;
  const site = await siteFromParams(params);
  const baseUrl = siteUrl(site);
  const b = await getBundleBySlug(site.id, slug);
  if (!b) notFound();
  const s = bundleSavings(b);
  const products = b.items.map((it) => it.product);
  const cartItem = { kind: "bundle" as const, id: b.id, slug: b.slug, name: b.name, imageUrl: b.imageUrl, unitPriceCents: b.priceCents, currency: b.currency };

  return (
    <div>
      <JsonLd data={{
        "@context": "https://schema.org", "@type": "Product", name: b.name, description: b.tagline ?? b.description ?? undefined, url: `${baseUrl}/packs/${b.slug}`, ...(b.imageUrl ? { image: b.imageUrl } : {}),
        offers: { "@type": "Offer", price: (b.priceCents / 100).toFixed(2), priceCurrency: b.currency, availability: "https://schema.org/InStock", url: `${baseUrl}/packs/${b.slug}` },
        isRelatedTo: products.map((p) => ({ "@type": "Product", name: p.name, url: `${baseUrl}/aventures/${p.slug}` })),
      }} />
      <section className="bg-lavender-light/60">
        <div className="container-shell grid items-center gap-10 py-10 sm:py-14 lg:grid-cols-2">
          <div>
            <Breadcrumbs items={[{ label: "Packs", href: "/packs" }, { label: b.name }]} className="mb-5" />
            <div className="flex flex-wrap gap-2">
              <Badge variant="lavender"><Layers /> Pack de {b.items.length} kits</Badge>
              {s.savingsCents > 0 && <Badge variant="coral">-{s.percent} % par rapport à l&apos;achat séparé</Badge>}
              {b.badges.map((x) => <Badge key={x} variant="honey">{x}</Badge>)}
            </div>
            <h1 className="mt-4 font-heading text-4xl font-bold leading-tight sm:text-5xl">{b.name}</h1>
            {b.tagline && <p className="mt-3 text-lg text-ink-soft">{b.tagline}</p>}
            <div className="mt-6 flex flex-wrap items-end gap-4">
              <Price priceCents={b.priceCents} compareAtCents={s.savingsCents > 0 ? s.fullCents : null} currency={b.currency} size="xl" />
              {s.savingsCents > 0 && <p className="pb-1 font-heading font-bold text-sage-dark">Vous économisez {formatPrice(s.savingsCents, b.currency)}</p>}
            </div>
            <div className="mt-6"><AddToCartButton size="lg" label="J'ajoute ce pack au panier" item={cartItem} /></div>
            <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm font-bold text-ink/80">
              <li className="inline-flex items-center gap-1.5"><Zap className="size-4 text-honey-dark" /> Téléchargement immédiat</li>
              <li className="inline-flex items-center gap-1.5"><Printer className="size-4 text-sky-dark" /> Prêt à imprimer</li>
              <li className="inline-flex items-center gap-1.5"><Download className="size-4 text-sage-dark" /> Tous les fichiers inclus</li>
            </ul>
          </div>
          <div className="card-soft overflow-hidden p-2">
            <div className="relative aspect-[4/3] overflow-hidden rounded-[calc(var(--radius-card)-0.5rem)]">
              {b.imageUrl ? <Image src={b.imageUrl} alt={b.name} fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" priority /> : <PlaceholderArt label="Visuel du pack à venir" />}
            </div>
          </div>
        </div>
      </section>

      <section className="container-shell py-12 sm:py-16">
        <SectionHeading eyebrow="Contenu du pack" title={`${b.items.length} aventures incluses`} description="Chaque kit est livré en PDF complet, exactement comme à l'achat séparé." />
        <ul className="mb-8 grid gap-2 sm:grid-cols-2">
          {products.map((p) => (
            <li key={p.id} className="flex items-center gap-2 rounded-2xl bg-white px-4 py-3 shadow-card">
              <Check className="size-5 shrink-0 text-sage-dark" aria-hidden /><span className="font-semibold">{p.name}</span>
            </li>
          ))}
        </ul>
        <ProductGrid products={products} />
      </section>

      {b.description && (
        <section className="container-shell pb-16">
          <div className="card-soft mx-auto max-w-3xl p-6 sm:p-10"><Markdown content={b.description} /></div>
        </section>
      )}
    </div>
  );
}
