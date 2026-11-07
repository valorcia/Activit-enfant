import { ProductHero, heroImage } from "../sections/hero";
import { ProductGallery, type GalleryMedia } from "../sections/gallery";
import { ShareButtons } from "../sections/share";
import { StickyBuyBar } from "../sections/sticky-buy-bar";
import { ViewTracker } from "../view-tracker";
import { Breadcrumbs } from "@/components/storefront/breadcrumbs";
import type { ProductPageData } from "@/lib/catalog";
import { effectivePrice } from "@/lib/pricing";
import { absoluteUrl } from "@/lib/utils";
import { TEMPLATE_THEMES } from "../theme";

export function galleryMedia(product: ProductPageData): GalleryMedia[] {
  return product.images
    .filter((i) => i.role === "GALLERY" || i.role === "MOCKUP" || i.role === "PDF_PREVIEW" || i.role === "VIDEO")
    .map((i) => ({ id: i.id, url: i.url, alt: i.alt, role: i.role }));
}

/** En-tête commun : fil d'Ariane + hero + partage. */
export function TemplateHead({ product }: { product: ProductPageData }) {
  const img = heroImage(product);
  return (
    <>
      <ViewTracker productId={product.id} name={product.name} priceCents={effectivePrice(product).priceCents} currency={product.currency} />
      <div className="container-shell pt-5">
        <Breadcrumbs items={[...(product.category ? [{ label: product.category.name, href: `/categories/${product.category.slug}` }] : [{ label: "Boutique", href: "/boutique" }]), { label: product.name }]} />
      </div>
      <ProductHero product={product} />
      <div className="container-shell -mt-2 pb-4">
        <ShareButtons url={absoluteUrl(`/aventures/${product.slug}`)} title={product.name} imageUrl={img?.url} />
      </div>
    </>
  );
}

export function TemplateGallery({ product }: { product: ProductPageData }) {
  return <ProductGallery media={galleryMedia(product)} productName={product.name} universe={product.universe} title={TEMPLATE_THEMES[product.template].galleryTitle} />;
}

export function TemplateStickyBar({ product }: { product: ProductPageData }) {
  const price = effectivePrice(product);
  const img = heroImage(product);
  return (
    <StickyBuyBar
      item={{ kind: "product", id: product.id, slug: product.slug, name: product.name, imageUrl: img?.url ?? null, unitPriceCents: price.priceCents, compareAtCents: price.compareAtCents, currency: product.currency }}
    />
  );
}
