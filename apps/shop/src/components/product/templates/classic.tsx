import type { ProductPageData } from "@/lib/catalog";
import { TemplateHead, TemplateGallery, TemplateStickyBar } from "./shared";
import { ProductStory } from "../sections/story";
import { KitContents } from "../sections/kit-contents";
import { PracticalInfo } from "../sections/practical-info";
import { SellingPoints } from "../sections/selling-points";
import { LongDescription } from "../sections/long-description";
import { ProductFaq } from "../sections/faq";
import { ProductReviews } from "../sections/reviews";
import { RelatedProducts } from "../sections/related";

/** Fiche standard. */
export function ClassicTemplate({ product }: { product: ProductPageData }) {
  return (
    <>
      <TemplateHead product={product} />
      <TemplateGallery product={product} />
      <LongDescription product={product} />
      <ProductStory product={product} />
      <KitContents product={product} />
      <PracticalInfo product={product} />
      <SellingPoints product={product} />
      <ProductFaq product={product} />
      <ProductReviews product={product} />
      <RelatedProducts product={product} />
      <TemplateStickyBar product={product} />
    </>
  );
}
