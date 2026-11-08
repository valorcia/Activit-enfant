import type { ProductTemplate } from "@prisma/client";
import type { SettingsKey, SettingsMap } from "@/lib/schemas/settings";

/**
 * Préréglages d'univers : thème, page d'accueil, navigation, ton, modèle de fiche
 * et catégories de départ. Ils s'appliquent entre les valeurs par défaut des
 * schémas et les surcharges propres à l'univers (Site.settings).
 */
export const PRESET_IDS = ["kit-enfants", "guide-expert", "recettes", "sciences-enfants"] as const;
export type PresetId = (typeof PRESET_IDS)[number];

type DeepPartial<T> = T extends Array<infer U> ? U[] : T extends object ? { [K in keyof T]?: DeepPartial<T[K]> } : T;
export type SettingsOverrides = { [K in SettingsKey]?: DeepPartial<SettingsMap[K]> };

export interface StarterCategory { slug: string; name: string; description: string; color: string; icon: string }

export interface PresetLabels {
  items: string;            // « aventures », « guides »…
  boutiqueTitle: string;
  boutiqueDescription: string;
  catalogSeoDescription: string;
  blogTitle: string;
  blogDescription: string;
}

export interface SitePreset {
  id: PresetId;
  labels: PresetLabels;
  label: string;
  description: string;
  defaultTemplate: ProductTemplate;
  tone: string;
  starterCategories: StarterCategory[];
  /** Réglages produits pour un univers donné (son nom sert aux textes). */
  settings(siteName: string): SettingsOverrides;
}

const commonSeo = (siteName: string, baseline: string, description: string) => ({
  defaultTitle: `${siteName} — ${baseline}`.slice(0, 70),
  titleTemplate: `%s | ${siteName}`.slice(0, 70),
  defaultDescription: description.slice(0, 170),
  ogImageUrl: null,
});

export const PRESETS: Record<PresetId, SitePreset> = {
  "kit-enfants": {
    id: "kit-enfants",
    labels: {
      items: "aventures",
      boutiqueTitle: "Toutes nos aventures à imprimer",
      boutiqueDescription: "Filtrez par âge, thème, prix ou durée pour trouver l'activité parfaite.",
      catalogSeoDescription: "Chasses au trésor, cahiers d'activités, kits d'anniversaire et histoires à imprimer pour enfants de 3 à 10 ans. Filtrez par âge, thème, prix et durée.",
      blogTitle: "Idées, conseils et inspirations pour les familles",
      blogDescription: "Des articles pour préparer vos chasses au trésor, animer un anniversaire ou occuper les enfants les jours de pluie.",
    },
    label: "Kits enfants (aquarelle)",
    description: "Chasses au trésor, jeux et activités à imprimer pour les 3–10 ans : couleurs pastel, aquarelle, ton joyeux.",
    defaultTemplate: "ADVENTURE",
    tone: "joyeux, complice, rassurant pour les parents",
    starterCategories: [
      { slug: "chasses-au-tresor", name: "Chasses au trésor", description: "Des aventures clés en main à imprimer.", color: "#FF826F", icon: "map" },
      { slug: "activites-educatives", name: "Activités éducatives", description: "Cahiers d'activités et jeux par tranche d'âge.", color: "#A8C9A1", icon: "pencil-ruler" },
      { slug: "evenements", name: "Événements", description: "Anniversaires, Noël, Pâques, Halloween.", color: "#FFD66B", icon: "party-popper" },
    ],
    // L'identité actuelle de La Malle à Jeux correspond aux valeurs par défaut des schémas
    settings: (siteName) => ({ brand: { name: siteName } }),
  },
  "guide-expert": {
    id: "guide-expert",
    labels: {
      items: "guides",
      boutiqueTitle: "Tous nos guides pratiques",
      boutiqueDescription: "Choisissez le guide qui correspond à votre problème : diagnostic, méthode et checklist inclus.",
      catalogSeoDescription: "Guides pratiques à télécharger : diagnostic, méthode pas à pas et checklists. Téléchargement immédiat en PDF.",
      blogTitle: "Conseils et méthodes",
      blogDescription: "Des articles pratiques pour comprendre, prévenir et résoudre les problèmes du quotidien.",
    },
    label: "Guide pratique expert",
    description: "Guides et e-books pratiques pour adultes (piscine, maison, jardin, vie pratique) : thème clair et rassurant, ton d'expert.",
    defaultTemplate: "GUIDE",
    tone: "expert, clair, rassurant, orienté solution",
    starterCategories: [
      { slug: "guides-pratiques", name: "Guides pratiques", description: "Des méthodes pas à pas pour régler un problème une bonne fois pour toutes.", color: "#0E7490", icon: "book-open-check" },
      { slug: "checklists", name: "Checklists & fiches", description: "Fiches mémo à imprimer et à garder sous la main.", color: "#22D3EE", icon: "list-checks" },
    ],
    settings: (siteName) => ({
      brand: { name: siteName, logoUrl: null, tagline: "Des guides clairs pour résoudre vos problèmes du quotidien" },
      theme: {
        colors: { cream: "#F8FBFC", coral: "#0E7490", honey: "#FACC15", sage: "#99F6E4", sky: "#E0F2FE", lavender: "#C7D2FE", ink: "#0F172A" },
        fonts: { heading: "Manrope", body: "Inter" },
        radius: "soft",
        texture: false,
      },
      homepage: {
        hero: {
          title: "Le problème, enfin réglé. Pas à pas.",
          subtitle: "Des guides pratiques écrits pour être appliqués tout de suite : diagnostic, solution, erreurs à éviter. Téléchargement immédiat.",
          primaryCta: { label: "Voir les guides", href: "/boutique" },
          secondaryCta: { label: "Comment ça marche", href: "#comment-ca-marche" },
          imageUrl: null,
          arguments: [
            { icon: "search-check", label: "Diagnostic en 5 minutes" },
            { icon: "list-checks", label: "Méthode pas à pas" },
            { icon: "download", label: "PDF immédiat" },
          ],
        },
        howItWorks: [
          { title: "Choisissez votre guide", description: "Chaque guide traite un problème précis, du diagnostic à la solution.", icon: "compass" },
          { title: "Téléchargez-le", description: "Le PDF arrive immédiatement par email et reste accessible à tout moment.", icon: "download" },
          { title: "Appliquez la méthode", description: "Suivez les étapes, cochez la checklist : c'est réglé.", icon: "check-circle" },
        ],
        sectionsOrder: ["hero", "funnel-offer", "how-it-works", "reviews", "guarantee", "categories", "bestsellers", "faq", "newsletter", "final-cta"],
      },
      navigation: {
        header: [
          { label: "Guides", href: "/boutique" },
          { label: "Blog", href: "/blog" },
          { label: "FAQ", href: "/faq" },
        ],
        footerText: `${siteName} : des guides pratiques clairs, testés et prêts à appliquer.`,
        footerColumns: [
          { title: "Guides", links: [{ label: "Tous les guides", href: "/boutique" }, { label: "Nouveautés", href: "/boutique?tri=nouveautes" }] },
          { title: "Aide", links: [{ label: "Retrouver mes achats", href: "/mes-achats" }, { label: "Questions fréquentes", href: "/faq" }, { label: "Contact", href: "/contact" }] },
        ],
      },
      seo: commonSeo(siteName, "Guides pratiques à télécharger", `${siteName} : des guides pratiques pas à pas pour régler vos problèmes du quotidien. Téléchargement immédiat en PDF.`),
      conversion: {
        buyNowLabel: "Télécharger le guide",
        trustBadges: [
          { icon: "lock", label: "Paiement sécurisé Stripe" },
          { icon: "download", label: "PDF immédiat" },
          { icon: "badge-check", label: "Méthode testée et expliquée" },
          { icon: "mail", label: "Accessible à vie par email" },
        ],
        faq: [
          { question: "Comment je reçois mon guide ?", answer: "Dès le paiement validé, vous recevez un email avec votre lien de téléchargement. Vous pouvez aussi retrouver vos achats à tout moment depuis la page « Retrouver mes achats »." },
          { question: "Le guide est-il adapté à mon cas ?", answer: "Chaque fiche détaille le problème traité, le sommaire et les situations couvertes : vérifiez-les avant l'achat." },
          { question: "Le paiement est-il sécurisé ?", answer: "Le paiement est traité par Stripe (carte bancaire, Apple Pay, Google Pay). Nous ne voyons ni ne stockons jamais vos données bancaires." },
        ],
        finalCta: { title: "Prêt à régler le problème pour de bon ?", text: "Téléchargez le guide maintenant et appliquez la méthode dès aujourd'hui." },
        exitPopup: { title: "Avant de partir…", text: "Recevez nos conseils pratiques gratuits chaque mois." },
        orderBump: { title: "Complétez avec un autre guide", text: "Ajoutez-le maintenant, il sera livré avec votre commande." },
      },
    }),
  },
  recettes: {
    id: "recettes",
    labels: {
      items: "livres de recettes",
      boutiqueTitle: "Tous nos livres de recettes",
      boutiqueDescription: "Des recettes simples et des menus complets, avec les listes de courses.",
      catalogSeoDescription: "Livres de recettes et menus à télécharger, avec listes de courses. Téléchargement immédiat en PDF.",
      blogTitle: "Idées recettes et astuces",
      blogDescription: "Des idées de repas, des astuces d'organisation et des recettes de saison.",
    },
    label: "Livres de recettes",
    description: "Recettes et menus à télécharger : tons chauds, titres à empattements, ton gourmand.",
    defaultTemplate: "RECIPES",
    tone: "gourmand, chaleureux, simple",
    starterCategories: [
      { slug: "recettes-du-quotidien", name: "Recettes du quotidien", description: "Des plats simples pour tous les soirs.", color: "#C2410C", icon: "chef-hat" },
      { slug: "menus-de-la-semaine", name: "Menus de la semaine", description: "Des menus complets avec liste de courses.", color: "#4D7C0F", icon: "calendar-days" },
    ],
    settings: (siteName) => ({
      brand: { name: siteName, logoUrl: null, tagline: "Des recettes simples et gourmandes à télécharger" },
      theme: {
        colors: { cream: "#FFFBF5", coral: "#C2410C", honey: "#F59E0B", sage: "#84CC16", sky: "#FDE68A", lavender: "#FBCFE8", ink: "#292524" },
        fonts: { heading: "Fraunces", body: "Nunito" },
        radius: "round",
        texture: true,
      },
      homepage: {
        hero: {
          title: "Bien manger, sans se compliquer la vie.",
          subtitle: "Des livres de recettes et des menus prêts à suivre, avec les listes de courses. Téléchargement immédiat.",
          primaryCta: { label: "Voir les livres", href: "/boutique" },
          secondaryCta: { label: "Les menus", href: "/boutique" },
          imageUrl: null,
          arguments: [
            { icon: "timer", label: "Recettes en 30 minutes" },
            { icon: "shopping-basket", label: "Listes de courses incluses" },
            { icon: "download", label: "PDF immédiat" },
          ],
        },
      },
      navigation: { header: [{ label: "Livres de recettes", href: "/boutique" }, { label: "Blog", href: "/blog" }, { label: "FAQ", href: "/faq" }], footerText: `${siteName} : des recettes simples et gourmandes à télécharger.` },
      seo: commonSeo(siteName, "Livres de recettes à télécharger", `${siteName} : livres de recettes et menus à télécharger, avec listes de courses. Téléchargement immédiat.`),
      conversion: { buyNowLabel: "Télécharger le livre", finalCta: { title: "On passe en cuisine ?", text: "Téléchargez le livre maintenant et cuisinez dès ce soir." } },
    }),
  },
  "sciences-enfants": {
    id: "sciences-enfants",
    labels: {
      items: "expériences",
      boutiqueTitle: "Toutes nos expériences à imprimer",
      boutiqueDescription: "Des expériences et défis scientifiques à faire à la maison, classés par âge et par thème.",
      catalogSeoDescription: "Kits d'expériences et de défis scientifiques à imprimer pour enfants de 5 à 10 ans. Téléchargement immédiat.",
      blogTitle: "Idées d'expériences et de défis",
      blogDescription: "Des articles pour éveiller la curiosité scientifique des enfants à la maison.",
    },
    label: "Sciences pour enfants",
    description: "Expériences et défis scientifiques à faire à la maison pour les 5–10 ans : couleurs vives, ton curieux.",
    defaultTemplate: "ACTIVITY",
    tone: "curieux, enthousiaste, pédagogique",
    starterCategories: [
      { slug: "experiences", name: "Expériences", description: "Des expériences faciles avec le matériel de la maison.", color: "#2563EB", icon: "flask-conical" },
      { slug: "defis-scientifiques", name: "Défis scientifiques", description: "Des défis pour apprendre en s'amusant.", color: "#7C3AED", icon: "rocket" },
    ],
    settings: (siteName) => ({
      brand: { name: siteName, logoUrl: null, tagline: "Des expériences scientifiques à faire à la maison" },
      theme: {
        colors: { cream: "#F8FAFF", coral: "#2563EB", honey: "#FACC15", sage: "#34D399", sky: "#BAE6FD", lavender: "#C4B5FD", ink: "#1E1B4B" },
        fonts: { heading: "Baloo 2", body: "Nunito" },
        radius: "round",
        texture: false,
      },
      homepage: {
        hero: {
          title: "Des expériences qui font « waouh » à la maison !",
          subtitle: "Des kits d'expériences et de défis scientifiques à imprimer, avec le matériel de la cuisine. Pour les 5–10 ans.",
          primaryCta: { label: "Voir les expériences", href: "/boutique" },
          secondaryCta: { label: "Comment ça marche", href: "#comment-ca-marche" },
          imageUrl: null,
          arguments: [
            { icon: "flask-conical", label: "Matériel de la maison" },
            { icon: "shield-check", label: "Expériences sans danger" },
            { icon: "download", label: "PDF immédiat" },
          ],
        },
      },
      navigation: { header: [{ label: "Expériences", href: "/boutique" }, { label: "Blog", href: "/blog" }, { label: "FAQ", href: "/faq" }], footerText: `${siteName} : des expériences scientifiques à faire en famille.` },
      seo: commonSeo(siteName, "Expériences scientifiques pour enfants", `${siteName} : kits d'expériences et de défis scientifiques à imprimer pour les 5–10 ans. Téléchargement immédiat.`),
      conversion: { buyNowLabel: "Télécharger le kit" },
    }),
  },
};

export function getPreset(id: string | null | undefined): SitePreset {
  return PRESETS[(id ?? "kit-enfants") as PresetId] ?? PRESETS["kit-enfants"];
}

/** Fusion profonde d'objets simples (les tableaux et valeurs scalaires remplacent). */
export function deepMerge<T>(base: T, override: unknown): T {
  if (override === undefined) return base;
  if (override === null) return null as T;
  if (Array.isArray(base) || Array.isArray(override) || typeof base !== "object" || base === null || typeof override !== "object") {
    return override as T;
  }
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(override as Record<string, unknown>)) {
    if (v === undefined) continue;
    out[k] = k in out ? deepMerge(out[k], v) : v;
  }
  return out as T;
}
