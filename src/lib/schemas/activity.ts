import { z } from "zod";

// ---------------------------------------------------------------------------
// Référentiels
// ---------------------------------------------------------------------------

export const AGE_RANGES = ["3-5", "4-6", "6-9", "9-12"] as const;
export type AgeRange = (typeof AGE_RANGES)[number];

export const BOOK_TYPES = [
  { key: "inventions", label: "Inventions", category: "inventions" },
  { key: "sciences", label: "Sciences", category: "sciences" },
  { key: "bricolages", label: "Bricolages", category: "bricolage" },
  { key: "creativite", label: "Créativité", category: "creativite" },
  { key: "nature", label: "Nature", category: "nature" },
  { key: "jeux", label: "Jeux éducatifs", category: "jeux" },
  { key: "prescolaire", label: "Activités préscolaires", category: "prescolaire" },
] as const;
export type BookTypeKey = (typeof BOOK_TYPES)[number]["key"];

export const ART_STYLES = [
  { key: "aquarelle", label: "Aquarelle jeunesse", prompt: "soft children's book watercolor illustration, gentle paper texture, warm light, clean composition" },
  { key: "vectoriel", label: "Illustration vectorielle", prompt: "flat vector illustration, clean shapes, bold outlines, bright harmonious palette, no gradients" },
  { key: "pedagogique", label: "Dessin pédagogique", prompt: "clear educational line drawing with light color fills, instructional diagram style, labelled parts, white background" },
  { key: "bd", label: "Bande dessinée", prompt: "comic book style illustration, expressive ink lines, cel shading, dynamic but readable" },
  { key: "realiste", label: "Illustration réaliste", prompt: "realistic digital painting, accurate materials and proportions, soft studio lighting" },
  { key: "pastel", label: "Style premium pastel", prompt: "premium pastel illustration, soft muted palette, rounded shapes, subtle grain, elegant children's publishing style" },
] as const;
export type ArtStyleKey = (typeof ART_STYLES)[number]["key"];

export const PAGE_FORMATS = {
  A4_PORTRAIT: { label: "A4 portrait", widthMm: 210, heightMm: 297 },
  A4_LANDSCAPE: { label: "A4 paysage", widthMm: 297, heightMm: 210 },
  SQUARE: { label: "Carré (210 × 210 mm)", widthMm: 210, heightMm: 210 },
  CUSTOM: { label: "Format personnalisé", widthMm: 210, heightMm: 297 },
} as const;
export type PageFormatKey = keyof typeof PAGE_FORMATS;

export const ACTIVITY_COUNTS = [10, 20, 30, 50, 100] as const;

// ---------------------------------------------------------------------------
// Concept (proposition de sommaire)
// ---------------------------------------------------------------------------

export const ActivityConceptSchema = z.object({
  title: z.string().min(3).max(90),
  summary: z.string().min(20).max(400),
  category: z.string().min(2),
  finalObject: z.string().min(3).max(160).describe("Objet ou résultat final produit par l'enfant"),
  mainConcept: z.string().min(3).max(160).describe("Notion scientifique ou pédagogique principale"),
  difficulty: z.number().int().min(1).max(5),
  durationMinutes: z.number().int().min(5).max(240),
  keyMaterials: z.array(z.string().min(1)).min(1).max(8),
});
export type ActivityConcept = z.infer<typeof ActivityConceptSchema>;

export const BookOutlineSchema = z.object({
  title: z.string().min(3).max(90),
  subtitle: z.string().max(140).optional().default(""),
  introduction: z.string().min(20).max(1200),
  activities: z.array(ActivityConceptSchema).min(1),
});
export type BookOutline = z.infer<typeof BookOutlineSchema>;

// ---------------------------------------------------------------------------
// Fiche d'activité complète
// ---------------------------------------------------------------------------

export const MaterialItemSchema = z.object({
  name: z.string().min(1).max(80),
  quantity: z.string().max(40).optional().default(""),
  optional: z.boolean().optional().default(false),
  note: z.string().max(160).optional().default(""),
});
export type MaterialItem = z.infer<typeof MaterialItemSchema>;

export const StepSchema = z.object({
  title: z.string().min(2).max(90),
  instruction: z.string().min(10).max(900),
  tip: z.string().max(300).optional().default(""),
  adultHelp: z.boolean().optional().default(false),
  illustrationBrief: z
    .string()
    .min(10)
    .max(500)
    .describe("Description précise de ce que l'illustration de cette étape doit montrer"),
});
export type Step = z.infer<typeof StepSchema>;

export const SafetySchema = z.object({
  adultSupervision: z.enum(["none", "recommended", "required"]),
  warnings: z.array(z.string().min(3).max(300)).default([]),
  hazards: z
    .array(z.enum(["tools", "small_parts", "substances", "heat", "electricity", "sharp", "water", "allergens", "other"]))
    .default([]),
});
export type Safety = z.infer<typeof SafetySchema>;

export const ActivityContentSchema = z.object({
  title: z.string().min(3).max(90),
  subtitle: z.string().max(140).optional().default(""),
  description: z.string().min(40).max(900),
  pedagogicalGoal: z.string().min(20).max(600),
  ageRange: z.enum(AGE_RANGES),
  durationMinutes: z.number().int().min(5).max(240),
  difficulty: z.number().int().min(1).max(5),
  category: z.string().min(2).max(40),
  tags: z.array(z.string().min(1).max(30)).max(10).default([]),
  materials: z.array(MaterialItemSchema).min(1).max(25),
  steps: z.array(StepSchema).min(2).max(15),
  finalIllustrationBrief: z.string().min(10).max(600),
  explanation: z.object({
    title: z.string().min(2).max(90),
    body: z.string().min(60).max(1800),
    keyWords: z.array(z.string().min(1).max(40)).max(8).default([]),
  }),
  challenge: z.object({
    title: z.string().min(2).max(90),
    body: z.string().min(20).max(800),
  }),
  safety: SafetySchema,
  funFact: z.string().max(400).optional().default(""),
});
export type ActivityContent = z.infer<typeof ActivityContentSchema>;

// ---------------------------------------------------------------------------
// Fiche de référence visuelle
// ---------------------------------------------------------------------------

export const VisualReferenceSheetSchema = z.object({
  finalObject: z.string().min(5).max(300).describe("Description de l'objet final"),
  shape: z.string().min(5).max(300),
  colors: z.array(z.string().min(2).max(60)).min(1).max(8),
  materials: z.array(z.string().min(2).max(80)).min(1).max(12),
  dimensions: z.string().min(3).max(200).describe("Dimensions approximatives"),
  mainParts: z.array(z.object({ name: z.string().min(1).max(60), appearance: z.string().min(5).max(240) })).min(1).max(12),
  characters: z.string().max(300).default("").describe("Personnages éventuels (enfant, adulte) et leur apparence constante"),
  setting: z.string().max(300).default("").describe("Décor / environnement constant"),
  stepAppearances: z
    .array(z.object({ stepIndex: z.number().int().min(0), appearance: z.string().min(5).max(400) }))
    .default([]),
  styleNotes: z.string().max(400).default(""),
  negativePrompt: z.string().max(400).default(""),
});
export type VisualReferenceSheet = z.infer<typeof VisualReferenceSheetSchema>;

// ---------------------------------------------------------------------------
// Couverture
// ---------------------------------------------------------------------------

export const CoverDataSchema = z.object({
  title: z.string().min(1).max(90),
  subtitle: z.string().max(140).default(""),
  collection: z.string().max(60).default(""),
  ageLabel: z.string().max(40).default(""),
  tagline: z.string().max(200).default(""),
  backText: z.string().max(1200).default(""),
  backBullets: z.array(z.string().max(120)).max(6).default([]),
  illustrationBrief: z.string().max(600).default(""),
  variant: z.number().int().min(0).max(3).default(0),
  illustrationId: z.string().optional(),
});
export type CoverData = z.infer<typeof CoverDataSchema>;

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

export function ageRangeLabel(range: string) {
  const [a, b] = range.split("-");
  return `${a} à ${b} ans`;
}

export function difficultyLabel(d: number) {
  return ["", "Très facile", "Facile", "Moyen", "Difficile", "Expert"][Math.max(1, Math.min(5, d))];
}

export function supervisionLabel(s: Safety["adultSupervision"]) {
  return { none: "Autonomie possible", recommended: "Adulte recommandé", required: "Adulte obligatoire" }[s];
}
