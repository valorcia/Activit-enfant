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

/** Histoire illustrée / e-book : l'histoire puis l'aperçu des pages. */
export function StoryTemplate({ product }: { product: ProductPageData }) {
  return (
    <>
      <TemplateHead product={product} />
      <ProductStory product={product} />
      <TemplateGallery product={product} />
      <LongDescription product={product} title="À propos de ce livre" />
      <KitContents product={product} />
      <SellingPoints product={product} />
      <PracticalInfo product={product} />
      <ProductFaq product={product} />
      <ProductReviews product={product} />
      <RelatedProducts product={product} />
      <TemplateStickyBar product={product} />
    </>
  );
}
