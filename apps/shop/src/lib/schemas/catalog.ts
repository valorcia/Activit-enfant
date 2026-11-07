import { z } from "zod";

const empty = (v: unknown) => (v === "" || v === undefined ? null : v);
export const categorySchema = z.object({
  name: z.string().min(2).max(80),
  slug: z.string().max(96).optional(),
  description: z.preprocess(empty, z.string().max(400).nullable()),
  illustrationUrl: z.preprocess(empty, z.string().max(600).nullable()),
  color: z.preprocess(empty, z.string().regex(/^#[0-9a-fA-F]{6}$/, "Couleur hexadécimale attendue").nullable()),
  icon: z.preprocess(empty, z.string().max(40).nullable()),
  position: z.coerce.number().int().min(0).default(0),
  isVisible: z.coerce.boolean().default(true),
  seoTitle: z.preprocess(empty, z.string().max(70).nullable()),
  seoDescription: z.preprocess(empty, z.string().max(170).nullable()),
  parentId: z.preprocess(empty, z.string().nullable()),
});
export type CategoryInput = z.infer<typeof categorySchema>;

export const collectionSchema = categorySchema.omit({ parentId: true, icon: true, illustrationUrl: true }).extend({
  imageUrl: z.preprocess(empty, z.string().max(600).nullable()),
});
export type CollectionInput = z.infer<typeof collectionSchema>;

const stringList = z.preprocess((v) => (typeof v === "string" ? v.split(/[,\n]/).map((s) => s.trim()).filter(Boolean) : v ?? []), z.array(z.string().max(80)).max(20));

export const bundleSchema = z.object({
  name: z.string().min(2).max(160),
  slug: z.string().max(96).optional(),
  tagline: z.preprocess(empty, z.string().max(200).nullable()),
  description: z.preprocess(empty, z.string().max(10000).nullable()),
  imageUrl: z.preprocess(empty, z.string().max(600).nullable()),
  priceCents: z.coerce.number().int().min(0),
  currency: z.string().length(3).default("EUR"),
  taxRateBp: z.coerce.number().int().min(0).max(10000).default(2000),
  badges: stringList.default([]),
  status: z.enum(["DRAFT", "SCHEDULED", "PUBLISHED", "ARCHIVED"]).default("DRAFT"),
  isFeatured: z.coerce.boolean().default(false),
  seoTitle: z.preprocess(empty, z.string().max(70).nullable()),
  seoDescription: z.preprocess(empty, z.string().max(170).nullable()),
  productIds: z.array(z.string()).min(1, "Sélectionnez au moins un produit").max(30),
});
export type BundleInput = z.infer<typeof bundleSchema>;
