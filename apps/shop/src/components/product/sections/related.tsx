import { ProductGrid } from "@/components/storefront/product-card";
import { SectionHeading } from "@/components/storefront/section-heading";
import { getRelatedProducts, type ProductPageData } from "@/lib/catalog";

export async function RelatedProducts({ product }: { product: ProductPageData }) {
  const related = await getRelatedProducts(product, 4);
  if (related.length === 0) return null;
  return (
    <section className="py-14 sm:py-20" aria-label="Produits similaires">
      <div className="container-shell">
        <SectionHeading eyebrow="Pour continuer l'aventure" title="Vous aimerez aussi" href="/boutique" linkLabel="Toute la boutique" />
        <ProductGrid products={related} />
      </div>
    </section>
  );
}
