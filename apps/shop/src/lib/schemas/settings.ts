import { z } from "zod";

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Couleur hexadécimale attendue");

export const brandSettingsSchema = z.object({
  name: z.string().min(1).max(60).default("La Malle à Jeux"),
  tagline: z.string().max(160).default("Des aventures extraordinaires à vivre à la maison"),
  logoUrl: z.string().max(500).optional().nullable().default("/images/brand/logo-la-malle-a-jeux.webp"),
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
    heading: z.enum(["Fredoka", "Baloo 2", "Nunito", "Quicksand", "Comfortaa", "Manrope", "Fraunces", "Inter"]).default("Fredoka"),
    body: z.enum(["Nunito", "Quicksand", "Inter", "Mulish", "Poppins", "Manrope"]).default("Nunito"),
  }).default({ heading: "Fredoka", body: "Nunito" }),
  radius: z.enum(["soft", "round", "pill"]).default("round"),
  texture: z.boolean().default(true),
});
export type ThemeSettings = z.infer<typeof themeSettingsSchema>;

export const homepageSectionSchema = z.enum([
  "hero", "funnel-offer", "categories", "bestsellers", "how-it-works", "new", "bundles", "reviews", "guarantee", "faq", "newsletter", "blog", "final-cta",
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
    "hero", "funnel-offer", "how-it-works", "reviews", "guarantee", "categories", "bestsellers", "faq", "bundles", "newsletter", "final-cta",
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
  // Envoi serveur des conversions (jetons masqués dans l'admin, jamais exposés côté client)
  metaCapiToken: z.string().max(400).optional().nullable(),
  tiktokPixelId: z.string().max(60).optional().nullable(),
  tiktokEventsToken: z.string().max(400).optional().nullable(),
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
  defaultTitle: z.string().max(70).default("La Malle à Jeux — Chasses au trésor et activités à imprimer"),
  titleTemplate: z.string().max(70).default("%s | La Malle à Jeux"),
  defaultDescription: z.string().max(170).default("Chasses au trésor, cahiers d'activités, kits d'anniversaire et histoires à imprimer pour les enfants de 3 à 10 ans. Téléchargement immédiat."),
  ogImageUrl: z.string().max(500).optional().nullable().default("/images/brand/banniere-la-malle-a-jeux.webp"),
  robotsIndex: z.boolean().default(true),
  /** Vérification du domaine de l'univers : Meta Business (facebook-domain-verification) et Google Search Console. */
  facebookDomainVerification: z.string().max(100).optional().nullable(),
  googleSiteVerification: z.string().max(100).optional().nullable(),
});
export type SeoSettings = z.infer<typeof seoSettingsSchema>;

/** Leviers de conversion (tunnel de vente). Tout est configurable depuis Admin → Apparence → Conversion. */
export const conversionSettingsSchema = z.object({
  heroMode: z.enum(["funnel", "catalogue"]).default("funnel"), // funnel : accueil centré sur le produit phare
  flagshipProductId: z.string().optional().nullable(), // sinon : premier produit mis en avant, sinon meilleure vente
  buyNowLabel: z.string().max(40).default("Acheter maintenant"),
  trustBadges: z.array(z.object({ icon: z.string().max(40), label: z.string().max(60) })).max(6).default([
    { icon: "lock", label: "Paiement sécurisé Stripe" },
    { icon: "download", label: "Téléchargement immédiat" },
    { icon: "printer", label: "Imprimable autant de fois que vous voulez" },
    { icon: "mail", label: "Fichiers renvoyés par email à tout moment" },
  ]),
  guarantee: z.object({
    enabled: z.boolean().default(false),
    title: z.string().max(80).default("Satisfait ou remboursé pendant 14 jours"),
    text: z.string().max(600).default("Si l'aventure ne plaît pas à vos enfants, écrivez-nous : nous vous remboursons intégralement, sans question."),
    icon: z.string().max(40).default("shield-check"),
  }).default({ enabled: false, title: "Satisfait ou remboursé pendant 14 jours", text: "Si l'aventure ne plaît pas à vos enfants, écrivez-nous : nous vous remboursons intégralement, sans question.", icon: "shield-check" }),
  urgency: z.object({
    enabled: z.boolean().default(false),
    text: z.string().max(160).default(""),
  }).default({ enabled: false, text: "" }),
  orderBump: z.object({
    enabled: z.boolean().default(true),
    productId: z.string().optional().nullable(), // sinon : produit recommandé / meilleure vente non présente dans le panier
    title: z.string().max(80).default("Envie d'une deuxième aventure ?"),
    text: z.string().max(200).default("Ajoutez-la maintenant, elle sera livrée avec votre commande."),
  }).default({ enabled: true, productId: null, title: "Envie d'une deuxième aventure ?", text: "Ajoutez-la maintenant, elle sera livrée avec votre commande." }),
  exitPopup: z.object({
    enabled: z.boolean().default(false),
    title: z.string().max(80).default("Attendez, un cadeau avant de partir !"),
    text: z.string().max(300).default("Inscrivez-vous et recevez nos idées d'activités gratuites chaque mois."),
    couponCode: z.string().max(40).optional().nullable(),
    delaySeconds: z.number().int().min(5).max(300).default(25),
  }).default({ enabled: false, title: "Attendez, un cadeau avant de partir !", text: "Inscrivez-vous et recevez nos idées d'activités gratuites chaque mois.", couponCode: null, delaySeconds: 25 }),
  faq: z.array(z.object({ question: z.string().max(200), answer: z.string().max(1000) })).max(12).default([
    { question: "Comment je reçois mon kit ?", answer: "Dès le paiement validé, vous recevez un email avec vos liens de téléchargement. Vous pouvez aussi retrouver vos achats à tout moment depuis la page « Retrouver mes achats »." },
    { question: "Faut-il du matériel particulier ?", answer: "Une imprimante (couleur ou noir et blanc), du papier et une paire de ciseaux suffisent dans la plupart des cas. Le matériel précis est indiqué sur chaque fiche." },
    { question: "Puis-je réutiliser le kit ?", answer: "Oui : le fichier est à vous, vous pouvez l'imprimer autant de fois que vous le souhaitez pour un usage familial." },
    { question: "Le paiement est-il sécurisé ?", answer: "Le paiement est traité par Stripe (carte bancaire, Apple Pay, Google Pay). Nous ne voyons ni ne stockons jamais vos données bancaires." },
  ]),
  finalCta: z.object({
    title: z.string().max(120).default("Prêts à vivre une aventure inoubliable ?"),
    text: z.string().max(240).default("Téléchargez votre kit en 2 minutes et lancez l'aventure dès aujourd'hui."),
  }).default({ title: "Prêts à vivre une aventure inoubliable ?", text: "Téléchargez votre kit en 2 minutes et lancez l'aventure dès aujourd'hui." }),
});
export type ConversionSettings = z.infer<typeof conversionSettingsSchema>;

export const settingsSchemas = {
  conversion: conversionSettingsSchema,
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
