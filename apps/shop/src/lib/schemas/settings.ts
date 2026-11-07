import { z } from "zod";

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Couleur hexadécimale attendue");

export const brandSettingsSchema = z.object({
  name: z.string().min(1).max(60).default("Capitaine Coquelicot"),
  tagline: z.string().max(160).default("Des aventures extraordinaires à vivre à la maison"),
  logoUrl: z.string().max(500).optional().nullable(),
  logoText: z.string().max(40).optional().nullable(),
  faviconUrl: z.string().max(500).optional().nullable(),
  contactEmail: z.string().max(120).optional().nullable(),
  legalName: z.string().max(160).optional().nullable(),
  legalAddress: z.string().max(400).optional().nullable(),
  vatNumber: z.string().max(40).optional().nullable(),
});
export type BrandSettings = z.infer<typeof brandSettingsSchema>;

export const themeSettingsSchema = z.object({
  colors: z.object({
    cream: hex.default("#FFF9F0"),
    coral: hex.default("#FF826F"),
    honey: hex.default("#FFD66B"),
    sage: hex.default("#A8C9A1"),
    sky: hex.default("#A9D8F5"),
    lavender: hex.default("#C8B6E8"),
    ink: hex.default("#293241"),
  }).default({
    cream: "#FFF9F0", coral: "#FF826F", honey: "#FFD66B", sage: "#A8C9A1", sky: "#A9D8F5", lavender: "#C8B6E8", ink: "#293241",
  }),
  fonts: z.object({
    heading: z.enum(["Fredoka", "Baloo 2", "Nunito", "Quicksand", "Comfortaa"]).default("Fredoka"),
    body: z.enum(["Nunito", "Quicksand", "Inter", "Mulish", "Poppins"]).default("Nunito"),
  }).default({ heading: "Fredoka", body: "Nunito" }),
  radius: z.enum(["soft", "round", "pill"]).default("round"),
  texture: z.boolean().default(true),
});
export type ThemeSettings = z.infer<typeof themeSettingsSchema>;

export const homepageSectionSchema = z.enum([
  "hero", "categories", "bestsellers", "how-it-works", "new", "bundles", "reviews", "newsletter", "blog",
]);
export type HomepageSection = z.infer<typeof homepageSectionSchema>;

export const homepageSettingsSchema = z.object({
  hero: z.object({
    title: z.string().max(120).default("Des aventures extraordinaires à vivre à la maison !"),
    subtitle: z.string().max(300).default("Découvrez nos chasses au trésor, jeux et activités à imprimer pour transformer chaque moment en famille en aventure inoubliable."),
    primaryCta: z.object({ label: z.string().max(40).default("Découvrir les aventures"), href: z.string().max(200).default("/boutique?categorie=chasses-au-tresor") }).default({ label: "Découvrir les aventures", href: "/boutique?categorie=chasses-au-tresor" }),
    secondaryCta: z.object({ label: z.string().max(40).default("Explorer les activités"), href: z.string().max(200).default("/boutique") }).default({ label: "Explorer les activités", href: "/boutique" }),
    imageUrl: z.string().max(500).optional().nullable(),
    arguments: z.array(z.object({ icon: z.string().max(40), label: z.string().max(60) })).max(4).default([
      { icon: "download", label: "Téléchargement immédiat" },
      { icon: "printer", label: "Prêt à imprimer" },
      { icon: "heart", label: "Des heures de plaisir en famille" },
    ]),
  }).default({
    title: "Des aventures extraordinaires à vivre à la maison !",
    subtitle: "Découvrez nos chasses au trésor, jeux et activités à imprimer pour transformer chaque moment en famille en aventure inoubliable.",
    primaryCta: { label: "Découvrir les aventures", href: "/boutique?categorie=chasses-au-tresor" },
    secondaryCta: { label: "Explorer les activités", href: "/boutique" },
    imageUrl: null,
    arguments: [
      { icon: "download", label: "Téléchargement immédiat" },
      { icon: "printer", label: "Prêt à imprimer" },
      { icon: "heart", label: "Des heures de plaisir en famille" },
    ],
  }),
  sectionsOrder: z.array(homepageSectionSchema).default([
    "hero", "categories", "bestsellers", "how-it-works", "new", "bundles", "reviews", "newsletter",
  ]),
  featuredProductIds: z.array(z.string()).default([]),
  howItWorks: z.array(z.object({ title: z.string().max(80), description: z.string().max(240), icon: z.string().max(40) })).max(5).default([
    { title: "Choisissez votre aventure", description: "Parcourez nos kits par âge, thème ou occasion et trouvez celui qui fera briller les yeux de vos enfants.", icon: "compass" },
    { title: "Téléchargez votre kit", description: "Dès le paiement validé, votre PDF est disponible immédiatement dans votre boîte mail.", icon: "download" },
    { title: "Imprimez et amusez-vous", description: "Quelques feuilles, une paire de ciseaux, et l'aventure commence à la maison !", icon: "printer" },
  ]),
  banner: z.object({
    enabled: z.boolean().default(false),
    text: z.string().max(160).default(""),
    href: z.string().max(200).optional().nullable(),
    color: z.enum(["coral", "honey", "sage", "sky", "lavender"]).default("honey"),
  }).default({ enabled: false, text: "", href: null, color: "honey" }),
});
export type HomepageSettings = z.infer<typeof homepageSettingsSchema>;

export const navLinkSchema = z.object({ label: z.string().max(40), href: z.string().max(200) });
export const navigationSettingsSchema = z.object({
  header: z.array(navLinkSchema).max(8).default([
    { label: "Boutique", href: "/boutique" },
    { label: "Chasses au trésor", href: "/categories/chasses-au-tresor" },
    { label: "Activités", href: "/categories/activites-educatives" },
    { label: "Packs", href: "/packs" },
    { label: "Blog", href: "/blog" },
  ]),
  footerColumns: z.array(z.object({ title: z.string().max(40), links: z.array(navLinkSchema).max(8) })).max(4).default([
    { title: "Boutique", links: [
      { label: "Toutes les aventures", href: "/boutique" },
      { label: "Packs & offres", href: "/packs" },
      { label: "Nouveautés", href: "/boutique?tri=nouveautes" },
    ] },
    { title: "Aide", links: [
      { label: "Retrouver mes achats", href: "/mes-achats" },
      { label: "Questions fréquentes", href: "/faq" },
      { label: "Contact", href: "/contact" },
    ] },
  ]),
  footerText: z.string().max(400).default("Des kits d'activités à imprimer, imaginés avec amour pour les familles."),
  social: z.object({
    instagram: z.string().max(200).optional().nullable(),
    facebook: z.string().max(200).optional().nullable(),
    pinterest: z.string().max(200).optional().nullable(),
    tiktok: z.string().max(200).optional().nullable(),
    youtube: z.string().max(200).optional().nullable(),
  }).default({}),
});
export type NavigationSettings = z.infer<typeof navigationSettingsSchema>;

export const analyticsSettingsSchema = z.object({
  gaMeasurementId: z.string().max(40).optional().nullable(),
  metaPixelId: z.string().max(40).optional().nullable(),
  googleAdsId: z.string().max(40).optional().nullable(),
  pinterestTagId: z.string().max(40).optional().nullable(),
  consentBannerEnabled: z.boolean().default(true),
});
export type AnalyticsSettings = z.infer<typeof analyticsSettingsSchema>;

export const commerceSettingsSchema = z.object({
  currency: z.string().length(3).default("EUR"),
  defaultTaxRateBp: z.number().int().min(0).max(10000).default(2000),
  pricesIncludeTax: z.boolean().default(true),
  allowStripePromotionCodes: z.boolean().default(true),
  collectTermsConsent: z.boolean().default(false), // case CGV dans Stripe Checkout (URL des CGV requise côté Stripe)
  downloadMaxPerEntitlement: z.number().int().min(1).max(1000).default(50),
  downloadLinkValidityHours: z.number().int().min(1).max(24 * 365).default(72),
  abandonedCartDelayMinutes: z.number().int().min(30).max(60 * 24 * 7).default(120),
  abandonedCartEmailsEnabled: z.boolean().default(false),
  invoicePrefix: z.string().max(10).default("FAC"),
  orderPrefix: z.string().max(10).default("CC"),
  withdrawalNotice: z.string().max(600).default(
    "En validant ma commande, je demande expressément l'exécution immédiate de la fourniture du contenu numérique et je reconnais perdre mon droit de rétractation dès le téléchargement (article L221-28 du Code de la consommation).",
  ),
});
export type CommerceSettings = z.infer<typeof commerceSettingsSchema>;

export const seoSettingsSchema = z.object({
  defaultTitle: z.string().max(70).default("Capitaine Coquelicot — Chasses au trésor et activités à imprimer"),
  titleTemplate: z.string().max(70).default("%s | Capitaine Coquelicot"),
  defaultDescription: z.string().max(170).default("Chasses au trésor, cahiers d'activités, kits d'anniversaire et histoires à imprimer pour les enfants de 3 à 12 ans. Téléchargement immédiat."),
  ogImageUrl: z.string().max(500).optional().nullable(),
  robotsIndex: z.boolean().default(true),
});
export type SeoSettings = z.infer<typeof seoSettingsSchema>;

export const settingsSchemas = {
  brand: brandSettingsSchema,
  theme: themeSettingsSchema,
  homepage: homepageSettingsSchema,
  navigation: navigationSettingsSchema,
  analytics: analyticsSettingsSchema,
  commerce: commerceSettingsSchema,
  seo: seoSettingsSchema,
} as const;

export type SettingsKey = keyof typeof settingsSchemas;
export type SettingsMap = { [K in SettingsKey]: z.infer<(typeof settingsSchemas)[K]> };
