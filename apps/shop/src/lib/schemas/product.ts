import { z } from "zod";

export const kitItemSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().max(400).optional().default(""),
  icon: z.string().max(40).optional().default("file-text"),
  quantity: z.coerce.number().int().min(0).optional(),
});
export type KitItem = z.infer<typeof kitItemSchema>;

export const faqItemSchema = z.object({
  question: z.string().min(1).max(200),
  answer: z.string().min(1).max(2000),
});
export type FaqItem = z.infer<typeof faqItemSchema>;

export const sellingPointSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().max(400).optional().default(""),
  icon: z.string().max(40).optional().default("sparkles"),
});
export type SellingPoint = z.infer<typeof sellingPointSchema>;

export const productStatusSchema = z.enum(["DRAFT", "SCHEDULED", "PUBLISHED", "ARCHIVED"]);
export const productTemplateSchema = z.enum(["ADVENTURE", "ACTIVITY", "STORY", "EVENT", "CLASSIC", "GUIDE", "RECIPES"]);
export const mediaRoleSchema = z.enum(["MAIN", "GALLERY", "ILLUSTRATION", "MOCKUP", "VIDEO", "PDF_PREVIEW", "OG"]);
export const fileKindSchema = z.enum(["MAIN_PDF", "EXTRA_PDF", "INSTRUCTIONS", "BONUS"]);

const optionalInt = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : v),
  z.coerce.number().int().min(0).optional(),
);
const optionalDate = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : v),
  z.coerce.date().optional(),
);
const stringList = z.preprocess(
  (v) => (typeof v === "string" ? v.split(/[,\n]/).map((s) => s.trim()).filter(Boolean) : v ?? []),
  z.array(z.string().max(80)).max(50),
);

/** Formulaire produit (admin + API + CSV). Les prix sont en centimes. */
const productBaseSchema = z.object({
  name: z.string().min(2).max(160),
  slug: z.string().min(2).max(96).regex(/^[a-z0-9-]+$/, "Slug invalide (lettres minuscules, chiffres, tirets)").optional(),
  tagline: z.string().max(200).optional().nullable(),
  shortDescription: z.string().max(400).optional().nullable(),
  longDescription: z.string().max(20000).optional().nullable(),
  story: z.string().max(20000).optional().nullable(),
  template: productTemplateSchema.default("CLASSIC"),
  categoryId: z.string().optional().nullable(),
  collectionIds: z.array(z.string()).optional().default([]),
  universe: z.string().max(80).optional().nullable(),
  tags: stringList.optional().default([]),
  badges: stringList.optional().default([]),
  heroBadges: stringList.optional().default([]),

  ageMin: optionalInt,
  ageMax: optionalInt,
  playersMin: optionalInt,
  playersMax: optionalInt,
  durationMinutes: optionalInt,
  difficulty: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.coerce.number().int().min(1).max(5).optional()),
  pageCount: optionalInt,
  fileFormat: z.string().max(40).default("PDF"),
  materials: stringList.optional().default([]),

  priceCents: z.coerce.number().int().min(0),
  salePriceCents: optionalInt,
  saleStartsAt: optionalDate,
  saleEndsAt: optionalDate,
  currency: z.string().length(3).default("EUR"),
  taxRateBp: z.coerce.number().int().min(0).max(10000).default(2000),
  creationCostCents: optionalInt, // coût de création interne (IA, illustrations) pour la rentabilité

  kitContents: z.array(kitItemSchema).optional().default([]),
  faq: z.array(faqItemSchema).optional().default([]),
  sellingPoints: z.array(sellingPointSchema).optional().default([]),

  seoTitle: z.string().max(70).optional().nullable(),
  seoDescription: z.string().max(170).optional().nullable(),
  keywords: stringList.optional().default([]),
  ogImageUrl: z.string().max(500).optional().nullable(),
  promoText: z.string().max(300).optional().nullable(),
  recommendedProductIds: z.array(z.string()).optional().default([]),

  status: productStatusSchema.default("DRAFT"),
  scheduledAt: optionalDate,
  isFeatured: z.coerce.boolean().optional().default(false),
  /** Univers (site) du produit ; absent = univers par défaut à la création, inchangé à la mise à jour. */
  siteId: z.string().optional(),
});

type ProductBase = z.infer<typeof productBaseSchema>;
const productRules = [
  { check: (p: ProductBase) => !(p.ageMin && p.ageMax) || p.ageMin <= p.ageMax, message: "Âge minimum > âge maximum", path: ["ageMax"] },
  { check: (p: ProductBase) => p.salePriceCents === undefined || p.salePriceCents < p.priceCents, message: "Le prix promotionnel doit être inférieur au prix normal", path: ["salePriceCents"] },
  { check: (p: ProductBase) => p.status !== "SCHEDULED" || !!p.scheduledAt, message: "Date de publication requise", path: ["scheduledAt"] },
];
function withRules<T extends z.ZodType<ProductBase>>(schema: T) {
  return schema.superRefine((p, ctx) => {
    for (const rule of productRules) {
      if (!rule.check(p)) ctx.addIssue({ code: "custom", message: rule.message, path: rule.path });
    }
  });
}

export const productInputSchema = withRules(productBaseSchema);

export type ProductInput = z.infer<typeof productInputSchema>;

/** Payload de l'API d'importation (JSON). Les médias sont des URLs à importer. */
export const productApiInputSchema = withRules(productBaseSchema.extend({
  images: z.array(z.object({
    url: z.string().url(),
    alt: z.string().max(200).optional(),
    role: mediaRoleSchema.default("GALLERY"),
  })).optional().default([]),
  categorySlug: z.string().optional(),
  /** Univers cible (slug, ex. « la-malle-a-jeux ») ; défaut : univers par défaut. */
  siteSlug: z.string().optional(),
  collectionSlugs: z.array(z.string()).optional().default([]),
}));
export type ProductApiInput = z.infer<typeof productApiInputSchema>;

/** Ligne CSV d'importation (toutes les colonnes sont des chaînes). */
export const productCsvRowSchema = z.object({
  name: z.string().min(2),
  slug: z.string().optional(),
  category: z.string().optional(),
  collections: z.string().optional(),
  template: z.string().optional(),
  tagline: z.string().optional(),
  short_description: z.string().optional(),
  long_description: z.string().optional(),
  story: z.string().optional(),
  universe: z.string().optional(),
  tags: z.string().optional(),
  badges: z.string().optional(),
  age_min: z.string().optional(),
  age_max: z.string().optional(),
  players_min: z.string().optional(),
  players_max: z.string().optional(),
  duration_minutes: z.string().optional(),
  difficulty: z.string().optional(),
  page_count: z.string().optional(),
  materials: z.string().optional(),
  price: z.string().min(1), // en euros, ex. "9.90"
  sale_price: z.string().optional(),
  sale_starts_at: z.string().optional(),
  sale_ends_at: z.string().optional(),
  tax_rate: z.string().optional(), // en %, ex. "20"
  seo_title: z.string().optional(),
  seo_description: z.string().optional(),
  keywords: z.string().optional(),
  main_image_url: z.string().optional(),
  gallery_urls: z.string().optional(), // séparées par |
  status: z.string().optional(),
  scheduled_at: z.string().optional(),
});
export type ProductCsvRow = z.infer<typeof productCsvRowSchema>;

export const CSV_COLUMNS = Object.keys(productCsvRowSchema.shape);
