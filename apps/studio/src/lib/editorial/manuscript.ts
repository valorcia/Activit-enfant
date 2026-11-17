/**
 * Manuscrit structuré : l'entrée du moteur éditorial. Il est produit par la rédaction
 * (IA ou humaine) et ne contient aucune information de mise en page.
 */
import { z } from "zod";

export const COLLECTIONS = ["secret-book", "before-too-late", "movie-of-my-life"] as const;
export type CollectionKey = (typeof COLLECTIONS)[number];

const Illustration = z.object({
  /** Illustration réelle (URL servie par l'app) ; absente : aplat de la direction artistique */
  src: z.string().optional(),
  alt: z.string().default(""),
  caption: z.string().optional(),
});

export const ChapterBlockSchema = z.union([
  z.string().transform((text) => ({ type: "p" as const, text })),
  z.object({ type: z.literal("p"), text: z.string().min(1) }),
  z.object({ type: z.literal("break") }),
  z.object({ type: z.literal("subhead"), text: z.string().min(1) }),
  /** Citation dans le fil du texte (retrait, italique) */
  z.object({ type: z.literal("quote"), text: z.string().min(1), source: z.string().optional() }),
  /** Citation pleine page, insérée à la prochaine fin de page */
  z.object({ type: z.literal("citation"), text: z.string().min(1), source: z.string().optional() }),
  /** Illustration : pleine page, ou en tête de la page suivante avec le texte dessous */
  Illustration.extend({ type: z.literal("illustration"), mode: z.enum(["full", "figure"]).default("figure") }),
  /** Activité : consigne + espace de réponse */
  z.object({
    type: z.literal("activity"),
    title: z.string().min(1),
    prompt: z.string().min(1),
    kind: z.enum(["lines", "checklist", "letter"]).default("lines"),
    items: z.array(z.string()).default([]),
  }),
  /** Page souvenir : espace à remplir (photo, lignes, ou les deux) */
  z.object({
    type: z.literal("memory"),
    title: z.string().min(1),
    prompt: z.string().min(1),
    kind: z.enum(["photo", "lines", "both"]).default("both"),
    fields: z.array(z.string()).default([]),
  }),
]);
export type ChapterBlock = z.output<typeof ChapterBlockSchema>;

export const ChapterSchema = z.object({
  title: z.string().min(1),
  /** Intitulé au-dessus du titre (« Chapter One », « Acte I »…) ; par défaut, numéro en toutes lettres */
  label: z.string().optional(),
  epigraph: z.object({ text: z.string(), source: z.string().optional() }).optional(),
  blocks: z.array(ChapterBlockSchema).min(1),
});
export type Chapter = z.output<typeof ChapterSchema>;

export const ManuscriptSchema = z.object({
  collection: z.enum(COLLECTIONS),
  lang: z.enum(["fr", "en"]),
  title: z.string().min(1),
  subtitle: z.string().optional(),
  /** Destinataire du livre (« for Maya ») */
  recipient: z.string().optional(),
  /** Auteur ou offrant (« by Grandpa Tom ») */
  author: z.string().optional(),
  dedication: z.object({ text: z.string(), signature: z.string().optional() }).optional(),
  epigraph: z.object({ text: z.string(), source: z.string().optional() }).optional(),
  chapters: z.array(ChapterSchema).min(1),
  conclusion: z.object({ title: z.string(), blocks: z.array(ChapterBlockSchema).min(1), signature: z.string().optional() }).optional(),
  backCover: z.object({ blurb: z.string(), quote: z.string().optional() }),
  cover: z.object({
    /** Direction artistique : voir COVER_DIRECTIONS (src/lib/editorial/covers.ts) */
    direction: z.string(),
    kicker: z.string().optional(),
    /** Monogramme (initiale) pour les directions qui en utilisent un */
    monogram: z.string().max(3).optional(),
    /** Repères chiffrés (années) pour les directions chronologiques */
    marks: z.array(z.string()).default([]),
    illustration: Illustration.optional(),
  }),
  edition: z.object({ number: z.string().optional(), date: z.string().optional(), note: z.string().optional() }).default({}),
  /** Données de personnalisation qui doivent apparaître dans le livre (contrôle qualité) */
  personalization: z.array(z.string()).default([]),
});
export type Manuscript = z.output<typeof ManuscriptSchema>;
export type ManuscriptInput = z.input<typeof ManuscriptSchema>;
