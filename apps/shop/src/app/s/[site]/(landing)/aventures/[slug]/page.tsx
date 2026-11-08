import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getProductBySlug, parseKitContents } from "@/lib/catalog";
import { getSetting } from "@/lib/settings";
import { effectivePrice } from "@/lib/pricing";
import { stripMarkdown, truncate } from "@/lib/utils";
import { getSites, siteAbsoluteUrl, siteFromParams } from "@/lib/sites";
import { JsonLd } from "@/components/storefront/json-ld";
import { TEMPLATE_ACCENTS } from "@/components/product/theme";
import { ProductTemplateRenderer } from "@/components/product/templates";
import { heroImage } from "@/components/product/sections/hero";

export const revalidate = 300;
export const dynamicParams = true;

type Params = { params: Promise<{ site: string; slug: string }> };

export async function generateStaticParams({ params }: { params: { site: string } }) {
  const site = (await getSites()).find((s) => s.slug === params.site);
  if (!site) return [];
  const rows = await prisma.product.findMany({ where: { status: "PUBLISHED", siteId: site.id }, select: { slug: true }, take: 500 });
  return rows.map((r) => ({ slug: r.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const site = await siteFromParams(params);
  const product = await getProductBySlug(site.id, slug);
  // notFound() ici garantit un statut HTTP 404 même avec le streaming (loading.tsx)
  if (!product) notFound();
  const img = product.ogImageUrl ?? heroImage(product)?.url ?? null;
  const description = product.seoDescription ?? truncate(stripMarkdown(product.shortDescription ?? product.tagline ?? product.longDescription), 160);
  const url = siteAbsoluteUrl(site, `/aventures/${product.slug}`);
  return {
    title: product.seoTitle ?? product.name,
    description,
    keywords: product.keywords.length ? product.keywords : undefined,
    alternates: { canonical: url },
    // Sans image définie, Next.js utilise automatiquement opengraph-image.tsx (image générée) : ne pas passer `images`
    openGraph: { type: "website", url, title: product.seoTitle ?? product.name, description, ...(img ? { images: [{ url: img, alt: product.name }] } : {}) },
    twitter: { card: "summary_large_image", title: product.seoTitle ?? product.name, description, ...(img ? { images: [img] } : {}) },
  };
}

export default async function ProductPage({ params }: Params) {
  const { slug } = await params;
  const site = await siteFromParams(params);
  const product = await getProductBySlug(site.id, slug);
  if (!product) notFound();

  const brand = await getSetting("brand", site);
  const price = effectivePrice(product);
  const url = siteAbsoluteUrl(site, `/aventures/${product.slug}`);
  const images = [heroImage(product)?.url, ...product.images.filter((i) => i.role !== "VIDEO").map((i) => i.url)].filter((u): u is string => !!u);
  const kit = parseKitContents(product.kitContents);

  const productLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    sku: product.id,
    description: stripMarkdown(product.seoDescription ?? product.shortDescription ?? product.tagline ?? ""),
    brand: { "@type": "Brand", name: brand.name },
    category: product.category?.name,
    ...(images.length ? { image: [...new Set(images)] } : {}),
    ...(kit.length ? { additionalProperty: kit.map((k) => ({ "@type": "PropertyValue", name: "Contenu", value: k.title })) } : {}),
    offers: {
      "@type": "Offer",
      url,
      price: (price.priceCents / 100).toFixed(2),
      priceCurrency: product.currency,
      availability: "https://schema.org/OnlineOnly",
      itemCondition: "https://schema.org/NewCondition",
      ...(price.isOnSale && product.saleEndsAt ? { priceValidUntil: product.saleEndsAt.toISOString().slice(0, 10) } : {}),
    },
    ...(product.ratingAvg != null && product.reviewCount > 0
      ? { aggregateRating: { "@type": "AggregateRating", ratingValue: product.ratingAvg.toFixed(1), reviewCount: product.reviewCount, bestRating: 5, worstRating: 1 } }
      : {}),
  };

  // Couleur d'accent de la landing : catégorie du produit, sinon couleur du modèle de fiche
  const accent = product.category?.color ?? TEMPLATE_ACCENTS[product.template];

  return (
    <div className="landing-page" style={{ "--landing-accent": accent } as React.CSSProperties}>
      <JsonLd data={productLd} />
      <ProductTemplateRenderer product={product} />
    </div>
  );
}
