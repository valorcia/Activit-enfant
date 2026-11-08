import { z } from "zod";

export const AiSettingsSchema = z.object({
  /** api : appels aux API (clés requises) · manual : copier-coller des prompts dans Claude / ChatGPT, sans clé */
  mode: z.enum(["api", "manual"]).default("api"),
  /** Périmètre du mode copier-coller : tout, ou seulement les images (ex. clé Claude pour le texte, ChatGPT pour les images) */
  manualFor: z.enum(["all", "images", "text"]).default("all"),
  textProvider: z.enum(["anthropic", "openai", "mock"]).default("mock"),
  textModel: z.string().default("claude-opus-5-5"),
  imageProvider: z.enum(["openai", "mock"]).default("mock"),
  imageModel: z.string().default("gpt-image-1"),
  imageQuality: z.enum(["low", "medium", "high"]).default("medium"),
  imageSize: z.enum(["1024x1024", "1536x1024", "1024x1536"]).default("1024x1024"),
  stepIllustrations: z.boolean().default(true),
  maxStepIllustrations: z.number().int().min(0).max(15).default(8),
  maxBudgetPerBookUsd: z.number().min(0).default(50),
  maxConcurrentGenerations: z.number().int().min(1).max(10).default(2),
  language: z.string().default("fr"),
});
export type AiSettings = z.infer<typeof AiSettingsSchema>;
export const DEFAULT_AI_SETTINGS: AiSettings = AiSettingsSchema.parse({});

// ---------------------------------------------------------------------------
// Boutique (apps/shop) — publication automatique des e-books
// ---------------------------------------------------------------------------

export const SHOP_TEMPLATES = ["ADVENTURE", "ACTIVITY", "STORY", "EVENT", "CLASSIC"] as const;

export const ShopSettingsSchema = z.object({
  shopApiUrl: z.string().default(""),           // ex. https://activite-enfant-shop.vercel.app
  shopApiKey: z.string().default(""),           // stockée côté serveur uniquement, jamais renvoyée en clair
  autoPublish: z.boolean().default(true),       // publier immédiatement (sinon brouillon « à valider » dans la boutique)
  defaultPriceCents: z.number().int().min(0).default(990),
  defaultCategorySlug: z.string().default("histoires-et-aventures"),
  defaultTemplate: z.enum(SHOP_TEMPLATES).default("STORY"),
});
export type ShopSettings = z.infer<typeof ShopSettingsSchema>;
export const DEFAULT_SHOP_SETTINGS: ShopSettings = ShopSettingsSchema.parse({});

/** Fiche commerciale éditable d'un livre (stockée dans Book.shopListing, fusionnée avec les valeurs dérivées du livre). */
export const ShopListingSchema = z.object({
  name: z.string().max(160).optional(),
  slug: z.string().max(96).optional(),
  tagline: z.string().max(200).optional(),
  shortDescription: z.string().max(400).optional(),
  longDescription: z.string().max(20000).optional(),
  story: z.string().max(20000).optional(),
  priceCents: z.number().int().min(0).optional(),
  salePriceCents: z.number().int().min(0).nullable().optional(),
  categorySlug: z.string().optional(),
  collectionSlugs: z.array(z.string()).optional(),
  template: z.enum(SHOP_TEMPLATES).optional(),
  universe: z.string().max(80).optional(),
  tags: z.array(z.string()).optional(),
  ageMin: z.number().int().min(0).optional(),
  ageMax: z.number().int().min(0).optional(),
  durationMinutes: z.number().int().min(0).nullable().optional(),
  kitContents: z.array(z.object({ title: z.string(), description: z.string().optional(), icon: z.string().optional(), quantity: z.number().int().optional() })).optional(),
  faq: z.array(z.object({ question: z.string(), answer: z.string() })).optional(),
  sellingPoints: z.array(z.object({ title: z.string(), description: z.string().optional(), icon: z.string().optional() })).optional(),
  seoTitle: z.string().max(70).optional(),
  seoDescription: z.string().max(170).optional(),
  keywords: z.array(z.string()).optional(),
  autoPublish: z.boolean().optional(), // surcharge du réglage global pour ce livre
});
export type ShopListing = z.infer<typeof ShopListingSchema>;
