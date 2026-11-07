import type { ProductPageData } from "@/lib/catalog";
import { TemplateHead, TemplateGallery, TemplateStickyBar } from "./shared";
import { ProductStory } from "../sections/story";
import { KitContents } from "../sections/kit-contents";
import { PracticalInfo } from "../sections/practical-info";
import { SellingPoints } from "../sections/selling-points";
import { LongDescription } from "../sections/long-description";
import { ProductFaq } from "../sections/faq";
import { WhatYouGet } from "../sections/what-you-get";
import { GuaranteeBlock } from "../sections/guarantee";
import { OfferRecap } from "../sections/offer-recap";
import { ProductReviews } from "../sections/reviews";
import { RelatedProducts } from "../sections/related";

/** Fiche standard. */
export function ClassicTemplate({ product }: { product: ProductPageData }) {
  return (
    <>
      <TemplateHead product={product} />
      <WhatYouGet product={product} />
      <TemplateGallery product={product} />
      <LongDescription product={product} />
      <ProductStory product={product} />
      <KitContents product={product} />
      <GuaranteeBlock />
      <PracticalInfo product={product} />
      <SellingPoints product={product} />
      <OfferRecap product={product} />
      <ProductFaq product={product} />
      <ProductReviews product={product} />
      <RelatedProducts product={product} />
      <TemplateStickyBar product={product} />
    </>
  );
}
