/**
 * Préréglages d'univers (alignés sur ceux de la boutique : kit-enfants, guide-expert,
 * recettes, sciences-enfants). Un préréglage fixe la charte d'illustration par défaut,
 * le ton rédactionnel, la persona de l'auteur (prompt système), le thème de mise en page
 * PDF et les types d'e-books autorisés.
 */
export const UNIVERSE_PRESETS = ["kit-enfants", "guide-expert", "recettes", "sciences-enfants"] as const;
export type UniversePreset = (typeof UNIVERSE_PRESETS)[number];

export interface PresetDef {
  key: UniversePreset;
  label: string;
  description: string;
  /** Public visé (affiché dans l'interface) */
  audience: string;
  /** Charte d'illustration par défaut (ajoutée à tous les prompts d'images) */
  charter: string;
  /** Ton rédactionnel par défaut */
  tone: string;
  /** Persona de l'auteur (prompt système des rédactions) */
  system: string;
  /** Thème de mise en page PDF (clé de BUILTIN_TEMPLATES) */
  themeKey: string;
  /** Style artistique enregistré sur le livre */
  artStyle: string;
  /** Éléments à proscrire dans les images */
  negative: string;
}

export const KIDS_CHARTER =
  "Style : illustration jeunesse à l'aquarelle, contours fins et doux, couleurs chaudes et lumineuses (crème #FFF9F0, corail, jaune miel, vert sauge, bleu ciel), grain de papier léger, lumière douce, aucune ombre dure. Personnages expressifs, visages ronds et souriants, proportions enfantines (grosse tête, grands yeux), aucun texte dans l'image sauf demande explicite. Cadrage lisible pour une impression A4, marges propres, fond uni crème ou décor simple. Pas de style 3D, pas de photo-réalisme, pas de logo.";

export const PRESETS: Record<UniversePreset, PresetDef> = {
  "kit-enfants": {
    key: "kit-enfants",
    label: "Kit enfants",
    description: "Jeux, chasses au trésor, kits d'événements et histoires pour les 3–10 ans.",
    audience: "Parents d'enfants de 3 à 10 ans",
    charter: KIDS_CHARTER,
    tone: "Joyeux et complice",
    system:
      "Tu es auteur de jeux pour enfants et directeur éditorial d'une marque de kits d'activités à imprimer (PDF A4). Tu écris en français, pour des parents qui organisent l'activité à la maison ou au jardin, sans achat spécial. Ton chaleureux, vocabulaire simple, humour gentil, jamais effrayant. Aucune marque ni personnage sous licence. Aucune invention commerciale (pas de chiffres de ventes, pas d'avis). Tu réponds uniquement avec un JSON strictement conforme au schéma demandé.",
    themeKey: "malle",
    artStyle: "aquarelle",
    negative: "texte, lettres, logo, filigrane, photo-réalisme, 3D, éléments effrayants",
  },
  "guide-expert": {
    key: "guide-expert",
    label: "Guide expert",
    description: "Guides pratiques pour adultes : problème, causes, diagnostic, méthode pas à pas, checklists.",
    audience: "Adultes qui veulent résoudre un problème concret (maison, jardin, piscine, vie pratique)",
    charter:
      "Style : illustrations éditoriales propres et pédagogiques, à plat (flat design) ou trait fin légèrement texturé, schémas clairs avec flèches et repères numérotés, palette de bleus d'eau (bleu profond #1E4E79, turquoise #2BA6A4, bleu ciel #CFE8F3) avec accents sable et blanc, beaucoup d'espace blanc, composition simple et lisible à l'impression A4. Aucun texte ni chiffre dans l'image (les légendes sont ajoutées dans la mise en page). Pas de rendu photographique, pas de photo-réalisme, pas de 3D brillante, pas de logo ni de marque de produit.",
    tone: "Clair, rassurant et précis",
    system:
      "Tu es un expert pédagogue qui écrit des guides pratiques à imprimer (PDF A4) pour des adultes. Tu écris en français, avec des phrases courtes, un vocabulaire précis expliqué simplement, des étapes actionnables et des mises en garde de sécurité quand c'est utile. Tu ne fais jamais de promesse irréaliste (pas de « garanti », pas de résultat chiffré invérifiable), tu n'inventes ni avis, ni chiffres de vente, ni statistiques, ni normes. Tu ne cites aucune marque commerciale. Quand une manipulation présente un risque (produits chimiques, électricité, hauteur), tu indiques les précautions et tu recommandes de lire l'étiquette du fabricant et de demander l'avis d'un professionnel en cas de doute. Tu réponds uniquement avec un JSON strictement conforme au schéma demandé.",
    themeKey: "expert",
    artStyle: "vectoriel",
    negative: "texte, chiffres, logo, marque, filigrane, photo-réalisme, rendu photographique, 3D brillante",
  },
  recettes: {
    key: "recettes",
    label: "Recettes",
    description: "Livres de recettes et cuisine du quotidien, en famille ou entre adultes.",
    audience: "Cuisiniers du quotidien, familles",
    charter:
      "Style : illustration culinaire chaleureuse à l'aquarelle gourmande, couleurs appétissantes (tomate, basilic, miel, crème, terracotta), traits fins à l'encre, lumière douce de cuisine, plats généreux vus de trois quarts ou du dessus, ustensiles simples, fond papier crème. Aucun texte dans l'image. Pas de photo-réalisme, pas de 3D, pas de logo ni d'emballage de marque.",
    tone: "Gourmand, simple et encourageant",
    system:
      "Tu es auteur de livres de cuisine pratiques, à imprimer (PDF A4). Tu écris en français, avec des recettes testables : quantités précises, étapes courtes et numérotées, temps réalistes, astuces utiles. Tu signales les allergènes courants et les règles d'hygiène et de sécurité (cuisson des viandes, couteaux, four) quand c'est pertinent. Aucune marque commerciale, aucune allégation santé non prouvée, aucun faux avis ni faux chiffre. Tu réponds uniquement avec un JSON strictement conforme au schéma demandé.",
    themeKey: "recettes",
    artStyle: "aquarelle",
    negative: "texte, lettres, logo, emballage de marque, filigrane, photo-réalisme, 3D",
  },
  "sciences-enfants": {
    key: "sciences-enfants",
    label: "Sciences enfants",
    description: "Expériences et fiches de sciences ludiques pour les 5–12 ans.",
    audience: "Parents et enseignants d'enfants de 5 à 12 ans",
    charter:
      "Style : illustration jeunesse vive et ludique, couleurs franches et joyeuses (bleu électrique, jaune soleil, vert pomme, orange, violet), contours nets, petits personnages scientifiques expressifs, schémas simples de l'expérience (matériel, étapes) très lisibles, fond clair. Aucun texte dans l'image. Pas de photo-réalisme, pas de 3D, pas de logo.",
    tone: "Curieux, enthousiaste et clair",
    system:
      "Tu es auteur de fiches d'expériences scientifiques pour enfants, à imprimer (PDF A4). Tu écris en français, avec un vocabulaire adapté à l'âge, une question de départ, du matériel courant, des étapes numérotées, une explication scientifique juste et simple, et des consignes de sécurité adaptées (présence d'un adulte, pas de produits dangereux, pas de flamme sans adulte). Aucune marque ni personnage sous licence, aucune invention commerciale. Tu réponds uniquement avec un JSON strictement conforme au schéma demandé.",
    themeKey: "labo",
    artStyle: "vectoriel",
    negative: "texte, lettres, logo, filigrane, photo-réalisme, 3D, produits dangereux",
  },
};

export function preset(key: string | null | undefined): PresetDef {
  return PRESETS[(UNIVERSE_PRESETS as readonly string[]).includes(key ?? "") ? (key as UniversePreset) : "kit-enfants"];
}

export function isPreset(key: unknown): key is UniversePreset {
  return typeof key === "string" && (UNIVERSE_PRESETS as readonly string[]).includes(key);
}

/** Charte d'illustration effective d'un préréglage (surcharge des paramètres, sinon défaut). */
export function charterFor(p: UniversePreset, overrides: Partial<Record<string, string>> | undefined, legacyKidsCharter?: string): string {
  const o = overrides?.[p]?.trim();
  if (o) return o;
  if (p === "kit-enfants" && legacyKidsCharter?.trim()) return legacyKidsCharter;
  return PRESETS[p].charter;
}
