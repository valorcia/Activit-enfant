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

/** Chasse au trésor / aventure immersive : histoire en premier, puis le kit. */
export function AdventureTemplate({ product }: { product: ProductPageData }) {
  return (
    <>
      <TemplateHead product={product} />
      <ProductStory product={product} />
      <KitContents product={product} />
      <TemplateGallery product={product} />
      <PracticalInfo product={product} />
      <SellingPoints product={product} />
      <LongDescription product={product} title="Comment se déroule l'aventure" />
      <ProductFaq product={product} />
      <ProductReviews product={product} />
      <RelatedProducts product={product} />
      <TemplateStickyBar product={product} />
    </>
  );
}
