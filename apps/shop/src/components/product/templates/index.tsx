import type { ProductPageData } from "@/lib/catalog";
import { AdventureTemplate } from "./adventure";
import { ActivityTemplate } from "./activity";
import { StoryTemplate } from "./story";
import { EventTemplate } from "./event";
import { ClassicTemplate } from "./classic";
import { GuideTemplate, RecipesTemplate } from "./guide";

/** Sélectionne le modèle de présentation défini pour le produit dans le back-office. */
export function ProductTemplateRenderer({ product }: { product: ProductPageData }) {
  switch (product.template) {
    case "ADVENTURE": return <AdventureTemplate product={product} />;
    case "ACTIVITY": return <ActivityTemplate product={product} />;
    case "STORY": return <StoryTemplate product={product} />;
    case "EVENT": return <EventTemplate product={product} />;
    case "GUIDE": return <GuideTemplate product={product} />;
    case "RECIPES": return <RecipesTemplate product={product} />;
    default: return <ClassicTemplate product={product} />;
  }
}
