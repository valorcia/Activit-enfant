import { z } from "zod";
import { MAX_ITEMS_PER_BOOK } from "./limits";

/**
 * Contenus structurés des kits, au format produit par les prompts de docs/prompts
 * (chasse au trésor, lutins farceurs). Les schémas sont tolérants : champs facultatifs
 * avec valeurs par défaut, pour accepter une réponse collée depuis Claude ou ChatGPT.
 */

const str = (max = 4000) => z.string().max(max).default("");
const illus = z.array(z.object({ page: z.string().min(1).max(60), prompt: z.string().min(5).max(2000) })).default([]);

export const ShopListingImportSchema = z
  .object({
    name: z.string().max(160).optional(),
    slug: z.string().max(96).optional(),
    tagline: z.string().max(200).optional(),
    shortDescription: z.string().max(400).optional(),
    longDescription: z.string().max(20000).optional(),
    story: z.string().max(20000).optional(),
    template: z.enum(["ADVENTURE", "ACTIVITY", "STORY", "EVENT", "CLASSIC", "GUIDE", "RECIPES"]).optional(),
    categorySlug: z.string().optional(),
    siteSlug: z.string().optional(),
    universe: z.string().max(80).optional(),
    tags: z.array(z.string()).optional(),
    heroBadges: z.array(z.string()).optional(),
    ageMin: z.number().int().optional(),
    ageMax: z.number().int().optional(),
    playersMin: z.number().int().optional(),
    playersMax: z.number().int().optional(),
    durationMinutes: z.number().int().optional(),
    difficulty: z.number().int().optional(),
    pageCount: z.number().int().optional(),
    materials: z.array(z.string()).optional(),
    priceCents: z.number().int().min(0).optional(),
    kitContents: z.array(z.object({ title: z.string(), description: z.string().optional(), icon: z.string().optional(), quantity: z.number().int().optional() })).optional(),
    faq: z.array(z.object({ question: z.string(), answer: z.string() })).optional(),
    sellingPoints: z.array(z.object({ title: z.string(), description: z.string().optional(), icon: z.string().optional() })).optional(),
    seoTitle: z.string().optional(),
    seoDescription: z.string().optional(),
    keywords: z.array(z.string()).optional(),
  })
  .passthrough();
export type ShopListingImport = z.infer<typeof ShopListingImportSchema>;

// ---------------------------------------------------------------------------
// Chasse au trésor (et missions / enquêtes : même mécanique)
// ---------------------------------------------------------------------------

export const TreasureHuntSchema = z.object({
  titre: z.string().min(2).max(140),
  sous_titre: str(240),
  personnage: z.object({ nom: str(80), description: str(600), compagnon: str(160), vehicule: str(120) }).partial().default({}),
  lettre: z.string().min(20).max(3000),
  enigmes: z
    .array(
      z.object({
        numero: z.number().int().min(1),
        cachette: str(120),
        texte: z.string().min(5).max(800),
        indice_secours: str(300),
        image_description: str(800),
      }),
    )
    .min(1)
    .max(MAX_ITEMS_PER_BOOK),
  carte: z.object({ titre: str(140), consigne_parent: str(600), image_description: str(800) }).partial().default({}),
  defis: z.array(z.object({ titre: z.string().min(1).max(80), consigne: z.string().min(3).max(500) })).max(20).default([]),
  diplome: z.object({ titre: str(120), texte: str(600) }).partial().default({}),
  invitation: z.object({ titre: str(120), texte: str(800) }).partial().default({}),
  guide: z
    .object({
      materiel: z.array(z.string()).default([]),
      preparation: z.array(z.string()).default([]),
      cachettes: z.array(z.object({ carte: z.number().int(), cachette: str(160), variante: str(200) })).default([]),
      deroule: z.array(z.string()).default([]),
      adaptations: z.array(z.string()).default([]),
      securite: z.array(z.string()).default([]),
    })
    .partial()
    .default({}),
  illustrations: illus,
  boutique: ShopListingImportSchema.optional(),
});
export type TreasureHunt = z.infer<typeof TreasureHuntSchema>;

// ---------------------------------------------------------------------------
// Lutins farceurs / idées à mettre en œuvre (calendrier d'idées)
// ---------------------------------------------------------------------------

export const PranksKitSchema = z.object({
  titre: z.string().min(2).max(140),
  sous_titre: str(240),
  personnages: z.array(z.object({ nom: z.string().max(80), description: str(600) })).default([]),
  lettre_arrivee: z.string().min(20).max(3000),
  idees: z
    .array(
      z.object({
        numero: z.number().int().min(1),
        titre: z.string().min(2).max(120),
        resume: str(400),
        materiel: z.array(z.string()).default([]),
        preparation: z.array(z.string()).default([]),
        temps_minutes: z.number().int().min(0).max(240).default(5),
        difficulte: z.number().int().min(1).max(5).default(1),
        age_conseille: str(20),
        message_du_lutin: str(400),
        variante_sans_materiel: z.string().max(400).nullable().optional(),
        illustration_description: str(800),
      }),
    )
    .min(1)
    .max(MAX_ITEMS_PER_BOOK),
  idees_reserve: z.array(z.object({ titre: z.string().max(120), resume: str(400) })).default([]),
  mots_du_lutin: z.array(z.string().max(300)).default([]),
  lettre_depart: str(3000),
  certificat: z.object({ titre: str(120), texte: str(600) }).partial().default({}),
  guide_parents: z
    .object({ introduire: z.array(z.string()).default([]), oubli: str(600), organisation: z.array(z.string()).default([]), securite: z.array(z.string()).default([]) })
    .partial()
    .default({}),
  illustrations: illus,
  boutique: ShopListingImportSchema.optional(),
});
export type PranksKit = z.infer<typeof PranksKitSchema>;

// ---------------------------------------------------------------------------
// Guide pratique expert (adultes) : problème, causes, diagnostic, méthode, checklists
// ---------------------------------------------------------------------------

const strList = (max = 600) => z.array(z.string().max(max)).default([]);

export const GuideSchema = z.object({
  titre: z.string().min(2).max(160),
  sous_titre: str(240),
  auteur: z.object({ nom: str(120), expertise: str(300) }).partial().default({}),
  introduction: z.string().min(20).max(4000),
  probleme: z.object({ titre: str(160), texte: str(3000) }).partial().default({}),
  causes: z.array(z.object({ titre: z.string().min(1).max(160), explication: str(1200) })).max(20).default([]),
  diagnostic: z.array(z.object({ question: z.string().min(1).max(300), si_oui: str(600), si_non: str(600) })).max(20).default([]),
  chapitres: z
    .array(
      z.object({
        numero: z.number().int().min(1),
        titre: z.string().min(2).max(160),
        resume: str(500),
        contenu: z.string().max(6000).default(""),
        etapes: strList(500),
        conseil: str(600),
        attention: str(600),
        tableau: z.object({ titre: str(160), colonnes: z.array(z.string().max(80)).max(6).default([]), lignes: z.array(z.array(z.string().max(160)).max(6)).max(14).default([]) }).nullable().optional(),
        illustration_description: str(800),
      }),
    )
    .min(1)
    .max(MAX_ITEMS_PER_BOOK),
  erreurs: z.array(z.object({ erreur: z.string().min(1).max(300), solution: str(600) })).max(20).default([]),
  checklist: z.object({ titre: str(160), items: strList(300) }).partial().default({}),
  calendrier: z.array(z.object({ periode: z.string().min(1).max(80), actions: strList(300) })).max(16).default([]),
  faq: z.array(z.object({ question: z.string().min(1).max(300), reponse: z.string().min(1).max(1500) })).max(20).default([]),
  glossaire: z.array(z.object({ terme: z.string().min(1).max(80), definition: z.string().min(1).max(500) })).max(40).default([]),
  securite: strList(500),
  illustrations: illus,
  boutique: ShopListingImportSchema.optional(),
});
export type Guide = z.infer<typeof GuideSchema>;

// ---------------------------------------------------------------------------
// Livre de recettes
// ---------------------------------------------------------------------------

export const RecipesSchema = z.object({
  titre: z.string().min(2).max(160),
  sous_titre: str(240),
  introduction: z.string().min(20).max(4000),
  recettes: z
    .array(
      z.object({
        numero: z.number().int().min(1),
        titre: z.string().min(2).max(140),
        resume: str(400),
        portions: z.number().int().min(1).max(40).default(4),
        temps_preparation_minutes: z.number().int().min(0).max(1440).default(15),
        temps_cuisson_minutes: z.number().int().min(0).max(1440).default(0),
        difficulte: z.number().int().min(1).max(3).default(1),
        ingredients: z.array(z.string().max(160)).min(1).max(30),
        etapes: z.array(z.string().max(600)).min(1).max(20),
        astuce: str(500),
        allergenes: strList(60),
        illustration_description: str(800),
      }),
    )
    .min(1)
    .max(MAX_ITEMS_PER_BOOK),
  conseils: strList(500),
  illustrations: illus,
  boutique: ShopListingImportSchema.optional(),
});
export type Recipes = z.infer<typeof RecipesSchema>;

// ---------------------------------------------------------------------------
// Fiches d'expériences scientifiques (enfants)
// ---------------------------------------------------------------------------

export const ScienceSchema = z.object({
  titre: z.string().min(2).max(160),
  sous_titre: str(240),
  personnage: z.object({ nom: str(80), description: str(600) }).partial().default({}),
  introduction: z.string().min(20).max(3000),
  experiences: z
    .array(
      z.object({
        numero: z.number().int().min(1),
        titre: z.string().min(2).max(140),
        question: str(300),
        materiel: z.array(z.string().max(160)).max(20).default([]),
        etapes: z.array(z.string().max(500)).min(1).max(15),
        explication: z.string().min(5).max(1500),
        pour_aller_plus_loin: str(600),
        securite: strList(300),
        duree_minutes: z.number().int().min(1).max(240).default(20),
        difficulte: z.number().int().min(1).max(3).default(1),
        age_conseille: str(20),
        illustration_description: str(800),
      }),
    )
    .min(1)
    .max(MAX_ITEMS_PER_BOOK),
  diplome: z.object({ titre: str(120), texte: str(600) }).partial().default({}),
  securite_generale: strList(400),
  illustrations: illus,
  boutique: ShopListingImportSchema.optional(),
});
export type Science = z.infer<typeof ScienceSchema>;

// ---------------------------------------------------------------------------
// Cahier de coloriage (trait noir sur blanc, une page par dessin)
// ---------------------------------------------------------------------------

/** Niveau de détail d'un dessin (accepte aussi 1, 2, 3 dans une réponse collée). */
const DetailLevel = z.preprocess(
  (v) => (v === 1 || v === "1" ? "simple" : v === 2 || v === "2" ? "moyen" : v === 3 || v === "3" ? "detaille" : typeof v === "string" ? v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() : v),
  z.enum(["simple", "moyen", "detaille"]).catch("moyen"),
);

export const ColoringSchema = z.object({
  titre: z.string().min(2).max(160),
  sous_titre: str(240),
  theme: str(160),
  /** Petit mot d'accueil (enfant et parents) */
  introduction: z.string().max(3000).default(""),
  dessins: z
    .array(
      z.object({
        numero: z.number().int().min(1),
        titre: z.string().min(1).max(120),
        /** Ce qu'il faut dessiner (sujet, pose, décor simple) : sert de prompt d'image */
        description: z.string().min(5).max(1200),
        /** Légende facultative imprimée sous le dessin */
        legende: str(200),
        niveau_detail: DetailLevel.default("moyen"),
      }),
    )
    .min(1)
    .max(MAX_ITEMS_PER_BOOK),
  page_appartient: z.object({ titre: str(120), texte: str(400) }).partial().default({}),
  diplome: z.object({ titre: str(120), texte: str(600) }).partial().default({}),
  conseils: strList(300),
  illustrations: illus,
  boutique: ShopListingImportSchema.optional(),
});
export type Coloring = z.infer<typeof ColoringSchema>;

/** Options de mise en page du cahier de coloriage (Book.customization.coloring). */
export const ColoringOptionsSchema = z.object({
  /** Page d'exemple colorée (le premier dessin mis en couleur, pour donner envie) */
  sampleColored: z.boolean().default(true),
  /** Prénom imprimé sur la couverture (vide : ligne « Ce cahier appartient à … » à compléter) */
  childName: z.string().max(60).default(""),
  nameOnCover: z.boolean().default(true),
  /** Sommaire des dessins */
  toc: z.boolean().default(false),
  /** Impression recto-verso : une page blanche au dos de chaque dessin (les feutres ne traversent pas sur le dessin suivant) */
  duplex: z.boolean().default(false),
});
export type ColoringOptions = z.infer<typeof ColoringOptionsSchema>;

export type KitContentFormat = "treasure_hunt" | "pranks" | "guide" | "recipes" | "science" | "coloring";

export const KIT_CONTENT_SCHEMAS = {
  treasure_hunt: TreasureHuntSchema,
  pranks: PranksKitSchema,
  guide: GuideSchema,
  recipes: RecipesSchema,
  science: ScienceSchema,
  coloring: ColoringSchema,
} as const;

/** Clé de la liste des éléments principaux de chaque format (rédaction par lots, fusion). */
export const ITEMS_KEY = {
  treasure_hunt: "enigmes",
  pranks: "idees",
  guide: "chapitres",
  recipes: "recettes",
  science: "experiences",
  coloring: "dessins",
} as const satisfies Record<KitContentFormat, string>;

/** Schéma d'un élément principal (un lot = { "items": [...] }). */
export function itemSchemaFor(format: KitContentFormat): z.ZodTypeAny {
  const shape = (KIT_CONTENT_SCHEMAS[format] as z.AnyZodObject).shape as Record<string, z.ZodTypeAny>;
  let list: z.ZodTypeAny = shape[ITEMS_KEY[format]];
  while (!(list instanceof z.ZodArray)) list = (list as z.ZodEffects<z.ZodTypeAny>)._def.schema ?? (list as z.ZodDefault<z.ZodTypeAny>)._def.innerType;
  return (list as z.ZodArray<z.ZodTypeAny>).element;
}

/** Reconnaît un JSON de kit complet (sortie des prompts docs/prompts) et indique son format. */
export function detectKitContentFormat(data: unknown): KitContentFormat | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  if (Array.isArray(o.enigmes)) return "treasure_hunt";
  if (Array.isArray(o.idees)) return "pranks";
  if (Array.isArray(o.chapitres)) return "guide";
  if (Array.isArray(o.recettes)) return "recipes";
  if (Array.isArray(o.experiences)) return "science";
  if (Array.isArray(o.dessins)) return "coloring";
  return null;
}

// ---------------------------------------------------------------------------
// Personnalisation d'un kit (Book.customization)
// ---------------------------------------------------------------------------

/**
 * Réglages IA propres à un livre (surchargent Paramètres → IA pour ce livre seulement) :
 * mode mixte « texte en copier-coller (abonnement Claude) · images par l'API OpenAI »,
 * modèle / qualité d'image, esquisses, couverture.
 */
export const BookAiOverridesSchema = z.object({
  textVia: z.enum(["api", "manual"]).optional(),
  imagesVia: z.enum(["api", "manual"]).optional(),
  imageModel: z.string().max(60).optional(),
  imageQuality: z.enum(["low", "medium", "high"]).optional(),
  sketch: z.boolean().optional(),
  coverModel: z.string().max(60).optional(),
  coverQuality: z.enum(["low", "medium", "high"]).optional(),
  /** Copier-coller des images d'un cahier de coloriage : dessins par planche (1, 4 = 2×2, 9 = 3×3) */
  sheetGrid: z.union([z.literal(1), z.literal(4), z.literal(9)]).optional(),
});
export type BookAiOverrides = z.infer<typeof BookAiOverridesSchema>;

export const KitCustomizationSchema = z.object({
  universe: z.string().max(80).default(""),
  heroName: z.string().max(80).default(""),
  heroDescription: z.string().max(400).default(""),
  companion: z.string().max(160).default(""),
  place: z.string().max(160).default(""), // lieu ou véhicule (bateau, camion-laboratoire, vaisseau…)
  tone: z.string().max(80).default("Joyeux et complice"),
  count: z.number().int().min(1).max(MAX_ITEMS_PER_BOOK).optional(),
  priceCents: z.number().int().min(0).optional(),
  shopCategorySlug: z.string().max(80).optional(),
  shopTemplate: z.enum(["ADVENTURE", "ACTIVITY", "STORY", "EVENT", "CLASSIC", "GUIDE", "RECIPES"]).optional(),
  extraInstructions: z.string().max(4000).default(""),
  /** Cahier de coloriage : page d'exemple colorée, prénom sur la couverture, sommaire, recto-verso */
  coloring: ColoringOptionsSchema.optional(),
  /** Réglages IA du livre (mode mixte, modèle d'image…) */
  ai: BookAiOverridesSchema.optional(),
});
export type KitCustomization = z.infer<typeof KitCustomizationSchema>;

/** Plan de kit produit à partir d'un brief libre (étape avant la production). */
export const KitPlanSchema = z.object({
  kitType: z.string().min(2).max(40),
  title: z.string().min(2).max(140),
  subtitle: z.string().max(240).default(""),
  ageRange: z.string().regex(/^\d+-\d+$/).default("5-8"),
  universe: z.string().max(80).default(""),
  heroName: z.string().max(80).default(""),
  heroDescription: z.string().max(400).default(""),
  companion: z.string().max(160).default(""),
  place: z.string().max(160).default(""),
  tone: z.string().max(80).default(""),
  count: z.number().int().min(1).max(MAX_ITEMS_PER_BOOK).default(10),
  priceCents: z.number().int().min(0).max(100000).optional(),
  shopCategorySlug: z.string().max(80).optional(),
  /** Univers de la boutique ciblé (slug) */
  siteSlug: z.string().max(120).optional(),
  notes: z.string().max(4000).default(""),
  /** Cahier de coloriage : options de mise en page */
  coloring: ColoringOptionsSchema.optional(),
  /** Réglages IA du livre (mode mixte, modèle d'image…) */
  ai: BookAiOverridesSchema.optional(),
});
export type KitPlan = z.infer<typeof KitPlanSchema>;
