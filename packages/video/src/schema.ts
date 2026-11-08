import { z } from "zod";

/** Formats de sortie : 9:16 (Reels, TikTok, Stories), 1:1 (fil), 16:9 (YouTube, site). */
export const AD_FORMATS = {
  story: { width: 1080, height: 1920, label: "Story / Reel / TikTok (9:16)" },
  square: { width: 1080, height: 1080, label: "Carré (1:1)" },
  landscape: { width: 1920, height: 1080, label: "Paysage (16:9)" },
} as const;
export type AdFormat = keyof typeof AD_FORMATS;
export const adFormatSchema = z.enum(["story", "square", "landscape"]);

export const FPS = 30;

/** Palette La Malle à Jeux. */
export const BRAND = {
  cream: "#FFF9F0",
  coral: "#FF826F",
  honey: "#FFD66B",
  sage: "#A8C9A1",
  sky: "#A9D8F5",
  lavender: "#C8B6E8",
  ink: "#293241",
} as const;

const mediaSrc = z.string().min(1, "Source média vide");

export const kitItemSchema = z.object({
  title: z.string().min(1).max(60),
  image: mediaSrc.optional(),
});

export const adPropsSchema = z
  .object({
    format: adFormatSchema.default("story"),
    /** Durée totale en secondes (6 à 20). */
    durationSeconds: z.number().min(2).max(20).default(15),
    brandName: z.string().max(40).default("La Malle à Jeux"),
    title: z.string().min(1).max(80),
    hook: z.string().min(1).max(90),
    bullets: z.array(z.string().min(1).max(70)).min(1).max(3),
    kitItems: z.array(kitItemSchema).max(5).default([]),
    priceCents: z.number().int().min(0),
    compareAtCents: z.number().int().min(0).nullable().optional(),
    currency: z.string().length(3).default("EUR"),
    cta: z.string().min(1).max(40).default("Téléchargez maintenant"),
    url: z.string().max(60).default(""),
    logo: mediaSrc.optional(),
    /** Illustration principale (scène d'accroche). */
    heroImage: mediaSrc,
    /** Couverture affichée sur la scène d'offre (sinon heroImage). */
    coverImage: mediaSrc.optional(),
    /** Clip vidéo d'accroche (ex. MP4 Runway) à la place de l'image de la scène 1. */
    hookClip: mediaSrc.optional(),
    music: mediaSrc.optional(),
    musicVolume: z.number().min(0).max(1).default(0.6),
  })
  .refine((p) => p.compareAtCents == null || p.compareAtCents > p.priceCents, {
    message: "Le prix barré doit être supérieur au prix",
    path: ["compareAtCents"],
  });

export type AdProps = z.infer<typeof adPropsSchema>;
export type AdPropsInput = z.input<typeof adPropsSchema>;

export function parseAdProps(input: unknown): AdProps {
  return adPropsSchema.parse(input);
}

/** Découpage en scènes (en images), proportionnel à la durée totale. */
export function sceneTimings(durationSeconds: number, hasKit: boolean) {
  const total = Math.round(durationSeconds * FPS);
  const weights = hasKit ? [0.27, 0.28, 0.2, 0.25] : [0.35, 0, 0.3, 0.35];
  const frames = weights.map((w) => Math.round(total * w));
  // Ajuste la dernière scène pour tomber exactement sur le total
  frames[3] = total - frames[0] - frames[1] - frames[2];
  return { total, hook: frames[0], kit: frames[1], benefits: frames[2], offer: frames[3] };
}

export function formatPrice(cents: number, currency = "EUR"): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}
