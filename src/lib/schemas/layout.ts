import { z } from "zod";

// ---------------------------------------------------------------------------
// Thème graphique
// ---------------------------------------------------------------------------

export const BookThemeSchema = z.object({
  templateKey: z.string().default("atelier"),
  fontHeading: z.string().default("Nunito"),
  fontBody: z.string().default("Nunito"),
  colorPrimary: z.string().default("#1d4ed8"),
  colorSecondary: z.string().default("#f59e0b"),
  colorAccent: z.string().default("#10b981"),
  colorText: z.string().default("#1f2937"),
  colorBackground: z.string().default("#ffffff"),
  colorPanel: z.string().default("#eff6ff"),
  marginMm: z.number().min(5).max(30).default(15),
  bleedMm: z.number().min(0).max(5).default(0),
  baseFontPt: z.number().min(8).max(16).default(11),
  headingStyle: z.enum(["rounded", "classic", "playful"]).default("rounded"),
});
export type BookTheme = z.infer<typeof BookThemeSchema>;

// ---------------------------------------------------------------------------
// Blocs de page (positions en mm, origine en haut à gauche de la page)
// ---------------------------------------------------------------------------

const Rect = {
  x: z.number(),
  y: z.number(),
  w: z.number().min(1),
  h: z.number().min(1),
};

export const TextStyleSchema = z.object({
  fontSizePt: z.number().min(5).max(96).optional(),
  fontFamily: z.string().optional(),
  color: z.string().optional(),
  background: z.string().optional(),
  align: z.enum(["left", "center", "right", "justify"]).optional(),
  weight: z.enum(["normal", "bold"]).optional(),
  lineHeight: z.number().min(0.8).max(2.5).optional(),
  padding: z.number().min(0).max(30).optional(),
  radius: z.number().min(0).max(30).optional(),
  borderColor: z.string().optional(),
});
export type TextStyle = z.infer<typeof TextStyleSchema>;

export const TextBlockSchema = z.object({
  id: z.string(),
  type: z.literal("text"),
  role: z.enum(["title", "subtitle", "heading", "body", "caption", "label", "pageNumber"]).default("body"),
  text: z.string(),
  ...Rect,
  style: TextStyleSchema.default({}),
  editable: z.boolean().default(true),
});

export const ListBlockSchema = z.object({
  id: z.string(),
  type: z.literal("list"),
  role: z.enum(["materials", "warnings", "bullets", "keywords"]).default("bullets"),
  items: z.array(z.string()),
  title: z.string().optional(),
  ...Rect,
  style: TextStyleSchema.default({}),
  editable: z.boolean().default(true),
});

export const StepBlockSchema = z.object({
  id: z.string(),
  type: z.literal("step"),
  number: z.number().int().min(1),
  title: z.string(),
  instruction: z.string(),
  tip: z.string().default(""),
  adultHelp: z.boolean().default(false),
  illustrationId: z.string().optional(),
  imageSrc: z.string().optional(),
  isDemo: z.boolean().default(false),
  ...Rect,
  style: TextStyleSchema.default({}),
  editable: z.boolean().default(true),
});

export const ImageBlockSchema = z.object({
  id: z.string(),
  type: z.literal("image"),
  role: z.enum(["final", "step", "cover", "decoration"]).default("final"),
  illustrationId: z.string().optional(),
  src: z.string().optional(), // URL servie par l'app (/api/assets/...)
  alt: z.string().default(""),
  caption: z.string().default(""),
  isDemo: z.boolean().default(false),
  fit: z.enum(["contain", "cover"]).default("contain"),
  ...Rect,
  style: TextStyleSchema.default({}),
  editable: z.boolean().default(true),
});

export const BadgeBlockSchema = z.object({
  id: z.string(),
  type: z.literal("badges"),
  items: z.array(z.object({ label: z.string(), value: z.string(), icon: z.string().optional() })),
  ...Rect,
  style: TextStyleSchema.default({}),
  editable: z.boolean().default(true),
});

export const ShapeBlockSchema = z.object({
  id: z.string(),
  type: z.literal("shape"),
  shape: z.enum(["rect", "band", "circle"]).default("rect"),
  color: z.string().default("#eff6ff"),
  ...Rect,
  style: TextStyleSchema.default({}),
  editable: z.boolean().default(true),
});

export const TocBlockSchema = z.object({
  id: z.string(),
  type: z.literal("toc"),
  entries: z.array(z.object({ number: z.number().int(), title: z.string(), page: z.number().int() })),
  ...Rect,
  style: TextStyleSchema.default({}),
  editable: z.boolean().default(false),
});

export const BlockSchema = z.discriminatedUnion("type", [
  TextBlockSchema,
  ListBlockSchema,
  StepBlockSchema,
  ImageBlockSchema,
  BadgeBlockSchema,
  ShapeBlockSchema,
  TocBlockSchema,
]);
export type Block = z.infer<typeof BlockSchema>;
export type TextBlock = z.infer<typeof TextBlockSchema>;
export type ImageBlock = z.infer<typeof ImageBlockSchema>;
export type StepBlock = z.infer<typeof StepBlockSchema>;

export const PageLayoutSchema = z.object({
  widthMm: z.number(),
  heightMm: z.number(),
  background: z.string().optional(),
  showPageNumber: z.boolean().default(true),
  blocks: z.array(BlockSchema),
});
export type PageLayout = z.infer<typeof PageLayoutSchema>;

export const PAGE_TEMPLATES = [
  { key: "cover", name: "Couverture", description: "Première de couverture avec illustration principale" },
  { key: "back_cover", name: "Quatrième de couverture", description: "Résumé, points forts, tranche d'âge" },
  { key: "intro", name: "Présentation du livre", description: "Page de bienvenue et introduction" },
  { key: "toc", name: "Sommaire", description: "Liste numérotée des activités avec pages" },
  { key: "activity_intro", name: "Présentation d'activité", description: "Titre, illustration finale, badges, description" },
  { key: "materials", name: "Liste du matériel", description: "Matériel nécessaire et consignes de sécurité" },
  { key: "steps", name: "Instructions illustrées", description: "Étapes numérotées avec illustrations" },
  { key: "science", name: "Explication pédagogique", description: "Pourquoi ça marche + mots-clés" },
  { key: "challenge", name: "Défi supplémentaire", description: "Prolongement de l'activité" },
  { key: "diploma", name: "Diplôme", description: "Diplôme de petit inventeur à compléter" },
  { key: "conclusion", name: "Page de conclusion", description: "Mot de fin et remerciements" },
  { key: "blank", name: "Page vierge", description: "Page libre" },
] as const;
export type PageTemplateKey = (typeof PAGE_TEMPLATES)[number]["key"];
