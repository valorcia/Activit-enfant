import type { ProductTemplate } from "@prisma/client";

export interface TemplateTheme {
  storyBg: string;       // classes Tailwind de fond pour la section histoire
  accentBg: string;      // fond des blobs / éléments décoratifs
  accentText: string;
  storyTitle: string;
  kitTitle: string;
  galleryTitle: string;
  sellingTitle: string;
  cta: string;
}

export const TEMPLATE_THEMES: Record<ProductTemplate, TemplateTheme> = {
  ADVENTURE: { storyBg: "bg-sky-light", accentBg: "bg-sky", accentText: "text-sky-dark", storyTitle: "L'histoire", kitTitle: "Dans votre kit d'aventure", galleryTitle: "Aperçu du kit", sellingTitle: "Pourquoi les familles adorent", cta: "Je télécharge mon aventure" },
  ACTIVITY: { storyBg: "bg-sage-light", accentBg: "bg-sage", accentText: "text-sage-dark", storyTitle: "Ce que votre enfant va apprendre", kitTitle: "Dans votre cahier", galleryTitle: "Aperçu des pages", sellingTitle: "Les bénéfices pour votre enfant", cta: "Je télécharge mes activités" },
  STORY: { storyBg: "bg-lavender-light", accentBg: "bg-lavender", accentText: "text-lavender-dark", storyTitle: "L'histoire", kitTitle: "Dans votre livre", galleryTitle: "Aperçu des pages", sellingTitle: "Pourquoi cette histoire", cta: "Je télécharge mon histoire" },
  EVENT: { storyBg: "bg-honey-light", accentBg: "bg-honey", accentText: "text-honey-dark", storyTitle: "Une fête inoubliable", kitTitle: "Dans votre kit de fête", galleryTitle: "Aperçu du kit", sellingTitle: "Pourquoi ce kit", cta: "Je télécharge mon kit" },
  CLASSIC: { storyBg: "bg-cream", accentBg: "bg-honey", accentText: "text-honey-dark", storyTitle: "Présentation", kitTitle: "Contenu du kit", galleryTitle: "Aperçu", sellingTitle: "Les points forts", cta: "Je télécharge mon aventure" },
};

export function defaultHeroBadges(ageLabel: string): string[] {
  return ["PDF immédiat", "Facile à organiser", "Prêt à imprimer", ageLabel];
}
