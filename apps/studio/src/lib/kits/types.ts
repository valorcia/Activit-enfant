import type { KitContentFormat } from "./schemas";
import type { UniversePreset } from "../universes/presets";

/**
 * Référentiel des types de kits, aligné sur le catalogue de la boutique.
 *
 * - family « kit » : contenu structuré (Book.kitContent) rendu par les gabarits de src/lib/kits/pages.ts.
 * - family « activites » : livre d'activités historique (fiches, étapes illustrées), conservé tel quel.
 */

/** Slug de catégorie boutique (les catégories dépendent de l'univers ciblé). */
export type ShopCategorySlug = string;
export type ShopTemplate = "ADVENTURE" | "ACTIVITY" | "STORY" | "EVENT" | "CLASSIC" | "GUIDE" | "RECIPES";

export interface KitSection {
  key: string;
  label: string;
  /** Nombre d'éléments (ex. 10 énigmes) — null si section unique */
  count?: number | null;
  /** Pages approximatives occupées */
  pages: number;
  icon: string;
}

export interface KitTypeDef {
  key: string;
  label: string;
  description: string;
  icon: string; // nom d'icône lucide
  family: "kit" | "activites";
  /** Format du contenu structuré (kits seulement) */
  format?: KitContentFormat;
  shopCategory: ShopCategorySlug;
  template: ShopTemplate;
  defaultAge: string;
  defaultPriceCents: number;
  /** Nombre d'éléments principaux par défaut (énigmes, idées, activités) */
  defaultCount: number;
  countLabel: string;
  /** Univers suggéré par défaut */
  defaultUniverse?: string;
  sections: KitSection[];
  /** Préréglages d'univers compatibles (le premier est le préréglage par défaut du type) */
  presets: UniversePreset[];
}

const HUNT_SECTIONS = (count = 10): KitSection[] => [
  { key: "couverture", label: "Couverture", pages: 1, icon: "image" },
  { key: "guide", label: "Guide de l'organisateur", pages: 2, icon: "list-checks" },
  { key: "lettre", label: "Lettre du personnage", pages: 1, icon: "mail" },
  { key: "enigmes-texte", label: "Cartes énigmes version texte", count, pages: Math.ceil(count / 4), icon: "file-text" },
  { key: "enigmes-images", label: "Cartes énigmes version images", count, pages: Math.ceil(count / 4), icon: "image" },
  { key: "carte", label: "Carte au trésor en 10 morceaux", pages: 1, icon: "map" },
  { key: "defis", label: "Défis", count: 6, pages: 1, icon: "sword" },
  { key: "diplomes", label: "Diplômes", pages: 1, icon: "award" },
  { key: "invitations", label: "Invitations", pages: 1, icon: "party-popper" },
];

const PRANKS_SECTIONS = (count = 30): KitSection[] => [
  { key: "couverture", label: "Couverture", pages: 1, icon: "image" },
  { key: "lettre-arrivee", label: "Lettre d'arrivée", pages: 1, icon: "mail" },
  { key: "idees", label: "Idées", count, pages: count, icon: "sparkles" },
  { key: "calendrier", label: "Calendrier 24 cases", pages: 1, icon: "calendar" },
  { key: "mots", label: "Mots à découper", count: 10, pages: 1, icon: "scissors" },
  { key: "lettre-depart", label: "Lettre de départ", pages: 1, icon: "mail" },
  { key: "certificat", label: "Certificat", pages: 1, icon: "award" },
  { key: "guide-parents", label: "Guide des parents", pages: 1, icon: "list-checks" },
];

const ACTIVITY_SECTIONS = (count = 10): KitSection[] => [
  { key: "couverture", label: "Couverture", pages: 1, icon: "image" },
  { key: "sommaire", label: "Sommaire", pages: 1, icon: "list" },
  { key: "activites", label: "Activités illustrées", count, pages: count * 2, icon: "sparkles" },
  { key: "diplome", label: "Diplôme", pages: 1, icon: "award" },
];

const GUIDE_SECTIONS = (count = 8): KitSection[] => [
  { key: "couverture", label: "Couverture", pages: 1, icon: "image" },
  { key: "introduction", label: "Introduction et sommaire", pages: 2, icon: "list" },
  { key: "probleme", label: "Comprendre le problème et ses causes", pages: 2, icon: "circle-help" },
  { key: "diagnostic", label: "Diagnostic pas à pas", pages: 1, icon: "stethoscope" },
  { key: "chapitres", label: "Chapitres de méthode", count, pages: count * 2, icon: "book-open" },
  { key: "erreurs", label: "Erreurs fréquentes", pages: 1, icon: "triangle-alert" },
  { key: "checklist", label: "Checklist imprimable", pages: 1, icon: "list-checks" },
  { key: "calendrier", label: "Calendrier d'entretien", pages: 1, icon: "calendar" },
  { key: "faq", label: "FAQ et glossaire", pages: 2, icon: "message-circle-question" },
];

const RECIPES_SECTIONS = (count = 20): KitSection[] => [
  { key: "couverture", label: "Couverture", pages: 1, icon: "image" },
  { key: "introduction", label: "Introduction", pages: 1, icon: "book-open" },
  { key: "recettes", label: "Recettes", count, pages: count, icon: "chef-hat" },
  { key: "conseils", label: "Conseils et astuces", pages: 1, icon: "lightbulb" },
];

const SCIENCE_SECTIONS = (count = 12): KitSection[] => [
  { key: "couverture", label: "Couverture", pages: 1, icon: "image" },
  { key: "introduction", label: "Introduction et règles de sécurité", pages: 1, icon: "shield-check" },
  { key: "experiences", label: "Fiches d'expériences", count, pages: count, icon: "flask-conical" },
  { key: "diplome", label: "Diplôme de petit scientifique", pages: 1, icon: "award" },
];

/** Cahier de coloriage : une page par dessin (+ page blanche au dos en recto-verso). */
export const COLORING_SECTIONS = (count = 30): KitSection[] => [
  { key: "couverture", label: "Couverture en couleur", pages: 1, icon: "image" },
  { key: "appartient", label: "Page « Ce cahier appartient à… »", pages: 1, icon: "user-round-pen" },
  { key: "exemple", label: "Page d'exemple colorée", pages: 1, icon: "palette" },
  { key: "dessins", label: "Dessins à colorier", count, pages: count, icon: "brush" },
  { key: "diplome", label: "Diplôme « Artiste en herbe »", pages: 1, icon: "award" },
];

const KIDS: UniversePreset[] = ["kit-enfants"];

export const KIT_TYPES: KitTypeDef[] = [
  { key: "chasse-au-tresor", label: "Chasse au trésor", description: "10 énigmes en 2 versions, carte en 10 morceaux, défis, diplômes, invitations et guide.", icon: "map", family: "kit", format: "treasure_hunt", shopCategory: "chasses-au-tresor", template: "ADVENTURE", defaultAge: "5-8", defaultPriceCents: 990, defaultCount: 10, countLabel: "énigmes", defaultUniverse: "Pirates", sections: HUNT_SECTIONS(10), presets: KIDS },
  { key: "mission-enquete", label: "Mission / enquête", description: "Même mécanique que la chasse au trésor, habillée en mission d'agents secrets ou enquête.", icon: "search", family: "kit", format: "treasure_hunt", shopCategory: "chasses-au-tresor", template: "ADVENTURE", defaultAge: "8-10", defaultPriceCents: 990, defaultCount: 10, countLabel: "énigmes", defaultUniverse: "Agents secrets", sections: HUNT_SECTIONS(10), presets: KIDS },
  { key: "kit-anniversaire", label: "Kit d'anniversaire", description: "Chasse au trésor d'anniversaire avec invitations et diplômes assortis.", icon: "cake", family: "kit", format: "treasure_hunt", shopCategory: "evenements", template: "EVENT", defaultAge: "5-8", defaultPriceCents: 1290, defaultCount: 10, countLabel: "énigmes", sections: HUNT_SECTIONS(10), presets: KIDS },
  { key: "kit-paques", label: "Chasse aux œufs de Pâques", description: "Chasse au trésor de Pâques : énigmes, carte et diplômes.", icon: "egg", family: "kit", format: "treasure_hunt", shopCategory: "evenements", template: "EVENT", defaultAge: "3-10", defaultPriceCents: 790, defaultCount: 8, countLabel: "énigmes", defaultUniverse: "Pâques", sections: HUNT_SECTIONS(8), presets: KIDS },
  { key: "kit-halloween", label: "Jeu d'Halloween", description: "Enquête d'Halloween (gentiment frissonnante) : énigmes, carte, défis.", icon: "ghost", family: "kit", format: "treasure_hunt", shopCategory: "evenements", template: "EVENT", defaultAge: "5-8", defaultPriceCents: 790, defaultCount: 8, countLabel: "énigmes", defaultUniverse: "Halloween", sections: HUNT_SECTIONS(8), presets: KIDS },
  { key: "lutins-farceurs", label: "Lutins farceurs", description: "30 farces de lutin rapides pour décembre, calendrier, mots du lutin, lettres et certificat.", icon: "gift", family: "kit", format: "pranks", shopCategory: "evenements", template: "EVENT", defaultAge: "3-10", defaultPriceCents: 790, defaultCount: 30, countLabel: "idées", defaultUniverse: "Noël", sections: PRANKS_SECTIONS(30), presets: KIDS },
  { key: "kit-noel", label: "Activités de Noël", description: "Idées d'activités de Noël au fil des jours, avec calendrier et petits mots.", icon: "tree-pine", family: "kit", format: "pranks", shopCategory: "evenements", template: "EVENT", defaultAge: "3-10", defaultPriceCents: 790, defaultCount: 24, countLabel: "idées", defaultUniverse: "Noël", sections: PRANKS_SECTIONS(24), presets: KIDS },
  { key: "cahier-activites", label: "Cahier d'activités", description: "Activités illustrées pas à pas par tranche d'âge.", icon: "pencil-ruler", family: "activites", shopCategory: "activites-educatives", template: "ACTIVITY", defaultAge: "5-8", defaultPriceCents: 690, defaultCount: 10, countLabel: "activités", sections: ACTIVITY_SECTIONS(10), presets: KIDS },
  { key: "jeux-logique", label: "Jeux de logique", description: "Énigmes, labyrinthes et jeux de raisonnement illustrés.", icon: "puzzle", family: "activites", shopCategory: "activites-educatives", template: "ACTIVITY", defaultAge: "5-8", defaultPriceCents: 690, defaultCount: 20, countLabel: "jeux", sections: ACTIVITY_SECTIONS(20), presets: KIDS },
  { key: "activites-montessori", label: "Activités Montessori", description: "Activités sensorielles et de manipulation inspirées de la pédagogie Montessori.", icon: "shapes", family: "activites", shopCategory: "activites-educatives", template: "ACTIVITY", defaultAge: "3-5", defaultPriceCents: 690, defaultCount: 10, countLabel: "activités", sections: ACTIVITY_SECTIONS(10), presets: KIDS },
  { key: "histoire-illustree", label: "Histoire illustrée", description: "Livre illustré à lire et à imprimer.", icon: "book-open", family: "activites", shopCategory: "histoires-et-aventures", template: "STORY", defaultAge: "3-10", defaultPriceCents: 590, defaultCount: 12, countLabel: "doubles pages", sections: ACTIVITY_SECTIONS(12), presets: KIDS },
  { key: "histoire-du-soir", label: "Histoires du soir", description: "Recueil d'histoires courtes pour le coucher.", icon: "moon", family: "activites", shopCategory: "histoires-et-aventures", template: "STORY", defaultAge: "3-5", defaultPriceCents: 590, defaultCount: 7, countLabel: "histoires", sections: ACTIVITY_SECTIONS(7), presets: KIDS },
  { key: "livre-personnalisable", label: "Livre personnalisable", description: "Histoire dont l'enfant est le héros (prénom à compléter).", icon: "user-round-pen", family: "activites", shopCategory: "histoires-et-aventures", template: "STORY", defaultAge: "3-10", defaultPriceCents: 790, defaultCount: 12, countLabel: "pages", sections: ACTIVITY_SECTIONS(12), presets: KIDS },
  { key: "cahier-coloriage", label: "Cahier de coloriage", description: "Dessins au trait noir sur blanc (une page par dessin, de 10 à plusieurs centaines), page « Ce cahier appartient à… », exemple coloré et diplôme « Artiste en herbe ».", icon: "palette", family: "kit", format: "coloring", shopCategory: "activites-educatives", template: "ACTIVITY", defaultAge: "3-10", defaultPriceCents: 590, defaultCount: 30, countLabel: "dessins", defaultUniverse: "Dinosaures", sections: COLORING_SECTIONS(30), presets: ["kit-enfants", "sciences-enfants"] },
  // Guides, recettes, sciences (autres univers de la boutique)
  { key: "guide-pratique", label: "Guide pratique expert", description: "Guide pour adultes : problème, causes, diagnostic, méthode pas à pas, erreurs fréquentes, checklist, calendrier, FAQ et glossaire.", icon: "book-marked", family: "kit", format: "guide", shopCategory: "guides-pratiques", template: "GUIDE", defaultAge: "18-99", defaultPriceCents: 1490, defaultCount: 8, countLabel: "chapitres", sections: GUIDE_SECTIONS(8), presets: ["guide-expert"] },
  { key: "livre-recettes", label: "Livre de recettes", description: "Recettes testables : ingrédients, étapes, temps, portions, astuces et allergènes.", icon: "chef-hat", family: "kit", format: "recipes", shopCategory: "recettes", template: "RECIPES", defaultAge: "18-99", defaultPriceCents: 990, defaultCount: 20, countLabel: "recettes", sections: RECIPES_SECTIONS(20), presets: ["recettes"] },
  { key: "fiches-sciences", label: "Fiches d'expériences scientifiques", description: "Expériences pour enfants : question, matériel, étapes, explication, pour aller plus loin, sécurité.", icon: "flask-conical", family: "kit", format: "science", shopCategory: "activites-educatives", template: "ACTIVITY", defaultAge: "6-10", defaultPriceCents: 790, defaultCount: 12, countLabel: "expériences", defaultUniverse: "Laboratoire", sections: SCIENCE_SECTIONS(12), presets: ["sciences-enfants", "kit-enfants"] },
  // Types historiques (livres d'activités) conservés
  { key: "inventions", label: "Inventions", description: "Activités d'inventions et de construction.", icon: "lightbulb", family: "activites", shopCategory: "activites-educatives", template: "ACTIVITY", defaultAge: "6-9", defaultPriceCents: 690, defaultCount: 10, countLabel: "activités", sections: ACTIVITY_SECTIONS(10), presets: KIDS },
  { key: "sciences", label: "Sciences", description: "Expériences scientifiques à la maison.", icon: "flask-conical", family: "activites", shopCategory: "activites-educatives", template: "ACTIVITY", defaultAge: "6-9", defaultPriceCents: 690, defaultCount: 10, countLabel: "activités", sections: ACTIVITY_SECTIONS(10), presets: ["sciences-enfants", "kit-enfants"] },
  { key: "bricolages", label: "Bricolages", description: "Bricolages avec du matériel de récupération.", icon: "scissors", family: "activites", shopCategory: "activites-educatives", template: "ACTIVITY", defaultAge: "6-9", defaultPriceCents: 690, defaultCount: 10, countLabel: "activités", sections: ACTIVITY_SECTIONS(10), presets: KIDS },
  { key: "creativite", label: "Créativité", description: "Arts plastiques et créations.", icon: "palette", family: "activites", shopCategory: "activites-educatives", template: "ACTIVITY", defaultAge: "5-8", defaultPriceCents: 690, defaultCount: 10, countLabel: "activités", sections: ACTIVITY_SECTIONS(10), presets: KIDS },
  { key: "nature", label: "Nature", description: "Découvertes et activités nature.", icon: "leaf", family: "activites", shopCategory: "activites-educatives", template: "ACTIVITY", defaultAge: "6-9", defaultPriceCents: 690, defaultCount: 10, countLabel: "activités", sections: ACTIVITY_SECTIONS(10), presets: KIDS },
  { key: "jeux", label: "Jeux éducatifs", description: "Jeux éducatifs à imprimer.", icon: "dice-5", family: "activites", shopCategory: "activites-educatives", template: "ACTIVITY", defaultAge: "5-8", defaultPriceCents: 690, defaultCount: 10, countLabel: "jeux", sections: ACTIVITY_SECTIONS(10), presets: KIDS },
  { key: "prescolaire", label: "Activités préscolaires", description: "Premières activités pour les 3–5 ans.", icon: "baby", family: "activites", shopCategory: "activites-educatives", template: "ACTIVITY", defaultAge: "3-5", defaultPriceCents: 690, defaultCount: 10, countLabel: "activités", sections: ACTIVITY_SECTIONS(10), presets: KIDS },
];

/** Type générique des livres antérieurs à l'introduction des kits. */
export const LEGACY_ACTIVITY_TYPE = "activites";

export function kitType(key: string | null | undefined): KitTypeDef {
  return KIT_TYPES.find((k) => k.key === key) ?? KIT_TYPES.find((k) => k.key === "cahier-activites")!;
}

export function isStructuredKit(key: string | null | undefined): boolean {
  const def = KIT_TYPES.find((k) => k.key === key);
  return Boolean(def && def.family === "kit" && def.format);
}

/** Types d'e-books proposés pour un préréglage d'univers (kits structurés d'abord). */
export function typesForPreset(p: UniversePreset | null | undefined): KitTypeDef[] {
  if (!p) return KIT_TYPES;
  return KIT_TYPES.filter((k) => k.presets.includes(p));
}

/** Le type est-il compatible avec le préréglage de l'univers ? */
export function typeAllowedForPreset(key: string, p: UniversePreset | null | undefined): boolean {
  return !p || typesForPreset(p).some((k) => k.key === key);
}

/** Type d'e-book par défaut d'un préréglage. */
export function defaultTypeForPreset(p: UniversePreset | null | undefined): string {
  if (p === "guide-expert") return "guide-pratique";
  if (p === "recettes") return "livre-recettes";
  if (p === "sciences-enfants") return "fiches-sciences";
  return "chasse-au-tresor";
}

/** Âge affiché : « adultes » pour les e-books destinés aux adultes. */
export function isAdultAge(range: string | null | undefined): boolean {
  const m = /^(\d+)-/.exec(range ?? "");
  return Boolean(m && Number(m[1]) >= 16);
}

export function kitLabel(key: string | null | undefined): string {
  return KIT_TYPES.find((k) => k.key === key)?.label ?? (key === LEGACY_ACTIVITY_TYPE ? "Livre d'activités" : key ?? "—");
}

/** Type de kit déduit d'une catégorie / d'un univers / d'un nom de produit de la boutique. */
export function kitTypeFromShop(p: { categorySlug?: string | null; template?: string | null; name?: string | null; universe?: string | null }): string {
  const text = `${p.name ?? ""} ${p.universe ?? ""}`.toLowerCase();
  if (p.template === "GUIDE") return "guide-pratique";
  if (p.template === "RECIPES") return "livre-recettes";
  if (/coloriage|à colorier|a colorier/.test(text)) return "cahier-coloriage";
  if (/lutin/.test(text)) return "lutins-farceurs";
  if (/no[eë]l/.test(text) && p.categorySlug === "evenements") return "kit-noel";
  if (/p[âa]ques|oeuf|œuf/.test(text)) return "kit-paques";
  if (/halloween/.test(text)) return "kit-halloween";
  if (/anniversaire/.test(text)) return "kit-anniversaire";
  if (/enqu[êe]te|mission|agent/.test(text) && p.categorySlug === "chasses-au-tresor") return "mission-enquete";
  switch (p.categorySlug) {
    case "chasses-au-tresor": return "chasse-au-tresor";
    case "evenements": return "kit-anniversaire";
    case "histoires-et-aventures": return "histoire-illustree";
    case "activites-educatives": return "cahier-activites";
  }
  if (p.template === "ADVENTURE") return "chasse-au-tresor";
  if (p.template === "EVENT") return "kit-anniversaire";
  if (p.template === "STORY") return "histoire-illustree";
  return "cahier-activites";
}

/** Libellés d'univers proposés dans l'assistant (saisie libre possible). */
export const UNIVERSES = ["Pirates", "Dinosaures", "Espace", "Princesses et chevaliers", "Animaux de la ferme", "Jungle", "Forêt enchantée", "Agents secrets", "Sous la mer", "Noël", "Pâques", "Halloween", "Licornes", "Super-héros"] as const;

export const TONES = ["Joyeux et complice", "Aventure palpitante", "Doux et rassurant", "Drôle et farceur", "Mystérieux (sans faire peur)"] as const;

export const KIT_AGE_RANGES = ["3-5", "5-8", "8-10", "3-10", "6-10", "18-99"] as const;

/** Contenus du kit pour la fiche boutique (kitContents) à partir de la structure du type. */
export function kitContentsFor(def: KitTypeDef, counts: { main?: number } = {}): Array<{ title: string; description: string; icon: string; quantity?: number }> {
  return def.sections
    .filter((s) => s.key !== "couverture" && s.key !== "sommaire")
    .map((s) => {
      const count = s.count != null ? (MAIN_SECTION_KEYS.includes(s.key) ? counts.main ?? s.count : s.count) : undefined;
      const label = count && /^(Cartes|Idées|Activités|Défis|Mots|Chapitres|Recettes|Fiches|Dessins)/.test(s.label) ? `${count} ${s.label.charAt(0).toLowerCase()}${s.label.slice(1)}` : s.label;
      return { title: label, description: "", icon: s.icon, quantity: count ?? undefined };
    });
}

/** Sections dont la quantité suit le nombre d'éléments principaux du kit. */
export const MAIN_SECTION_KEYS = ["enigmes-texte", "enigmes-images", "idees", "activites", "chapitres", "recettes", "experiences", "dessins"];
