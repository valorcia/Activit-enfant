import { Markdown } from "@/components/markdown";
import type { ProductPageData } from "@/lib/catalog";

export function LongDescription({ product, title = "En détail" }: { product: ProductPageData; title?: string }) {
  if (!product.longDescription) return null;
  return (
    <section className="py-14 sm:py-20" aria-labelledby="desc-title">
      <div className="container-shell max-w-3xl">
        <h2 id="desc-title" className="font-heading text-3xl font-bold sm:text-4xl">{title}</h2>
        <Markdown content={product.longDescription} className="mt-6 text-lg" />
      </div>
    </section>
  );
}
