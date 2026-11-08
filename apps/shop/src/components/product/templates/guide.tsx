import type { ProductPageData } from "@/lib/catalog";
import { TemplateHead, TemplateGallery, TemplateStickyBar } from "./shared";
import { ProductStory } from "../sections/story";
import { KitContents } from "../sections/kit-contents";
import { SellingPoints } from "../sections/selling-points";
import { LongDescription } from "../sections/long-description";
import { ProductFaq } from "../sections/faq";
import { WhatYouGet } from "../sections/what-you-get";
import { GuaranteeBlock } from "../sections/guarantee";
import { OfferRecap } from "../sections/offer-recap";
import { ProductReviews } from "../sections/reviews";
import { RelatedProducts } from "../sections/related";

/**
 * Guide pratique / e-book expert : problème → ce que vous allez apprendre →
 * sommaire → extraits → méthode et expertise → garanties → offre.
 */
export function GuideTemplate({ product }: { product: ProductPageData }) {
  return (
    <div className="guide-template">
      <TemplateHead product={product} />
      <WhatYouGet product={product} />
      <ProductStory product={product} title="Le problème" />
      <SellingPoints product={product} title="Ce que vous allez apprendre" />
      <KitContents product={product} title="Sommaire du guide" />
      <TemplateGallery product={product} />
      <LongDescription product={product} title="La méthode et l'expertise" />
      <GuaranteeBlock siteId={product.siteId} />
      <OfferRecap product={product} />
      <ProductFaq product={product} />
      <ProductReviews product={product} />
      <RelatedProducts product={product} />
      <TemplateStickyBar product={product} />
    </div>
  );
}

/** Livre de recettes : l'esprit du livre → sommaire → recettes en aperçu → bénéfices → offre. */
export function RecipesTemplate({ product }: { product: ProductPageData }) {
  return (
    <>
      <TemplateHead product={product} />
      <WhatYouGet product={product} />
      <ProductStory product={product} title="L'esprit du livre" />
      <KitContents product={product} title="Au sommaire" />
      <TemplateGallery product={product} />
      <SellingPoints product={product} title="Pourquoi vous allez l'adorer" />
      <LongDescription product={product} title="En cuisine" />
      <GuaranteeBlock siteId={product.siteId} />
      <OfferRecap product={product} />
      <ProductFaq product={product} />
      <ProductReviews product={product} />
      <RelatedProducts product={product} />
      <TemplateStickyBar product={product} />
    </>
  );
}
