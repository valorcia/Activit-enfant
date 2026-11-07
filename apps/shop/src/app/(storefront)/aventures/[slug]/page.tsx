import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getProductBySlug, parseKitContents } from "@/lib/catalog";
import { getSetting } from "@/lib/settings";
import { effectivePrice } from "@/lib/pricing";
import { absoluteUrl, stripMarkdown, truncate } from "@/lib/utils";
import { JsonLd } from "@/components/storefront/json-ld";
import { ProductTemplateRenderer } from "@/components/product/templates";
import { heroImage } from "@/components/product/sections/hero";

export const revalidate = 300;
export const dynamicParams = true;

type Params = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  const rows = await prisma.product.findMany({ where: { status: "PUBLISHED" }, select: { slug: true }, take: 500 });
  return rows.map((r) => ({ slug: r.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  // notFound() ici garantit un statut HTTP 404 même avec le streaming (loading.tsx)
  if (!product) notFound();
  const img = product.ogImageUrl ?? heroImage(product)?.url ?? null;
  const description = product.seoDescription ?? truncate(stripMarkdown(product.shortDescription ?? product.tagline ?? product.longDescription), 160);
  const url = absoluteUrl(`/aventures/${product.slug}`);
  return {
    title: product.seoTitle ?? product.name,
    description,
    keywords: product.keywords.length ? product.keywords : undefined,
    alternates: { canonical: url },
    openGraph: { type: "website", url, title: product.seoTitle ?? product.name, description, images: img ? [{ url: img, alt: product.name }] : undefined },
    twitter: { card: img ? "summary_large_image" : "summary", title: product.seoTitle ?? product.name, description, images: img ? [img] : undefined },
  };
}

export default async function ProductPage({ params }: Params) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const brand = await getSetting("brand");
  const price = effectivePrice(product);
  const url = absoluteUrl(`/aventures/${product.slug}`);
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

  return (
    <>
      <JsonLd data={productLd} />
      <ProductTemplateRenderer product={product} />
    </>
  );
}
