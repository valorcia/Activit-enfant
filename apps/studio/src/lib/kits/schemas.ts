import { z } from "zod";

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
    template: z.enum(["ADVENTURE", "ACTIVITY", "STORY", "EVENT", "CLASSIC"]).optional(),
    categorySlug: z.string().optional(),
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
    .max(30),
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
    .max(60),
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

export type KitContentFormat = "treasure_hunt" | "pranks";

export const KIT_CONTENT_SCHEMAS = {
  treasure_hunt: TreasureHuntSchema,
  pranks: PranksKitSchema,
} as const;

/** Reconnaît un JSON de kit complet (sortie des prompts docs/prompts) et indique son format. */
export function detectKitContentFormat(data: unknown): KitContentFormat | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  if (Array.isArray(o.enigmes)) return "treasure_hunt";
  if (Array.isArray(o.idees)) return "pranks";
  return null;
}

// ---------------------------------------------------------------------------
// Personnalisation d'un kit (Book.customization)
// ---------------------------------------------------------------------------

export const KitCustomizationSchema = z.object({
  universe: z.string().max(80).default(""),
  heroName: z.string().max(80).default(""),
  heroDescription: z.string().max(400).default(""),
  companion: z.string().max(160).default(""),
  place: z.string().max(160).default(""), // lieu ou véhicule (bateau, camion-laboratoire, vaisseau…)
  tone: z.string().max(80).default("Joyeux et complice"),
  count: z.number().int().min(1).max(60).optional(),
  priceCents: z.number().int().min(0).optional(),
  shopCategorySlug: z.string().max(80).optional(),
  shopTemplate: z.enum(["ADVENTURE", "ACTIVITY", "STORY", "EVENT", "CLASSIC"]).optional(),
  extraInstructions: z.string().max(4000).default(""),
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
  count: z.number().int().min(1).max(60).default(10),
  priceCents: z.number().int().min(0).max(100000).optional(),
  shopCategorySlug: z.string().max(80).optional(),
  notes: z.string().max(4000).default(""),
});
export type KitPlan = z.infer<typeof KitPlanSchema>;
